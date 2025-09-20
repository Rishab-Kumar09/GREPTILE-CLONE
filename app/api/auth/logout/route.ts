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
    
    // Use utility function to destroy session
    const { destroySession } = await import('@/lib/session-utils')
    await destroySession(sessionToken)

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
