import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 DEBUG: Fetching all user profiles...')
    
    // Get all user profiles
    const users = await prisma.userProfile.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        githubConnected: true,
        githubUsername: true,
        createdAt: true
      }
    })
    
    console.log(`✅ DEBUG: Found ${users.length} user profiles`)
    
    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        githubConnected: user.githubConnected,
        githubUsername: user.githubUsername,
        createdAt: user.createdAt
      }))
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
