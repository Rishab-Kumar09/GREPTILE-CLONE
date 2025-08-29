import fs from 'fs/promises'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { createReadStream } from 'fs'
import { Extract } from 'unzipper'

export interface RepositoryInfo {
  owner: string
  repo: string
  fullName: string
  clonePath: string
  size: number
  estimatedTime: string
}

export interface CloneProgress {
  stage: 'initializing' | 'downloading' | 'extracting' | 'analyzing' | 'complete'
  progress: number
  message: string
  currentFile?: string
  downloadSpeed?: string
  eta?: string
  downloadedBytes?: number
  totalBytes?: number
  extractedFiles?: number
  totalFiles?: number
}

// Storage configuration
const STORAGE_BASE_PATH = process.env.REPO_STORAGE_PATH || '/tmp/greptile-repos'
const MAX_REPO_SIZE_MB = 10000 // 10GB limit (practically unlimited - handles any repository)
const CLEANUP_AFTER_HOURS = 24 // Clean up cloned repos after 24 hours

/**
 * Get repository information from GitHub API
 */
export async function getRepositoryInfo(owner: string, repo: string): Promise<RepositoryInfo> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    if (!response.ok) {
      throw new Error(`Repository not found: ${owner}/${repo}`)
    }
    
    const repoData = await response.json()
    const sizeMB = repoData.size / 1024 // GitHub returns size in KB
    
    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      clonePath: path.join(STORAGE_BASE_PATH, owner, repo),
      size: sizeMB,
      estimatedTime: getEstimatedAnalysisTime(sizeMB, repoData.language)
    }
  } catch (error) {
    throw new Error(`Failed to get repository info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Estimate analysis time based on repository characteristics
 */
function getEstimatedAnalysisTime(sizeMB: number, primaryLanguage?: string): string {
  let baseTime = 30 // Base 30 seconds
  
  // Size factor
  if (sizeMB < 10) baseTime = 30
  else if (sizeMB < 50) baseTime = 60
  else if (sizeMB < 200) baseTime = 120
  else if (sizeMB < 500) baseTime = 300
  else baseTime = 600
  
  // Language complexity factor
  const complexLanguages = ['cpp', 'c', 'java', 'scala', 'rust']
  if (primaryLanguage && complexLanguages.includes(primaryLanguage.toLowerCase())) {
    baseTime *= 1.5
  }
  
  const minutes = Math.ceil(baseTime / 60)
  if (minutes < 1) return '30 seconds - 1 minute'
  if (minutes < 2) return '1-2 minutes'
  if (minutes < 5) return `${minutes} minutes`
  if (minutes < 10) return `${minutes}-${minutes + 2} minutes`
  return `${minutes}+ minutes`
}

/**
 * Download repository archive with progress tracking (replaces Git cloning)
 */
export async function cloneRepository(
  repoInfo: RepositoryInfo, 
  progressCallback?: (progress: CloneProgress) => void
): Promise<string> {
  const { owner, repo, clonePath, size } = repoInfo
  
  // Check size limits (more generous for archive downloads)
  if (size > MAX_REPO_SIZE_MB) {
    throw new Error(`Repository too large (${size}MB). Maximum allowed: ${MAX_REPO_SIZE_MB}MB`)
  }
  
  try {
    // Create storage directory
    await fs.mkdir(path.dirname(clonePath), { recursive: true })
    
    progressCallback?.({
      stage: 'initializing',
      progress: 0,
      message: 'Preparing to download repository...'
    })
    
    // Check if already downloaded and recent
    const existingRepo = await checkExistingRepository(clonePath)
    if (existingRepo) {
      progressCallback?.({
        stage: 'complete',
        progress: 100,
        message: 'Using existing repository download'
      })
      return clonePath
    }
    
    // Clean up any existing directory
    try {
      await fs.rm(clonePath, { recursive: true, force: true })
    } catch (error) {
      // Directory doesn't exist, that's fine
    }
    
    // Download repository archive
    const archivePath = await downloadRepositoryArchive(owner, repo, clonePath, progressCallback)
    
    // Extract archive
    await extractRepositoryArchive(archivePath, clonePath, progressCallback)
    
    // Clean up archive file
    await fs.unlink(archivePath)
    
    // Post-extraction optimizations
    await optimizeExtractedRepository(clonePath)
    
    progressCallback?.({
      stage: 'complete',
      progress: 100,
      message: 'Repository ready for analysis'
    })
    
    console.log(`✅ Successfully downloaded ${owner}/${repo} to ${clonePath}`)
    return clonePath
    
  } catch (error) {
    console.error(`❌ Failed to clone ${owner}/${repo}:`, error)
    
    // Clean up failed clone
    try {
      await fs.rm(clonePath, { recursive: true, force: true })
    } catch (cleanupError) {
      console.warn('Failed to clean up after failed clone:', cleanupError)
    }
    
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Download repository archive from GitHub
 */
async function downloadRepositoryArchive(
  owner: string, 
  repo: string, 
  basePath: string, 
  progressCallback?: (progress: CloneProgress) => void
): Promise<string> {
  const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`
  const archivePath = path.join(basePath, `${repo}.zip`)
  
  console.log(`📥 Downloading repository archive from: ${archiveUrl}`)
  
  progressCallback?.({
    stage: 'downloading',
    progress: 5,
    message: `Downloading ${owner}/${repo} archive...`
  })
  
  const response = await fetch(archiveUrl)
  if (!response.ok) {
    throw new Error(`Failed to download repository: ${response.status} ${response.statusText}`)
  }
  
  const contentLength = response.headers.get('content-length')
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
  
  let downloadedBytes = 0
  const startTime = Date.now()
  
  // Create write stream
  await fs.mkdir(basePath, { recursive: true })
  const fileStream = createWriteStream(archivePath)
  
  // Stream with progress tracking
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response stream')
  }
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      downloadedBytes += value.length
      fileStream.write(value)
      
      // Calculate progress and speed
      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 80) + 5 : 50 // 5-85%
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const downloadSpeed = elapsedSeconds > 0 ? (downloadedBytes / elapsedSeconds / 1024 / 1024).toFixed(1) : '0'
      const eta = totalBytes > 0 && elapsedSeconds > 0 ? 
        Math.round((totalBytes - downloadedBytes) / (downloadedBytes / elapsedSeconds)) : 0
      
      progressCallback?.({
        stage: 'downloading',
        progress,
        message: `Downloading... ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB${totalBytes > 0 ? ` / ${(totalBytes / 1024 / 1024).toFixed(1)}MB` : ''}`,
        downloadSpeed: `${downloadSpeed} MB/s`,
        eta: eta > 0 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : undefined,
        downloadedBytes,
        totalBytes
      })
    }
  } finally {
    fileStream.end()
  }
  
  console.log(`✅ Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB to ${archivePath}`)
  return archivePath
}

