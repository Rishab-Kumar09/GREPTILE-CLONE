import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('🔍 DEBUG PROFILE CALL:')
    console.log('- URL:', request.url)
    console.log('- Method:', request.method)
    console.log('- UserId param:', userId)
    console.log('- Headers:', Object.fromEntries(request.headers.entries()))
    console.log('- Referrer:', request.headers.get('referer'))
    
    return NextResponse.json({
      success: true,
      debug: {
        url: request.url,
        method: request.method,
        userId: userId,
        hasUserId: !!userId,
        referrer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent')
      }
    })
    
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
