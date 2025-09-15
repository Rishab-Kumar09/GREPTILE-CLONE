import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Types to match repository-files route
interface RepoMetadata {
  analysisId: string
  repository: string
  timestamp: number
  persistentPath: string
  filesCount: number
  totalIssues: number
  criticalIssues: number
}

interface FileContent {
  path: string
  content: string
  size: number
  type: string
}

// Global type declaration for caches
declare global {
  var sessionContexts: Map<string, any>
  var repositoryCache: Map<string, {
    metadata: RepoMetadata;
    files: Map<string, FileContent>;
    timestamp: number;
  }>
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting cache cleanup...')
    
    let sessionContextsCleared = 0
    let repositoryCacheCleared = 0
    
    // Clear session contexts
    if (global.sessionContexts && global.sessionContexts.size > 0) {
      sessionContextsCleared = global.sessionContexts.size
      global.sessionContexts.clear()
      console.log(`🗑️ Cleared ${sessionContextsCleared} session contexts`)
    }
    
    // Clear repository cache
    if (global.repositoryCache && global.repositoryCache.size > 0) {
      repositoryCacheCleared = global.repositoryCache.size
      global.repositoryCache.clear()
      console.log(`🗑️ Cleared ${repositoryCacheCleared} repository cache entries`)
    }
    
    // Reinitialize maps
    if (!global.sessionContexts) {
      global.sessionContexts = new Map()
    }
    if (!global.repositoryCache) {
      global.repositoryCache = new Map()
    }
    
    console.log('✅ Cache cleanup complete')
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      sessionContextsCleared,
      repositoryCacheCleared,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error during cache cleanup:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also support GET for manual testing
export async function GET() {
  try {
    const sessionContextsCount = global.sessionContexts?.size || 0
    const repositoryCacheCount = global.repositoryCache?.size || 0
    
    return NextResponse.json({
      success: true,
      currentCacheStatus: {
        sessionContexts: sessionContextsCount,
        repositoryCache: repositoryCacheCount
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error checking cache status:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check cache status'
    }, { status: 500 })
  }
}
