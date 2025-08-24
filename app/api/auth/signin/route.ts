import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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
    
    // Validate password
    if (!user.password) {
      console.log('⚠️ SIGNIN: User has no password set (legacy account)')
      return NextResponse.json({
        success: false,
        error: 'This account needs to be updated. Please contact support or sign up again.'
      }, { status: 400 })
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      console.log('❌ SIGNIN: Invalid password')
      return NextResponse.json({
        success: false,
        error: 'Invalid password. Please try again.'
      }, { status: 401 })
    }
    
    console.log('✅ SIGNIN: User found and password validated')
    console.log('User ID:', userId)
    console.log('User Name:', user.name)
    
    // Return user data for client-side session storage
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profileImage,
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