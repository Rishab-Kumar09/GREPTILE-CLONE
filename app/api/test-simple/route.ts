import { NextResponse } from 'next/server'

export async function GET() {
  console.log('🧪 TEST SIMPLE ROUTE CALLED!')
  console.log('🧪 TEST SIMPLE ROUTE CALLED!')
  console.log('🧪 TEST SIMPLE ROUTE CALLED!')
  return NextResponse.json({ message: 'Simple test works!' })
}

export async function POST() {
  console.log('🧪 TEST SIMPLE POST CALLED!')
  console.log('🧪 TEST SIMPLE POST CALLED!')
  console.log('🧪 TEST SIMPLE POST CALLED!')
  return NextResponse.json({ message: 'Simple POST test works!' })
}
