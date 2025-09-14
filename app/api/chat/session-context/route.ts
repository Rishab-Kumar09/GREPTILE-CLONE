import { NextRequest, NextResponse } from 'next/server'

// Global type declaration for session contexts
declare global {
  var sessionContexts: Map<string, any>;
}

// Session-based context storage (auto-cleanup)
export async function POST(request: NextRequest) {
  try {
    const sessionContext = await request.json()
    
    console.log(`📥 Storing session context for ${sessionContext.repository}`)
    console.log(`📊 Context size: ${Math.round(JSON.stringify(sessionContext).length / 1024)}KB`)
    console.log(`📊 Files: ${Object.keys(sessionContext.files).length}, Functions: ${Object.keys(sessionContext.symbols.functions).length}`)
    
    // Store in session-based cache (memory with TTL)
    await storeSessionContext(sessionContext)
    
    return NextResponse.json({ 
      success: true,
      contextSize: JSON.stringify(sessionContext).length,
      filesCount: Object.keys(sessionContext.files).length,
      functionsCount: Object.keys(sessionContext.symbols.functions).length
    })
  } catch (error) {
    console.error('❌ Failed to store session context:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// Get session context
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const repository = searchParams.get('repository')
    
    if (!sessionId && !repository) {
      return NextResponse.json({ error: 'sessionId or repository required' }, { status: 400 })
    }
    
    const context = await getSessionContext(sessionId || undefined, repository || undefined)
    
    if (!context) {
      return NextResponse.json({ error: 'Session context not found' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      success: true, 
      context,
      contextSize: JSON.stringify(context).length
    })
  } catch (error) {
    console.error('❌ Failed to get session context:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// Session-based storage with auto-cleanup
async function storeSessionContext(context: any) {
  // Initialize global session storage
  if (!global.sessionContexts) {
    console.log('⚠️ Creating new sessionContexts Map - this means we lost previous context!')
    global.sessionContexts = new Map()
  } else {
    console.log('✅ Using existing sessionContexts Map')
    console.log('🗝️ Current keys:', Array.from(global.sessionContexts.keys()))
  }
  
  // Store with TTL (2 hours)
  const key = context.analysisId || context.sessionId || `repo:${context.repository}`
  console.log('🔑 Storing context with key:', key)
  global.sessionContexts.set(key, {
    ...context,
    expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
  })
  
  // Cleanup expired sessions
  cleanupExpiredSessions()
  
  console.log(`✅ Session context stored: ${context.sessionId}`)
}

// Get session context by ID or repository
async function getSessionContext(sessionId?: string, repository?: string) {
  if (!global.sessionContexts) {
    return null
  }
  
  const key = sessionId || `repo:${repository}`
  const session = global.sessionContexts.get(key)
  
  if (!session) {
    return null
  }
  
  // Check if expired
  if (session.expiresAt < Date.now()) {
    global.sessionContexts.delete(key)
    return null
  }
  
  return session
}

// Auto-cleanup expired sessions
function cleanupExpiredSessions() {
  if (!global.sessionContexts) return
  
  const now = Date.now()
  let cleanedCount = 0
  
  for (const [key, session] of Array.from(global.sessionContexts.entries())) {
    if (session.expiresAt < now) {
      global.sessionContexts.delete(key)
      cleanedCount++
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🗑️ Cleaned up ${cleanedCount} expired session contexts`)
  }
}

// Endpoint to get context for Quick Analysis page
export async function PUT(request: NextRequest) {
  try {
    const { repository } = await request.json()
    
    if (!repository) {
      return NextResponse.json({ error: 'repository required' }, { status: 400 })
    }
    
    const context = await getSessionContext(undefined, repository)
    
    return NextResponse.json({ 
      success: true, 
      context,
      available: !!context
    })
  } catch (error) {
    console.error('❌ Failed to check session context:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
