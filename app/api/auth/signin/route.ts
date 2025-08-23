import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    console.log('🔄 SIGNIN: Attempting to sign in user...')
    console.log('Email:', email)
    
    // Generate user ID from email (same as signup)
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-')
    
    // Find user profile
    const user = await prisma.userProfile.findUnique({
      where: { id: userId }
    })
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No account found with this email. Please sign up first.'
      }, { status: 404 })
    }
    
    console.log('✅ SIGNIN: User found successfully')
    console.log('User ID:', userId)
    console.log('User Name:', user.name)
    
    // Return user data for client-side session storage
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        company: user.company,
        profilePicture: user.profilePicture,
        githubConnected: user.githubConnected,
        githubUsername: user.githubUsername
      }
    })
    
  } catch (error) {
    console.error('❌ SIGNIN ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to sign in',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 