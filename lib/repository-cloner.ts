import fs from 'fs/promises'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
const StreamZip = require('node-stream-zip')

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
  console.log(`🔍 STEP 1A: Getting repository info for ${owner}/${repo}`)
  
  try {
    console.log(`🌐 Making API call to: https://api.github.com/repos/${owner}/${repo}`)
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    console.log(`📡 API Response status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      console.error(`❌ API call failed: ${response.status} ${response.statusText}`)
      throw new Error(`Repository not found: ${owner}/${repo}`)
    }
    
    console.log(`📦 Parsing response JSON...`)
    const repoData = await response.json()
    const sizeMB = repoData.size / 1024 // GitHub returns size in KB
    
    console.log(`📊 Repository data:`, {
      name: repoData.full_name,
      size: `${sizeMB.toFixed(2)}MB`,
      language: repoData.language,
      private: repoData.private
    })
    
    const repoInfo = {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      clonePath: path.join(STORAGE_BASE_PATH, owner, repo),
      size: sizeMB,
      estimatedTime: getEstimatedAnalysisTime(sizeMB, repoData.language)
    }
    
    console.log(`✅ STEP 1A COMPLETE: Repository info gathered`, repoInfo)
    return repoInfo
  } catch (error) {
    console.error(`❌ STEP 1A FAILED: Error getting repository info:`, error)
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
/**
 * Get ALL analyzable files from repository (NO LIMITS!)
 */
export async function getAllAnalyzableFiles(archivePath: string): Promise<string[]> {
  console.log(`🚀 Getting ALL files for complete analysis - NO LIMITS!`)
  
  try {
    const zip = new StreamZip.async({ file: archivePath })
    const entries = await zip.entries()
    const entryNames = Object.keys(entries)
    
    // Find GitHub root directory
    let rootDir = ''
    if (entryNames.length > 0) {
      const firstEntry = entryNames[0]
      const pathParts = firstEntry.split('/')
      if (pathParts.length > 1) {
        rootDir = pathParts[0] + '/'
      }
    }
    
    // Get ALL code files (filter out binaries, images, etc.)
    const analyzableExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
      '.py', '.pyx', '.pyi',
      '.java', '.kt', '.scala',
      '.go', '.mod',
      '.rs', '.toml',
      '.php', '.phtml',
      '.rb', '.rake', '.gemspec',
      '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
      '.cs', '.vb',
      '.swift', '.m', '.mm',
      '.dart',
      '.lua',
      '.sh', '.bash', '.zsh', '.fish',
      '.sql', '.psql', '.mysql',
      '.html', '.htm', '.xml', '.xhtml',
      '.css', '.scss', '.sass', '.less',
      '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
      '.md', '.txt', '.rst', '.adoc',
      '.dockerfile', '.dockerignore',
      '.gitignore', '.gitattributes',
      '.env', '.envrc',
      '.makefile', '.cmake',
      '.gradle', '.maven', '.sbt',
      '.package', '.lock', '.sum'
    ]
    
    const allFiles = entryNames
      .filter(name => !entries[name].isDirectory) // Only files
      .map(name => rootDir ? name.replace(rootDir, '') : name) // Remove root dir
      .filter(name => name.length > 0) // Remove empty paths
      .filter(name => {
        // Include files with analyzable extensions OR important config files
        const lowerName = name.toLowerCase()
        const hasAnalyzableExt = analyzableExtensions.some(ext => lowerName.endsWith(ext))
        const isConfigFile = /^(package\.json|composer\.json|requirements\.txt|gemfile|cargo\.toml|pom\.xml|build\.gradle|dockerfile|docker-compose\.yml|makefile|cmake|\.env|\.gitignore)$/i.test(name.split('/').pop() || '')
        const isImportantFile = /^(readme|license|changelog|contributing|security|api|index|main|app|server|config)/i.test(name.split('/').pop() || '')
        
        return hasAnalyzableExt || isConfigFile || isImportantFile
      })
      .filter(name => {
        // Exclude common non-analyzable paths
        const excludePatterns = [
          /node_modules\//,
          /\.git\//,
          /vendor\//,
          /build\//,
          /dist\//,
          /target\//,
          /\.next\//,
          /\.nuxt\//,
          /coverage\//,
          /\.nyc_output\//,
          /\.pytest_cache\//,
          /__pycache__\//,
          /\.vscode\//,
          /\.idea\//,
          /\.DS_Store/,
          /thumbs\.db/i,
          /\.log$/,
          /\.tmp$/,
          /\.temp$/,
          /\.cache$/,
          /\.min\.(js|css)$/,
          /\.bundle\.(js|css)$/,
          /\.chunk\.(js|css)$/
        ]
        
        return !excludePatterns.some(pattern => pattern.test(name))
      })
    
    await zip.close()
    
    console.log(`🎯 Found ${allFiles.length} analyzable files - ANALYZING ALL OF THEM!`)
    console.log(`📋 Sample files:`, allFiles.slice(0, 10).join(', '), allFiles.length > 10 ? '...' : '')
    
    return allFiles
    
  } catch (error) {
    console.error(`❌ Failed to get all files:`, error)
    return []
  }
}

export async function cloneRepository(
  repoInfo: RepositoryInfo, 
  progressCallback?: (progress: CloneProgress) => void
): Promise<string> {
  const { owner, repo, clonePath, size } = repoInfo
  
  console.log(`🔍 STEP 1B: Starting repository clone for ${owner}/${repo}`)
  console.log(`📊 Repository size: ${size}MB (limit: ${MAX_REPO_SIZE_MB}MB)`)
  console.log(`📁 Target path: ${clonePath}`)
  
  // Check size limits (more generous for archive downloads)
  if (size > MAX_REPO_SIZE_MB) {
    console.error(`❌ Repository too large: ${size}MB > ${MAX_REPO_SIZE_MB}MB`)
    throw new Error(`Repository too large (${size}MB). Maximum allowed: ${MAX_REPO_SIZE_MB}MB`)
  }
  
  try {
    console.log(`🔍 STEP 1B-1: Creating storage directory...`)
    // Create storage directory
    await fs.mkdir(path.dirname(clonePath), { recursive: true })
    console.log(`✅ Storage directory created: ${path.dirname(clonePath)}`)
    
    progressCallback?.({
      stage: 'initializing',
      progress: 0,
      message: 'Preparing to download repository...'
    })
    
    console.log(`🔍 STEP 1B-2: Checking for existing repository...`)
    // Check if already downloaded and recent
    const existingRepo = await checkExistingRepository(clonePath)
    if (existingRepo) {
      console.log(`♻️ Using existing repository at: ${clonePath}`)
      progressCallback?.({
        stage: 'complete',
        progress: 100,
        message: 'Using existing repository download'
      })
      return clonePath
    }
    console.log(`📝 No existing repository found, proceeding with download`)
    
    console.log(`🔍 STEP 1B-3: Cleaning up any existing directory...`)
    // Clean up any existing directory
    try {
      await fs.rm(clonePath, { recursive: true, force: true })
      console.log(`✅ Existing directory cleaned up`)
    } catch (error) {
      console.log(`📝 No existing directory to clean up (this is normal)`)
    }
    
    console.log(`🔍 STEP 1B-4: Starting archive download...`)
    // Download repository archive
    const archivePath = await downloadRepositoryArchive(owner, repo, clonePath, progressCallback)
    console.log(`✅ Archive downloaded successfully: ${archivePath}`)
    
    console.log(`🔍 STEP 1B-5: Starting archive extraction...`)
    // Extract archive
    await extractRepositoryArchive(archivePath, clonePath, progressCallback)
    console.log(`✅ Archive extracted successfully to: ${clonePath}`)
    
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
export async function downloadRepositoryArchive(
  owner: string, 
  repo: string, 
  basePath: string, 
  progressCallback?: (progress: CloneProgress) => void
): Promise<string> {
  const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`
  const archivePath = path.join(basePath, `${repo}.zip`)
  
  console.log(`🔍 STEP 1B-4A: Preparing archive download`)
  console.log(`🌐 Archive URL: ${archiveUrl}`)
  console.log(`📁 Archive path: ${archivePath}`)
  
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
 * Extract specific files from repository archive (selective extraction)
 */
export async function extractSelectiveFiles(
  archivePath: string,
  targetFiles: string[],
  extractPath: string,
  progressCallback?: (progress: CloneProgress) => void
): Promise<string[]> {
  console.log(`📂 Selective extraction: ${targetFiles.length} files from archive`)
  
  progressCallback?.({
    stage: 'extracting',
    progress: 85,
    message: `Extracting ${targetFiles.length} important files...`
  })
  
  const extractedFiles: string[] = []
  
  try {
    await fs.mkdir(extractPath, { recursive: true })
    
    console.log(`🔍 Opening ZIP for selective extraction...`)
    const zip = new StreamZip.async({ file: archivePath })
    
    const entries = await zip.entries()
    const entryNames = Object.keys(entries)
    
    // Find GitHub root directory
    let rootDir = ''
    if (entryNames.length > 0) {
      const firstEntry = entryNames[0]
      const pathParts = firstEntry.split('/')
      if (pathParts.length > 1) {
        rootDir = pathParts[0] + '/'
      }
    }
    console.log(`📁 GitHub root directory: ${rootDir || 'none'}`)
    
    // Extract only the files we need
    let extractedCount = 0
    for (const targetFile of targetFiles) {
      try {
        // Find the file in the ZIP (accounting for GitHub root directory)
        const possiblePaths = [
          targetFile,
          rootDir + targetFile,
          rootDir + targetFile.replace(/^\//, '')
        ]
        
        let foundEntry = null
        let foundPath = ''
        
        for (const possiblePath of possiblePaths) {
          if (entries[possiblePath] && !entries[possiblePath].isDirectory) {
            foundEntry = entries[possiblePath]
            foundPath = possiblePath
            break
          }
        }
        
        if (foundEntry) {
          // Extract this specific file
          const outputPath = path.join(extractPath, targetFile.replace(/^\//, ''))
          const dir = path.dirname(outputPath)
          await fs.mkdir(dir, { recursive: true })
          
          const data = await zip.entryData(foundPath)
          await fs.writeFile(outputPath, data)
          
          extractedFiles.push(targetFile)
          extractedCount++
          
          console.log(`✅ Extracted: ${targetFile}`)
          
          // Update progress
          const progress = 85 + Math.round((extractedCount / targetFiles.length) * 10)
          progressCallback?.({
            stage: 'extracting',
            progress,
            message: `Extracted ${extractedCount} / ${targetFiles.length} files`,
            extractedFiles: extractedCount,
            totalFiles: targetFiles.length
          })
        } else {
          console.warn(`⚠️ File not found in archive: ${targetFile}`)
        }
      } catch (fileError) {
        console.warn(`⚠️ Failed to extract ${targetFile}:`, fileError)
      }
    }
    
    await zip.close()
    console.log(`✅ Selective extraction complete: ${extractedCount}/${targetFiles.length} files`)
    
    return extractedFiles
    
  } catch (error) {
    console.error(`❌ Selective extraction failed:`, error)
    throw new Error(`Failed to extract files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
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
    
    // Try node-stream-zip first, fallback to system unzip if it fails
    console.log(`🔍 STEP 1B-5A: Starting ZIP extraction`)
    console.log(`📦 Archive path: ${archivePath}`)
    console.log(`📁 Extract path: ${extractPath}`)
    
    try {
      console.log(`🔍 STEP 1B-5A-1: Attempting node-stream-zip extraction...`)
      const zip = new StreamZip.async({ file: archivePath })
      
      console.log(`✅ ZIP file opened successfully`)
      console.log(`🔍 STEP 1B-5A-2: Getting entries...`)
      const entries = await zip.entries()
      const entryNames = Object.keys(entries)
      const totalEntries = entryNames.length
      let extractedCount = 0
      
      console.log(`📦 Found ${totalEntries} files in archive`)
      
      // Find the root directory (GitHub creates a directory with commit hash)
      let rootDir = ''
      if (totalEntries > 0) {
        const firstEntry = entryNames[0]
        const pathParts = firstEntry.split('/')
        if (pathParts.length > 1) {
          rootDir = pathParts[0] + '/'
        }
      }
      console.log(`📁 Root directory: ${rootDir || 'none'}`)
      
      // Extract all files
      for (const entryName of entryNames) {
        const entry = entries[entryName]
        
        // Skip the root directory itself and calculate relative path
        let relativePath = entryName
        if (rootDir && entryName.startsWith(rootDir)) {
          relativePath = entryName.substring(rootDir.length)
        }
        
        // Skip empty paths (root directory)
        if (!relativePath) {
          extractedCount++
          continue
        }
        
        const outputPath = path.join(extractPath, relativePath)
        
        if (entry.isDirectory) {
          // Create directory
          await fs.mkdir(outputPath, { recursive: true })
        } else {
          // Extract file
          const dir = path.dirname(outputPath)
          await fs.mkdir(dir, { recursive: true })
          
          // Extract file content
          const data = await zip.entryData(entryName)
          await fs.writeFile(outputPath, data)
        }
        
        extractedCount++
        
        // Update progress every 100 files
        if (extractedCount % 100 === 0 || extractedCount === totalEntries) {
          const progress = 85 + Math.round((extractedCount / totalEntries) * 10) // 85-95%
          console.log(`📊 Extraction progress: ${extractedCount}/${totalEntries} (${progress}%)`)
          progressCallback?.({
            stage: 'extracting',
            progress,
            message: `Extracted ${extractedCount} / ${totalEntries} files`,
            extractedFiles: extractedCount,
            totalFiles: totalEntries
          })
        }
      }
      
      await zip.close()
      console.log(`✅ Successfully extracted ${extractedCount} files`)
      
    } catch (zipError) {
      console.error(`❌ node-stream-zip extraction failed:`, zipError)
      console.log(`🔄 Attempting fallback extraction with system unzip...`)
      
      try {
        // Fallback to system unzip command
        const { execSync } = require('child_process')
        
        // Create a temporary directory for extraction
        const tempExtractPath = path.join(extractPath, 'temp_extract')
        await fs.mkdir(tempExtractPath, { recursive: true })
        
        console.log(`🔍 FALLBACK: Using system unzip command...`)
        
        // Use system unzip command (works on Linux/Unix systems like AWS Lambda)
        execSync(`unzip -q "${archivePath}" -d "${tempExtractPath}"`, { 
          stdio: 'pipe',
          timeout: 300000 // 5 minute timeout
        })
        
        console.log(`✅ System unzip completed successfully`)
        
        // Find the extracted directory (GitHub creates a directory with commit hash)
        const extractedContents = await fs.readdir(tempExtractPath, { withFileTypes: true })
        const extractedDirs = extractedContents.filter(entry => entry.isDirectory())
        
        if (extractedDirs.length === 1) {
          // Move contents from the GitHub root directory to our target
          const githubRootPath = path.join(tempExtractPath, extractedDirs[0].name)
          const rootContents = await fs.readdir(githubRootPath, { withFileTypes: true })
          
          let fileCount = 0
          for (const item of rootContents) {
            const sourcePath = path.join(githubRootPath, item.name)
            const targetPath = path.join(extractPath, item.name)
            
            await fs.rename(sourcePath, targetPath)
            fileCount++
            
            // Update progress periodically
            if (fileCount % 50 === 0) {
              progressCallback?.({
                stage: 'extracting',
                progress: 85 + Math.round((fileCount / rootContents.length) * 10),
                message: `Extracted ${fileCount} / ${rootContents.length} items`,
                extractedFiles: fileCount,
                totalFiles: rootContents.length
              })
            }
          }
          
          console.log(`✅ Successfully extracted ${fileCount} items using fallback method`)
        }
        
        // Clean up temporary directory
        await fs.rm(tempExtractPath, { recursive: true, force: true })
        
      } catch (fallbackError) {
        console.error(`❌ Fallback extraction also failed:`, fallbackError)
        throw new Error(`Both node-stream-zip and system unzip failed: ${zipError instanceof Error ? zipError.message : 'Unknown error'}`)
      }
    }
    
         // Find and flatten the GitHub root directory structure
     const dirEntries = await fs.readdir(extractPath, { withFileTypes: true })
     const rootDirs = dirEntries.filter(entry => entry.isDirectory())
    
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
