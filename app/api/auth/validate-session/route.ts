import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// Global session storage (in production, use Redis or database)
declare global {
  var userSessions: Map<string, { userId: string; email: string; timestamp: number }>
  var sessionCleanupInterval: NodeJS.Timeout
}

if (!global.userSessions) {
  global.userSessions = new Map()
}

// 🧹 SESSION CLEANUP: Periodic cleanup of orphaned sessions
// Clean up sessions older than 7 days to prevent memory buildup
if (!global.sessionCleanupInterval) {
  global.sessionCleanupInterval = setInterval(() => {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    let cleanedCount = 0
    
    console.log('🧹 CLEANUP: Starting periodic session cleanup...')
    
    Array.from(global.userSessions.entries()).forEach(([token, session]) => {
      if (session.timestamp < oneWeekAgo) {
        global.userSessions.delete(token)
        cleanedCount++
        console.log('🗑️ CLEANUP: Removed old session for user:', session.userId)
      }
    })
    
    console.log(`✅ CLEANUP: Cleaned up ${cleanedCount} orphaned sessions. Active sessions: ${global.userSessions.size}`)
  }, 24 * 60 * 60 * 1000) // Check daily (24 hours)
  
  console.log('🔄 SESSION CLEANUP: Periodic cleanup initialized (runs daily)')
}

export async function POST(request: NextRequest) {
  try {
    const { sessionToken } = await request.json()
    
    console.log('🎯 SESSION ENDPOINT: Request received for token validation')
    console.log('🔍 SESSION ENDPOINT: Token provided?', !!sessionToken)
    console.log('🔍 SESSION ENDPOINT: Token preview:', sessionToken?.substring(0, 15) + '...')
    
    if (!sessionToken) {
      console.log('❌ SESSION ENDPOINT: No session token provided')
      return NextResponse.json({
        success: false,
        error: 'Session token is required'
      }, { status: 400 })
    }

    console.log('🔍 SESSION ENDPOINT: Starting validation process...')
    
    // Use utility function for validation
    const { validateSession } = await import('@/lib/session-utils')
    const result = await validateSession(sessionToken)
    
    console.log('🔍 SESSION ENDPOINT: Validation result:', { 
      success: result.success, 
      hasUserId: !!result.userId, 
      error: result.error 
    })
    
    if (!result.success) {
      console.log('❌ SESSION ENDPOINT: Validation failed -', result.error)
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 401 })
    }

    console.log('✅ SESSION ENDPOINT: Validation successful for user:', result.userId)
    
    return NextResponse.json({
      success: true,
      userId: result.userId,
      email: result.email,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('❌ SESSION ENDPOINT: Unexpected error during validation:', error)
    console.error('❌ SESSION ENDPOINT: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to validate session'
    }, { status: 500 })
  }
}

// Helper functions moved to separate utility file to avoid Next.js route export conflicts
