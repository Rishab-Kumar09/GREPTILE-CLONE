import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createAnalysisStatus, updateAnalysisStatus } from '@/lib/enterprise-analysis-utils'

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
    description: 'Greptile-style: Only analyze changed files since last scan',
    estimatedTime: '30 seconds - 2 minutes',
    priority: 'high'
  },
  priority: {
    name: 'Priority Analysis',
    description: 'SonarQube-style: Critical files first, stream results',
    estimatedTime: '2-5 minutes', 
    priority: 'critical'
  },
  full: {
    name: 'Full Analysis',
    description: 'Complete analysis with background processing',
    estimatedTime: '5-30 minutes',
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

// Get changed files since last analysis (incremental approach)
async function getChangedFiles(owner: string, repo: string): Promise<string[]> {
  try {
    // In a real implementation, you'd:
    // 1. Get the last analysis timestamp from database
    // 2. Use GitHub API to get commits since that timestamp
    // 3. Extract changed files from those commits
    
    // For demo, we'll simulate this with recent commits
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Enterprise-Greptile-Clone'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    const commits = await response.json()
    const changedFiles = new Set<string>()
    
    // Get files from recent commits
    for (const commit of commits.slice(0, 3)) { // Last 3 commits
      try {
        const commitResponse = await fetch(commit.url, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Enterprise-Greptile-Clone'
          }
        })
        
        if (commitResponse.ok) {
          const commitData = await commitResponse.json()
          commitData.files?.forEach((file: any) => {
            if (file.status !== 'removed') {
              changedFiles.add(file.filename)
            }
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch commit ${commit.sha}:`, error)
      }
    }
    
    return Array.from(changedFiles)
  } catch (error) {
    console.error('Failed to get changed files:', error)
    return []
  }
}

// Get repository files with priority sorting
async function getRepositoryFiles(owner: string, repo: string, strategy: string) {
  try {
    // Get all files from repository
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Enterprise-Greptile-Clone'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    const data = await response.json()
    let files = data.tree
      .filter((item: any) => item.type === 'blob')
      .filter((file: any) => {
        // Filter code files only
        const path = file.path.toLowerCase()
        return (
          path.endsWith('.ts') || path.endsWith('.tsx') ||
          path.endsWith('.js') || path.endsWith('.jsx') ||
          path.endsWith('.py') || path.endsWith('.java') ||
          path.endsWith('.cpp') || path.endsWith('.c') ||
          path.endsWith('.go') || path.endsWith('.rs') ||
          path.endsWith('.php') || path.endsWith('.rb')
        ) && !path.includes('node_modules') && !path.includes('.git')
      })
    
    // Apply strategy-specific filtering and sorting
    switch (strategy) {
      case 'incremental':
        const changedFiles = await getChangedFiles(owner, repo)
        if (changedFiles.length > 0) {
          files = files.filter((file: any) => 
            changedFiles.some(changed => 
              file.path === changed || file.path.endsWith(changed)
            )
          )
          console.log(`🚀 INCREMENTAL: Found ${files.length} changed files`)
        } else {
          // Fallback to recent files if no changes detected
          files = files.slice(0, 50)
          console.log(`🚀 INCREMENTAL: No changes detected, analyzing recent 50 files`)
        }
        break
        
      case 'priority':
        // Sort by priority (critical files first)
        files = files
          .map((file: any) => ({
            ...file,
            priority: getFilePriority(file.path)
          }))
          .sort((a: any, b: any) => b.priority - a.priority)
          .slice(0, 200) // Limit to top 200 priority files
        console.log(`🎯 PRIORITY: Analyzing top 200 priority files`)
        break
        
      case 'full':
        // For full analysis, we'll still limit to prevent timeouts
        files = files.slice(0, 500)
        console.log(`🏭 FULL: Analyzing up to 500 files`)
        break
    }
    
    return files
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
    console.log(`🔍 DEBUG: Received strategy: "${strategy}"`)
    console.log(`🔍 DEBUG: Available strategies:`, Object.keys(ANALYSIS_STRATEGIES))
    const strategyConfig = ANALYSIS_STRATEGIES[strategy] || ANALYSIS_STRATEGIES.incremental
    console.log(`🔍 DEBUG: Selected config:`, strategyConfig)
    
    // Get files to analyze based on strategy
    let files: any[] = []
    try {
      files = await getRepositoryFiles(owner, repo, strategy)
    } catch (repoError) {
      console.error('Repository access error:', repoError)
      return NextResponse.json(
        { 
          error: 'Failed to access repository', 
          details: `Could not fetch files from ${owner}/${repo}. Please check repository exists and is public.`,
          suggestion: 'Try a different repository or check your GitHub token.'
        },
        { status: 400 }
      )
    }
    
    console.log(`🚀 ENTERPRISE ANALYSIS STARTED:`)
    console.log(`   Repository: ${owner}/${repo}`)
    console.log(`   Strategy: ${strategyConfig.name}`)
    console.log(`   Files to analyze: ${files.length}`)
    console.log(`   Analysis ID: ${analysisId}`)
    
    // Create analysis status entry
    createAnalysisStatus(analysisId, files.length)
    
    // Start background processing (non-blocking)
    processAnalysisInBackground(analysisId, owner, repo, files, strategy)
    
    return NextResponse.json({
      analysisId,
      strategy: strategyConfig,
      filesCount: files.length,
      estimatedTime: strategyConfig.estimatedTime,
      message: `Analysis started with ${strategyConfig.name} strategy`
    })
    
  } catch (error) {
    console.error('Enterprise analysis start error:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Background processing function
async function processAnalysisInBackground(
  analysisId: string,
  owner: string,
  repo: string,
  files: any[],
  strategy: string
) {
  console.log(`🔄 Starting background analysis for ${analysisId}`)
  
  try {
    let filesProcessed = 0
    const totalFiles = files.length
    const startTime = Date.now()
    
    // Update status to processing
    updateAnalysisStatus(analysisId, { status: 'processing' })
    
    // Process files in small batches (like your existing system)
    const batchSize = strategy === 'incremental' ? 10 : (strategy === 'priority' ? 5 : 3)
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      
      try {
        // Use your existing robust batch analysis API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/github/analyze-repository-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner,
            repo,
            batchIndex: Math.floor(i / batchSize),
            batchSize: batch.length
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          filesProcessed += result.filesProcessed || batch.length
          
          // Calculate progress
          const progress = Math.round((filesProcessed / totalFiles) * 100)
          const elapsed = Date.now() - startTime
          const estimatedTotal = (elapsed / filesProcessed) * totalFiles
          const remaining = Math.max(0, estimatedTotal - elapsed)
          
          // Update analysis status
          updateAnalysisStatus(analysisId, {
            progress,
            filesAnalyzed: filesProcessed,
            currentFile: batch[0]?.path || '',
          })
          
          // Simulate WebSocket update (in real implementation, you'd use actual WebSocket)
          console.log(`📊 PROGRESS UPDATE [${analysisId}]:`)
          console.log(`   Progress: ${progress}% (${filesProcessed}/${totalFiles})`)
          console.log(`   Estimated remaining: ${Math.round(remaining / 1000)}s`)
          
          // Simulate streaming results
          if (result.analysisResults) {
            console.log(`📋 NEW RESULTS [${analysisId}]: Found ${result.totalIssues} issues in batch`)
          }
        }
        
        // Small delay between batches to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (batchError) {
        console.error(`❌ Batch ${Math.floor(i / batchSize)} failed:`, batchError)
        // Continue with next batch (fault tolerance)
      }
    }
    
    console.log(`✅ ANALYSIS COMPLETE [${analysisId}]: Processed ${filesProcessed}/${totalFiles} files`)
    
    // Mark as completed
    updateAnalysisStatus(analysisId, { 
      status: 'completed', 
      progress: 100,
      filesAnalyzed: filesProcessed
    })
    
  } catch (error) {
    console.error(`❌ ANALYSIS FAILED [${analysisId}]:`, error)
    
    // Mark as failed
    updateAnalysisStatus(analysisId, { 
      status: 'failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    })
  }
}
