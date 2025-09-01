import { NextResponse } from 'next/server'

export async function GET() {
  console.log('🧪 TEST ENDPOINT HIT - NEW CODE IS LIVE!')
  
  return NextResponse.json({
    success: true,
    message: 'New code is deployed and working!',
    timestamp: new Date().toISOString()
  })
}