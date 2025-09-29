import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 DEBUG: Fetching all user profiles...')
    
    // Get all user profiles using raw query
    const users = await prisma.$queryRaw`
      SELECT id, name, email, "githubConnected", "githubUsername", "createdAt"
      FROM "UserProfile"
    ` as any[]
    
    console.log(`✅ DEBUG: Found ${users.length} user profiles`)
    
    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      users
    })
    
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
