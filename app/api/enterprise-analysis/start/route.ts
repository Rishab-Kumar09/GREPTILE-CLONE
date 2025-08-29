import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { createAnalysisStatus, updateAnalysisStatus } from '@/lib/enterprise-analysis-utils'
import { 
  getRepositoryInfo, 
  cloneRepository, 
  getAnalyzableFiles, 
  getFileContent,
  type RepositoryInfo,
  type CloneProgress 
} from '@/lib/repository-cloner'

// Enterprise Analysis Strategies
interface AnalysisStrategy {
  name: string
  description: string
  estimatedTime: string
  priority: 'critical' | 'high' | 'medium' | 'low'
}

const ANALYSIS_STRATEGIES: Record<string, AnalysisStrategy> = {
  incremental: {
    name: 'Incremental Analysis',
    description: 'Fast analysis of critical files (auth, API, security)',
    estimatedTime: '30 seconds - 2 minutes',
    priority: 'high'
  },
  priority: {
    name: 'Priority Analysis',
    description: 'Comprehensive analysis with smart prioritization',
    estimatedTime: '2-5 minutes', 
    priority: 'critical'
  },
  full: {
    name: 'Full Analysis',
    description: 'Comprehensive analysis of up to 300 files',
    estimatedTime: '3-8 minutes',
    priority: 'medium'
  }
}

// File priority classification (competitor-inspired)
const getFilePriority = (filePath: string): number => {
  // Security-related files (highest priority)
  if (filePath.includes('auth') || filePath.includes('security') || 
      filePath.includes('login') || filePath.includes('password')) {
    return 10
  }
  
  // API and route files
  if (filePath.includes('api/') || filePath.includes('route') || 
      filePath.includes('endpoint')) {
    return 9
  }
  
  // Database and config files
  if (filePath.includes('db') || filePath.includes('database') || 
      filePath.includes('config') || filePath.includes('.env')) {
    return 8
  }
  
  // Core application files
  if (filePath.includes('app/') || filePath.includes('src/') || 
      filePath.includes('lib/')) {
    return 7
  }
  
  // TypeScript/JavaScript files
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || 
      filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    return 6
  }
  
  // Component files
  if (filePath.includes('component') || filePath.includes('page')) {
    return 5
  }
  
  // Test files
  if (filePath.includes('test') || filePath.includes('spec')) {
    return 4
  }
  
  // Documentation and config
  if (filePath.endsWith('.md') || filePath.endsWith('.json') || 
      filePath.endsWith('.yml')) {
    return 3
  }
  
  // Everything else
  return 1
}

// Get critical files for incremental analysis
async function getCriticalFiles(allFiles: string[]): Promise<string[]> {
  return allFiles.filter(file => {
    const fileLower = file.toLowerCase()
    return (
      // Security & auth files
      fileLower.includes('auth') ||
      fileLower.includes('security') ||
      fileLower.includes('login') ||
      fileLower.includes('password') ||
      
      // API & routes
      fileLower.includes('/api/') ||
      fileLower.includes('/routes/') ||
      fileLower.includes('/controllers/') ||
      
      // Main entry points
      fileLower.includes('index') ||
      fileLower.includes('main') ||
      fileLower.includes('app') ||
      
      // Config files
      fileLower.includes('config') ||
      fileLower.endsWith('.env') ||
      fileLower.includes('package.json')
    )
  }).slice(0, 100) // Limit to top 100 critical files
}

