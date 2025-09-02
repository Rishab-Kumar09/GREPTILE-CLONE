import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  console.log('🧪 TEST ROUTE CALLED!')
  return NextResponse.json({ message: 'Test route works!' })
}

export async function POST(request: NextRequest) {
  console.log('🧪 TEST POST ROUTE CALLED!')
  const body = await request.json()
  console.log('📦 Test body:', body)
  return NextResponse.json({ message: 'Test POST works!', received: body })
}
