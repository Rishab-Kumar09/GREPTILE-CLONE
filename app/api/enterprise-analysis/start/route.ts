import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  
  // SIMPLE TEST - just return immediately
  return NextResponse.json({
    success: true,
    message: 'ROUTE IS WORKING!',
    timestamp: Date.now()
  })
}