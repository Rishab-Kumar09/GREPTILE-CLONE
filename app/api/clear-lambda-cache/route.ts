import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Clear cache request received')
    
    // Call Lambda with a special cache clear request
    const lambdaUrl = process.env.AWS_LAMBDA_URL
    if (!lambdaUrl) {
      console.error('❌ AWS_LAMBDA_URL not configured')
      return NextResponse.json({ error: 'Lambda URL not configured' }, { status: 500 })
    }

    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clearCache: true,
        timestamp: Date.now()
      })
    })

    if (response.ok) {
      console.log('✅ Cache clear request sent to Lambda')
      return NextResponse.json({ success: true, message: 'Cache clear request sent' })
    } else {
      console.error('❌ Lambda cache clear failed:', response.status)
      return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ Clear cache API error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
