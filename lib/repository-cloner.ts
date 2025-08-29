import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface RepositoryInfo {
  owner: string
  repo: string
  fullName: string
  clonePath: string
  size: number
  estimatedTime: string
}

export interface CloneProgress {
  stage: 'initializing' | 'cloning' | 'analyzing' | 'complete'
  progress: number
  message: string
  currentFile?: string
}

// Storage configuration
const STORAGE_BASE_PATH = process.env.REPO_STORAGE_PATH || '/tmp/greptile-repos'
const MAX_REPO_SIZE_MB = 1000 // 1GB limit per repository
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
 * Clone repository with progress tracking
 */
export async function cloneRepository(
  repoInfo: RepositoryInfo, 
  progressCallback?: (progress: CloneProgress) => void
): Promise<string> {
  const { owner, repo, clonePath, size } = repoInfo
  
  // Check size limits
  if (size > MAX_REPO_SIZE_MB) {
    throw new Error(`Repository too large (${size}MB). Maximum allowed: ${MAX_REPO_SIZE_MB}MB`)
  }
  
  try {
    // Create storage directory
    await fs.mkdir(path.dirname(clonePath), { recursive: true })
    
    progressCallback?.({
      stage: 'initializing',
      progress: 0,
      message: 'Preparing to clone repository...'
    })
    
    // Check if already cloned and recent
    const existingRepo = await checkExistingRepository(clonePath)
    if (existingRepo) {
      progressCallback?.({
        stage: 'complete',
        progress: 100,
        message: 'Using existing repository clone'
      })
      return clonePath
    }
    
    // Clean up any existing directory
    try {
      await fs.rm(clonePath, { recursive: true, force: true })
    } catch (error) {
      // Directory doesn't exist, that's fine
    }
    
    progressCallback?.({
      stage: 'cloning',
      progress: 10,
      message: `Cloning ${owner}/${repo}...`
    })
    
    // Clone with optimizations for analysis
    const cloneCommand = [
      'git clone',
      '--depth=1',                    // Shallow clone (recent commits only)
      '--single-branch',              // Only default branch
      '--filter=blob:limit=10m',      // Skip files larger than 10MB
      `https://github.com/${owner}/${repo}.git`,
      `"${clonePath}"`
    ].join(' ')
    
    console.log(`🔄 Executing: ${cloneCommand}`)
    
    const { stdout, stderr } = await execAsync(cloneCommand, {
      timeout: 300000, // 5 minute timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    })
    
    if (stderr && !stderr.includes('warning')) {
      console.warn('Git clone warnings:', stderr)
    }
    
    progressCallback?.({
      stage: 'analyzing',
      progress: 70,
      message: 'Repository cloned, preparing for analysis...'
    })
    
    // Post-clone optimizations
    await optimizeClonedRepository(clonePath)
    
    progressCallback?.({
      stage: 'complete',
      progress: 100,
      message: 'Repository ready for analysis'
    })
    
    console.log(`✅ Successfully cloned ${owner}/${repo} to ${clonePath}`)
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
 * Check if repository is already cloned and recent
 */
async function checkExistingRepository(clonePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(clonePath)
    const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
    
    // If less than 1 hour old, reuse it
    if (ageHours < 1) {
      // Verify it's a valid git repository
      await execAsync('git status', { cwd: clonePath })
      return true
    }
  } catch (error) {
    // Directory doesn't exist or not a valid repo
  }
  
  return false
}

/**
 * Optimize cloned repository for analysis
 */
async function optimizeClonedRepository(clonePath: string): Promise<void> {
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
    
    console.log(`🗜️ Optimized repository at ${clonePath}`)
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
    const content = await fs.readFile(fullPath, 'utf8')
    return content
  } catch (error) {
    throw new Error(`Failed to read file ${relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