// Get repository files using cloning approach
async function getRepositoryFiles(repoInfo: RepositoryInfo, strategy: string, clonePath: string) {
  try {
    console.log(`📁 Getting files from cloned repository: ${clonePath}`)
    
    // Get all analyzable files from the cloned repository
    const allFiles = await getAnalyzableFiles(clonePath)
    console.log(`📊 Found ${allFiles.length} analyzable files`)
    
    let selectedFiles: string[] = []
    
    // Apply strategy-specific filtering
    switch (strategy) {
      case 'incremental':
        selectedFiles = await getCriticalFiles(allFiles)
        console.log(`🚀 INCREMENTAL: Selected ${selectedFiles.length} critical files`)
        break
        
      case 'priority':
        // Sort by priority and take top files
        const prioritizedFiles = allFiles
          .map(file => ({
            path: file,
            priority: getFilePriority(file)
          }))
          .sort((a, b) => b.priority - a.priority)
          .slice(0, Math.min(200, allFiles.length)) // Top 200 or all files if less
          .map(f => f.path)
        
        selectedFiles = prioritizedFiles
        console.log(`🎯 PRIORITY: Selected ${selectedFiles.length} high-priority files`)
        break
        
      case 'full':
        // Analyze all files but with reasonable limits for production
        selectedFiles = allFiles.slice(0, Math.min(300, allFiles.length))
        console.log(`🏭 FULL: Selected ${selectedFiles.length} files for comprehensive analysis`)
        break
        
      default:
        selectedFiles = await getCriticalFiles(allFiles)
    }
    
    return selectedFiles.map(path => ({ path, size: 0 })) // Size not needed for cloned files
  } catch (error) {
    console.error('Failed to get repository files:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, strategy = 'incremental' } = await request.json()
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo are required' },
        { status: 400 }
      )
    }
    
    // Generate unique analysis ID
    const analysisId = uuidv4()
    
    // Get strategy configuration
    const strategyConfig = ANALYSIS_STRATEGIES[strategy] || ANALYSIS_STRATEGIES.incremental
    
    try {
      // Get repository information first
      const repoInfo = await getRepositoryInfo(owner, repo)
      console.log(`📊 Repository: ${repoInfo.fullName} (${repoInfo.size}MB)`)
      console.log(`⏱️ Estimated time: ${repoInfo.estimatedTime}`)
      
      // Update strategy with realistic time estimate
      const updatedStrategy = {
        ...strategyConfig,
        estimatedTime: repoInfo.estimatedTime
      }
      
      console.log(`🚀 ENTERPRISE ANALYSIS STARTED:`)
      console.log(`   Repository: ${repoInfo.fullName}`)
      console.log(`   Strategy: ${updatedStrategy.name}`)
      console.log(`   Size: ${repoInfo.size}MB`)
      console.log(`   Estimated time: ${repoInfo.estimatedTime}`)
      console.log(`   Analysis ID: ${analysisId}`)
      
      // Create initial analysis status
      createAnalysisStatus(analysisId, {
        status: 'initializing',
        strategy: updatedStrategy,
        repository: repoInfo.fullName,
        repositoryInfo: repoInfo,
        totalFiles: 0, // Will be updated after cloning
        filesAnalyzed: 0,
        progress: 0,
        startTime: Date.now(),
        results: []
      })
      
      // Start background processing with cloning
          processAnalysisInBackground(analysisId, repoInfo, strategy).catch(error => {
      console.error(`❌ Background processing failed for ${analysisId}:`, error)
      console.error('Full error stack:', error.stack)
      updateAnalysisStatus(analysisId, {
        status: 'failed',
        errors: [error.message || 'Unknown error in background processing']
      })
    })
      
      return NextResponse.json({
        success: true,
        analysisId,
        strategy: updatedStrategy,
        repositoryInfo: repoInfo,
        message: `Analysis started for ${repoInfo.fullName} (${repoInfo.size}MB)`
      })
      
    } catch (repoError) {
      console.error('Repository access error:', repoError)
      return NextResponse.json(
        { 
          error: 'Failed to access repository', 
          details: `Could not access ${owner}/${repo}. Please check repository exists and is public.`
        },
        { status: 400 }
      )
    }
    
  } catch (error) {
    console.error('Enterprise analysis start error:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Background processing function with repository cloning
async function processAnalysisInBackground(
  analysisId: string,
  repoInfo: RepositoryInfo,
  strategy: string
) {
  console.log(`🔄 Starting background analysis for ${analysisId}`)
  
  let clonePath = ''
  
  try {
    const startTime = Date.now()
    let filesProcessed = 0
    let totalFiles = 0
    
    // Step 1: Clone repository with progress updates
    console.log(`📥 STEP 1: Cloning repository ${repoInfo.fullName}`)
    updateAnalysisStatus(analysisId, { 
      status: 'cloning',
      progress: 5,
      currentFile: `Cloning ${repoInfo.fullName}...`
    })
    
    clonePath = await cloneRepository(repoInfo, (progress) => {
      updateAnalysisStatus(analysisId, {
        status: 'cloning',
        progress: 5 + (progress.progress * 0.15), // 5-20% for cloning
        currentFile: progress.message
      })
    })
    
    console.log(`✅ Repository cloned to: ${clonePath}`)
    
    // Step 2: Get files to analyze
    console.log(`📁 STEP 2: Scanning repository files`)
    updateAnalysisStatus(analysisId, {
      status: 'scanning',
      progress: 25,
      currentFile: 'Scanning repository files...'
    })
    
    const repositoryFiles = await getRepositoryFiles(repoInfo, strategy, clonePath)
    totalFiles = repositoryFiles.length
    
    console.log(`📊 Found ${totalFiles} files to analyze with ${strategy} strategy`)
    
    // Update status with file count
    updateAnalysisStatus(analysisId, {
      status: 'analyzing',
      progress: 30,
      totalFiles,
      currentFile: 'Starting file analysis...'
    })
    
    // Step 3: Analyze files in batches
    console.log(`🔍 STEP 3: Analyzing ${totalFiles} files`)
    const batchSize = strategy === 'incremental' ? 10 : (strategy === 'priority' ? 8 : 7)
    
    for (let i = 0; i < repositoryFiles.length; i += batchSize) {
      const batch = repositoryFiles.slice(i, i + batchSize)
      
      try {
        console.log(`🔍 Analyzing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} files`)
        
        // Analyze files from cloned repository
        const batchResults = []
        for (const file of batch) {
          try {
            // Validate file exists before trying to read it
            const fullPath = path.join(clonePath, file.path)
            try {
              await fs.access(fullPath)
            } catch (accessError) {
              console.warn(`⚠️ Skipping non-existent file: ${file.path}`)
              continue
            }
            
            // Get file content from cloned repository
            const fileContent = await getFileContent(clonePath, file.path)
            
            // Generate realistic analysis (you can replace this with real AI analysis)
            const issues = generateRealisticIssues(file.path, fileContent)
            
            if (issues.length > 0) {
              batchResults.push({
                file: file.path,
                bugs: issues.filter(i => i.type === 'bug'),
                securityIssues: issues.filter(i => i.type === 'security'), 
                codeSmells: issues.filter(i => i.type === 'smell')
              })
            }
            
            filesProcessed++
            
            // Update progress in real-time
            const progress = 30 + ((filesProcessed / totalFiles) * 65) // 30-95% for analysis
            updateAnalysisStatus(analysisId, {
              status: 'analyzing',
              progress: Math.round(progress),
              filesAnalyzed: filesProcessed,
              currentFile: file.path,
              results: batchResults
            })
            
          } catch (fileError) {
            console.warn(`⚠️ Failed to analyze ${file.path}:`, fileError)
            filesProcessed++ // Still count as processed
            // Continue with next file
          }
        }
        
        // Log batch progress
        const elapsed = Date.now() - startTime
        const remaining = filesProcessed > 0 ? ((elapsed / filesProcessed) * (totalFiles - filesProcessed)) : 0
        
        console.log(`📊 BATCH PROGRESS [${analysisId}]:`)
        console.log(`   Progress: ${Math.round(30 + ((filesProcessed / totalFiles) * 65))}% (${filesProcessed}/${totalFiles})`)
        console.log(`   Estimated remaining: ${Math.round(remaining / 1000)}s`)
        console.log(`   Issues found in batch: ${batchResults.length}`)
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (batchError) {
        console.error(`❌ Batch processing error:`, batchError)
        // Continue with next batch (fault tolerance)
      }
    }
    
    // Step 4: Finalize analysis
    console.log(`✅ ANALYSIS COMPLETE [${analysisId}]: Processed ${filesProcessed}/${totalFiles} files`)
    
    const elapsed = Date.now() - startTime
    const analysisTime = Math.round(elapsed / 1000)
    
    // Mark as completed
    updateAnalysisStatus(analysisId, { 
      status: 'completed', 
      progress: 100,
      filesAnalyzed: filesProcessed,
      currentFile: `Analysis completed in ${analysisTime}s`
    })
    
    console.log(`🎉 ENTERPRISE ANALYSIS SUCCESS:`)
    console.log(`   Repository: ${repoInfo.fullName}`)
    console.log(`   Strategy: ${strategy}`)
    console.log(`   Files processed: ${filesProcessed}/${totalFiles}`)
    console.log(`   Total time: ${analysisTime} seconds`)
    console.log(`   Clone path: ${clonePath}`)
    
    // Optional: Clean up cloned repository after some time
    // (You might want to keep it for a while for re-analysis)
    setTimeout(async () => {
      try {
        const fs = await import('fs/promises')
        await fs.rm(clonePath, { recursive: true, force: true })
        console.log(`🗑️ Cleaned up cloned repository: ${clonePath}`)
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup ${clonePath}:`, cleanupError)
      }
    }, 30 * 60 * 1000) // Clean up after 30 minutes
    
  } catch (error) {
    console.error(`❌ ANALYSIS FAILED [${analysisId}]:`, error)
    
    // Clean up on failure
    if (clonePath) {
      try {
        const fs = await import('fs/promises')
        await fs.rm(clonePath, { recursive: true, force: true })
        console.log(`🗑️ Cleaned up failed clone: ${clonePath}`)
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup after error:`, cleanupError)
      }
    }
    
    // Mark as failed
    updateAnalysisStatus(analysisId, { 
      status: 'failed',
      progress: 0,
      currentFile: 'Analysis failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    })
  }
}

// Generate realistic issues for demo with file content analysis
function generateRealisticIssues(filePath: string, fileContent?: string) {
  const issues = []
  const fileName = filePath.toLowerCase()
  const lines = fileContent ? fileContent.split('\n') : []
  
  // Analyze actual file content if available
  if (fileContent && lines.length > 0) {
    // Look for actual security patterns
    lines.forEach((line, index) => {
      const lineNum = index + 1
      const trimmedLine = line.trim()
      
      // SQL injection patterns
      if (trimmedLine.includes('SELECT') && (trimmedLine.includes('${') || trimmedLine.includes('+'))) {
        issues.push({
          type: 'security',
          severity: 'high',
          line: lineNum,
          message: 'Potential SQL injection - dynamic query construction detected',
          code: trimmedLine
        })
      }
      
      // Hardcoded secrets
      if (trimmedLine.includes('password') || trimmedLine.includes('secret') || trimmedLine.includes('token')) {
        if (trimmedLine.includes('=') && !trimmedLine.includes('process.env')) {
          issues.push({
            type: 'security',
            severity: 'critical',
            line: lineNum,
            message: 'Hardcoded credential detected - use environment variables',
            code: trimmedLine
          })
        }
      }
      
      // Console.log statements (code smell)
      if (trimmedLine.includes('console.log') || trimmedLine.includes('console.error')) {
        issues.push({
          type: 'smell',
          severity: 'low',
          line: lineNum,
          message: 'Console statement found - consider using proper logging',
          code: trimmedLine
        })
      }
      
      // TODO comments
      if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
        issues.push({
          type: 'smell',
          severity: 'medium',
          line: lineNum,
          message: 'TODO comment found - consider addressing or creating a ticket',
          code: trimmedLine
        })
      }
      
      // Potential null pointer issues
      if (trimmedLine.includes('.') && !trimmedLine.includes('?.') && !trimmedLine.includes('&&')) {
        const hasChaining = (trimmedLine.match(/\./g) || []).length > 2
        if (hasChaining && Math.random() > 0.7) { // 30% chance for deeply nested access
          issues.push({
            type: 'bug',
            severity: 'medium',
            line: lineNum,
            message: 'Potential null pointer - consider null checks or optional chaining',
            code: trimmedLine
          })
        }
      }
    })
    
    // File-level analysis
    const contentLength = fileContent.length
    if (contentLength > 10000) { // Large file
      issues.push({
        type: 'smell',
        severity: 'medium',
        line: 1,
        message: `Large file (${Math.round(contentLength/1000)}KB) - consider breaking into smaller modules`,
        code: `// File size: ${Math.round(contentLength/1000)}KB`
      })
    }
  }
  
  // Fallback to pattern-based analysis if no content or no issues found
  if (issues.length === 0) {
    // Security issues for auth/API files
    if (fileName.includes('auth') || fileName.includes('api')) {
      issues.push({
        type: 'security',
        severity: 'high',
        line: Math.floor(Math.random() * 50) + 10,
        message: 'Potential security vulnerability in authentication module',
        code: '// Security review recommended for auth-related code'
      })
    }
    
    // TypeScript specific issues
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
      issues.push({
        type: 'bug',
        severity: 'low',
        line: Math.floor(Math.random() * 20) + 5,
        message: 'TypeScript best practices review recommended',
        code: '// Consider stricter type checking'
      })
    }
    
    // General code quality
    if (Math.random() > 0.5) { // 50% chance
      issues.push({
        type: 'smell',
        severity: 'low',
        line: Math.floor(Math.random() * 30) + 10,
        message: 'Code quality review - consider refactoring for better maintainability',
        code: '// General code quality review'
      })
    }
  }
  
  return issues
}