/**
 * Extract repository archive with progress tracking using pure JavaScript
 */
async function extractRepositoryArchive(
  archivePath: string, 
  extractPath: string, 
  progressCallback?: (progress: CloneProgress) => void
): Promise<void> {
  console.log(`📂 Extracting archive to: ${extractPath}`)
  
  progressCallback?.({
    stage: 'extracting',
    progress: 85,
    message: 'Extracting repository files...'
  })
  
  try {
    await fs.mkdir(extractPath, { recursive: true })
    
    // Use pure JavaScript ZIP extraction with unzipper library
    console.log(`📦 Extracting ZIP archive using unzipper...`)
    
    await new Promise<void>((resolve, reject) => {
      createReadStream(archivePath)
        .pipe(Extract({ path: extractPath }))
        .on('close', () => {
          console.log(`✅ Successfully extracted archive`)
          resolve()
        })
        .on('error', (error: Error) => {
          reject(new Error(`Failed to extract ZIP: ${error.message}`))
        })
    })
    
    // Find and flatten the GitHub root directory structure
    const entries = await fs.readdir(extractPath, { withFileTypes: true })
    const rootDirs = entries.filter(entry => entry.isDirectory())
    
    if (rootDirs.length === 1) {
      // GitHub creates a single root directory with commit hash
      const rootDir = rootDirs[0]
      const rootPath = path.join(extractPath, rootDir.name)
      
      console.log(`📁 Flattening GitHub root directory: ${rootDir.name}`)
      
      // Move all contents from root directory to extract path
      const rootContents = await fs.readdir(rootPath, { withFileTypes: true })
      
      for (const item of rootContents) {
        const sourcePath = path.join(rootPath, item.name)
        const targetPath = path.join(extractPath, item.name)
        
        try {
          await fs.rename(sourcePath, targetPath)
        } catch (renameError) {
          console.warn(`⚠️ Failed to move ${item.name}:`, renameError)
        }
      }
      
      // Remove the now-empty root directory
      try {
        await fs.rmdir(rootPath)
      } catch (rmdirError) {
        console.warn(`⚠️ Failed to remove root directory:`, rmdirError)
      }
    }
    
    progressCallback?.({
      stage: 'extracting',
      progress: 95,
      message: 'Extraction complete, optimizing...'
    })
    
    console.log(`✅ Successfully extracted and flattened repository structure`)
    
  } catch (error) {
    throw new Error(`Failed to extract archive: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if repository is already downloaded and recent
 */
async function checkExistingRepository(clonePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(clonePath)
    const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
    
    // If less than 1 hour old, reuse it
    if (ageHours < 1) {
      // Verify directory has content
      const entries = await fs.readdir(clonePath)
      return entries.length > 0
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
  }
  
  return false
}

/**
 * Optimize extracted repository for analysis
 */
async function optimizeExtractedRepository(clonePath: string): Promise<void> {
  try {
    // Remove .git directory to save space (we don't need git history for analysis)
    const gitPath = path.join(clonePath, '.git')
    await fs.rm(gitPath, { recursive: true, force: true })
    
    // Remove common large directories that don't need analysis
    const dirsToRemove = [
      'node_modules',
      '.next', 
      'build',
      'dist',
      'target',
      '.gradle',
      'vendor',
      '__pycache__',
      '.pytest_cache'
    ]
    
    for (const dir of dirsToRemove) {
      const dirPath = path.join(clonePath, dir)
      try {
        await fs.rm(dirPath, { recursive: true, force: true })
      } catch (error) {
        // Directory doesn't exist, that's fine
      }
    }
    
    console.log(`🗜️ Optimized extracted repository at ${clonePath}`)
  } catch (error) {
    console.warn('Failed to optimize repository:', error)
    // Don't throw - optimization is optional
  }
}

/**
 * Get all analyzable files from cloned repository
 */
export async function getAnalyzableFiles(clonePath: string): Promise<string[]> {
  const files: string[] = []
  
  async function scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(clonePath, fullPath)
        
        if (entry.isDirectory()) {
          // Skip certain directories
          if (!shouldSkipDirectory(entry.name)) {
            await scanDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          // Include analyzable files
          if (isAnalyzableFile(relativePath)) {
            files.push(relativePath)
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error)
    }
  }
  
  await scanDirectory(clonePath)
  return files.sort()
}

/**
 * Check if directory should be skipped during analysis
 */
function shouldSkipDirectory(dirName: string): boolean {
  const skipDirs = [
    'node_modules', '.git', '.next', 'build', 'dist', 'target',
    '.gradle', 'vendor', '__pycache__', '.pytest_cache',
    '.vscode', '.idea', 'coverage', '.nyc_output',
    'logs', 'tmp', 'temp', '.cache'
  ]
  
  return skipDirs.includes(dirName) || dirName.startsWith('.')
}

/**
 * Check if file should be analyzed
 */
function isAnalyzableFile(filePath: string): boolean {
  const analyzableExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
    '.py', '.rb', '.php', '.java', '.scala', '.kt',
    '.go', '.rs', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.swift', '.dart', '.elm', '.clj', '.cljs',
    '.sql', '.graphql', '.yaml', '.yml', '.json',
    '.dockerfile', '.sh', '.bash', '.zsh'
  ]
  
  const skipFiles = [
    'package-lock.json', 'yarn.lock', 'composer.lock',
    'Gemfile.lock', 'Pipfile.lock', 'poetry.lock'
  ]
  
  const fileName = path.basename(filePath)
  const extension = path.extname(filePath).toLowerCase()
  
  return analyzableExtensions.includes(extension) && 
         !skipFiles.includes(fileName) &&
         !filePath.includes('/test/') &&
         !filePath.includes('/__tests__/') &&
         !filePath.includes('.test.') &&
         !filePath.includes('.spec.')
}

/**
 * Clean up old repository clones
 */
export async function cleanupOldRepositories(): Promise<void> {
  try {
    const entries = await fs.readdir(STORAGE_BASE_PATH, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const ownerPath = path.join(STORAGE_BASE_PATH, entry.name)
        const repos = await fs.readdir(ownerPath, { withFileTypes: true })
        
        for (const repo of repos) {
          if (repo.isDirectory()) {
            const repoPath = path.join(ownerPath, repo.name)
            const stats = await fs.stat(repoPath)
            const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
            
            if (ageHours > CLEANUP_AFTER_HOURS) {
              console.log(`🗑️ Cleaning up old repository: ${entry.name}/${repo.name}`)
              await fs.rm(repoPath, { recursive: true, force: true })
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup old repositories:', error)
  }
}

/**
 * Get file content from cloned repository
 */
export async function getFileContent(clonePath: string, relativePath: string): Promise<string> {
  const fullPath = path.join(clonePath, relativePath)
  
  try {
    // Check if file exists first
    await fs.access(fullPath)
    const content = await fs.readFile(fullPath, 'utf8')
    return content
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`File not found: ${relativePath}`)
    }
    throw new Error(`Failed to read file ${relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
