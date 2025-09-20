import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Access global session storage
declare global {
  var userSessions: Map<string, { userId: string; email: string; timestamp: number }>
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 MANUAL CLEANUP: Starting session cleanup...')
    
    if (!global.userSessions) {
      return NextResponse.json({
        success: true,
        message: 'No sessions to clean up',
        cleanedCount: 0,
        activeSessions: 0
      })
    }

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    let cleanedCount = 0
    const initialCount = global.userSessions.size
    
    Array.from(global.userSessions.entries()).forEach(([token, session]) => {
      if (session.timestamp < oneWeekAgo) {
        global.userSessions.delete(token)
        cleanedCount++
        console.log('🗑️ MANUAL CLEANUP: Removed old session for user:', session.userId)
      }
    })
    
    const remainingCount = global.userSessions.size
    
    console.log(`✅ MANUAL CLEANUP: Cleaned up ${cleanedCount} orphaned sessions`)
    console.log(`📊 MANUAL CLEANUP: ${initialCount} → ${remainingCount} active sessions`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} orphaned sessions`,
      cleanedCount,
      activeSessions: remainingCount,
      initialCount
    })

  } catch (error) {
    console.error('❌ MANUAL CLEANUP ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup sessions'
    }, { status: 500 })
  }
}

// GET endpoint to check session statistics
export async function GET(request: NextRequest) {
  try {
    if (!global.userSessions) {
      return NextResponse.json({
        totalSessions: 0,
        oldSessions: 0,
        activeSessions: 0
      })
    }

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    let oldSessions = 0
    
    Array.from(global.userSessions.entries()).forEach(([token, session]) => {
      if (session.timestamp < oneWeekAgo) {
        oldSessions++
      }
    })
    
    return NextResponse.json({
      totalSessions: global.userSessions.size,
      oldSessions: oldSessions,
      activeSessions: global.userSessions.size - oldSessions,
      cleanupThreshold: '7 days',
      nextAutoCleanup: 'Daily at server restart + 24h'
    })

  } catch (error) {
    console.error('❌ SESSION STATS ERROR:', error)
    return NextResponse.json({
      error: 'Failed to get session statistics'
    }, { status: 500 })
  }
}
