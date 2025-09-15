import { NextRequest, NextResponse } from 'next/server'

// Global type declaration for session contexts
declare global {
  var sessionContexts: Map<string, any>;
}

// Session-based context storage (supports batching)
export async function POST(request: NextRequest) {
  try {
    const sessionContext = await request.json()
    
    // Check if this is a batched request
    const isBatched = sessionContext.batchInfo && sessionContext.batchInfo.totalBatches > 1
    const batchInfo = sessionContext.batchInfo || { batchNumber: 1, totalBatches: 1, isLastBatch: true }
    
    console.log(`📥 Storing session context batch ${batchInfo.batchNumber}/${batchInfo.totalBatches} for ${sessionContext.repository}`)
    console.log(`📊 Context size: ${Math.round(JSON.stringify(sessionContext).length / 1024)}KB`)
    
    const filesCount = sessionContext.files ? 
      (Array.isArray(sessionContext.files) ? sessionContext.files.length : Object.keys(sessionContext.files).length) : 0
    const functionsCount = sessionContext.symbols?.functions ? Object.keys(sessionContext.symbols.functions).length : 0
    
    console.log(`📊 Files: ${filesCount}, Functions: ${functionsCount}`)
    
    if (isBatched) {
      await storeBatchedSessionContext(sessionContext, batchInfo)
    } else {
      // Store in session-based cache (memory with TTL)
      await storeSessionContext(sessionContext)
    }
    
    return NextResponse.json({ 
      success: true,
      contextSize: JSON.stringify(sessionContext).length,
      filesCount,
      functionsCount,
      batchInfo
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
  
  // Ensure we have all required fields
  const enhancedContext = {
    ...context,
    repository: context.repository,
    files: context.files || {},
    functions: context.functions || {},
    structure: {
      mainFiles: context.structure?.mainFiles || [],
      testFiles: context.structure?.testFiles || [],
      configFiles: context.structure?.configFiles || [],
      documentation: context.structure?.documentation || [],
      services: context.structure?.services || [],
      components: context.structure?.components || [],
      utils: context.structure?.utils || []
    },
    expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
  }
  
  global.sessionContexts.set(key, enhancedContext)
  
  // Log what we stored
  console.log('📊 Stored context stats:', {
    key,
    filesCount: Object.keys(enhancedContext.files).length,
    functionsCount: Object.keys(enhancedContext.functions).length,
    mainFiles: enhancedContext.structure.mainFiles.length
  })
  
  // Cleanup expired sessions
  cleanupExpiredSessions()
  
  console.log(`✅ Session context stored with key: ${key}`)
}

// Handle batched session context storage
async function storeBatchedSessionContext(context: any, batchInfo: any) {
  // Initialize global session storage
  if (!global.sessionContexts) {
    console.log('⚠️ Creating new sessionContexts Map - this means we lost previous context!')
    global.sessionContexts = new Map()
  }
  
  const key = context.analysisId || context.sessionId || `repo:${context.repository}`
  console.log(`🔑 Storing batch ${batchInfo.batchNumber}/${batchInfo.totalBatches} with key:`, key)
  
  // Get existing context or create new one
  let existingContext = global.sessionContexts.get(key) || {
    analysisId: context.analysisId,
    sessionId: context.sessionId,
    repository: context.repository,
    files: [],
    functions: context.functions || {},
    structure: context.structure || {
      mainFiles: [],
      testFiles: [],
      configFiles: [],
      documentation: [],
      services: [],
      components: [],
      utils: []
    },
    symbols: context.symbols || { functions: {} },
    expiresAt: Date.now() + (2 * 60 * 60 * 1000), // 2 hours
    batchInfo: {
      totalBatches: batchInfo.totalBatches,
      receivedBatches: []
    }
  }
  
  // Convert files to array if it's an object
  if (existingContext.files && !Array.isArray(existingContext.files)) {
    existingContext.files = Object.values(existingContext.files)
  }
  if (!existingContext.files) {
    existingContext.files = []
  }
  
  // Add files from current batch
  if (context.files && Array.isArray(context.files)) {
    existingContext.files.push(...context.files)
  }
  
  // Track received batches
  if (!existingContext.batchInfo.receivedBatches.includes(batchInfo.batchNumber)) {
    existingContext.batchInfo.receivedBatches.push(batchInfo.batchNumber)
  }
  
  // Update other fields from the latest batch
  existingContext.functions = { ...existingContext.functions, ...context.functions }
  existingContext.symbols = { 
    functions: { ...existingContext.symbols.functions, ...context.symbols?.functions }
  }
  
  // Store the updated context
  global.sessionContexts.set(key, existingContext)
  
  console.log(`📊 Batch ${batchInfo.batchNumber}/${batchInfo.totalBatches} stored:`, {
    key,
    totalFiles: existingContext.files.length,
    receivedBatches: existingContext.batchInfo.receivedBatches.length,
    isComplete: existingContext.batchInfo.receivedBatches.length === batchInfo.totalBatches
  })
  
  // If this is the last batch, finalize the context
  if (batchInfo.isLastBatch || existingContext.batchInfo.receivedBatches.length === batchInfo.totalBatches) {
    console.log(`✅ All batches received! Final context has ${existingContext.files.length} files`)
    
    // Convert files array back to object format for compatibility
    const filesObject: any = {}
    existingContext.files.forEach((file: any, index: number) => {
      const fileName = file.path || file.name || `file_${index}`
      filesObject[fileName] = file
    })
    existingContext.files = filesObject
    
    // Update the stored context
    global.sessionContexts.set(key, existingContext)
  }
  
  // Cleanup expired sessions
  cleanupExpiredSessions()
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
