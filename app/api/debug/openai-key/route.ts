import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    
    console.log('🔍 DEBUG: Checking OpenAI key access...')
    console.log('🔍 DEBUG: OPENAI_API_KEY exists:', !!openaiKey)
    console.log('🔍 DEBUG: OPENAI_API_KEY length:', openaiKey ? openaiKey.length : 0)
    console.log('🔍 DEBUG: OPENAI_API_KEY starts with:', openaiKey ? openaiKey.substring(0, 10) + '...' : 'N/A')
    
    return NextResponse.json({
      success: true,
      hasKey: !!openaiKey,
      keyLength: openaiKey ? openaiKey.length : 0,
      keyPreview: openaiKey ? openaiKey.substring(0, 10) + '...' : 'N/A',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('🔍 DEBUG: Error checking OpenAI key:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 