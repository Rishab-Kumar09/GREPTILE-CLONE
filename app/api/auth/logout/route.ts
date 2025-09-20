import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Access global session storage
declare global {
  var userSessions: Map<string, { userId: string; email: string; timestamp: number }>
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

    console.log('🚪 LOGOUT: Destroying session...')
    
    // Remove session from server-side storage
    const sessionExists = global.userSessions?.has(sessionToken)
    if (sessionExists) {
      const session = global.userSessions.get(sessionToken)
      global.userSessions.delete(sessionToken)
      console.log('✅ LOGOUT: Session destroyed for user:', session?.userId)
    } else {
      console.log('⚠️ LOGOUT: Session not found (already expired or invalid)')
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
      activeSessions: global.userSessions?.size || 0
    })

  } catch (error) {
    console.error('❌ LOGOUT ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to logout'
    }, { status: 500 })
  }
}
