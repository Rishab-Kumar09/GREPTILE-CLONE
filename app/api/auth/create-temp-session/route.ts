import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Global temporary session storage for OAuth flows
declare global {
  var tempSessions: Map<string, { purpose: string; timestamp: number }>
}

if (!global.tempSessions) {
  global.tempSessions = new Map()
}

export async function POST(request: NextRequest) {
  try {
    const { purpose } = await request.json()
    
    if (!purpose) {
      return NextResponse.json({
        success: false,
        error: 'Purpose is required for temporary session'
      }, { status: 400 })
    }

    console.log('🔄 TEMP SESSION: Creating temporary session for:', purpose)
    
    // Create temporary session token (expires in 10 minutes)
    const tempSession = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    global.tempSessions.set(tempSession, {
      purpose,
      timestamp: Date.now()
    })
    
    console.log('✅ TEMP SESSION: Created temporary session for OAuth flow')
    
    return NextResponse.json({
      success: true,
      tempSession: tempSession,
      purpose: purpose,
      expiresIn: '10 minutes'
    })

  } catch (error) {
    console.error('❌ TEMP SESSION ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create temporary session'
    }, { status: 500 })
  }
}

// Helper function moved to session-utils to avoid Next.js route export conflicts
