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
    
    for (const [token, session] of global.userSessions.entries()) {
      if (session.timestamp < oneWeekAgo) {
        global.userSessions.delete(token)
        cleanedCount++
        console.log('🗑️ CLEANUP: Removed old session for user:', session.userId)
      }
    }
    
    console.log(`✅ CLEANUP: Cleaned up ${cleanedCount} orphaned sessions. Active sessions: ${global.userSessions.size}`)
  }, 24 * 60 * 60 * 1000) // Check daily (24 hours)
  
  console.log('🔄 SESSION CLEANUP: Periodic cleanup initialized (runs daily)')
}

export async function POST(request: NextRequest) {
  try {
    const { sessionToken } = await request.json()
    
    if (!sessionToken) {
      return NextResponse.json({
        success: false,
        error: 'Session token is required'
      }, { status: 400 })
    }

    console.log('🔍 SESSION: Validating session token...')
    
    // Check if session exists and is valid
    const session = global.userSessions.get(sessionToken)
    
    if (!session) {
      console.log('❌ SESSION: Session token not found')
      return NextResponse.json({
        success: false,
        error: 'Invalid session token'
      }, { status: 401 })
    }

    // 🔄 NEVER EXPIRE: Sessions persist until manually logged out
    // No expiration check - sessions last forever for better UX
    console.log('✅ SESSION: Never-expiring session found (age:', Math.floor((Date.now() - session.timestamp) / (1000 * 60 * 60)), 'hours)')

    console.log('✅ SESSION: Valid session found for user:', session.userId)
    
    return NextResponse.json({
      success: true,
      userId: session.userId,
      email: session.email,
      timestamp: session.timestamp
    })

  } catch (error) {
    console.error('❌ SESSION VALIDATION ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to validate session'
    }, { status: 500 })
  }
}

// Helper function to create session
export async function createSession(userId: string, email: string): Promise<string> {
  const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  
  global.userSessions.set(sessionToken, {
    userId,
    email,
    timestamp: Date.now()
  })
  
  console.log('✅ SESSION: Created new session for user:', userId)
  return sessionToken
}

// Helper function to destroy session
export async function destroySession(sessionToken: string): Promise<void> {
  global.userSessions.delete(sessionToken)
  console.log('🗑️ SESSION: Destroyed session')
}
