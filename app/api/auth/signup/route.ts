import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()
    
    console.log('🔄 SIGNUP: Creating new user profile...')
    console.log('Name:', name)
    console.log('Email:', email)
    
    // Generate a unique user ID based on email
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-')
    
    // Check if user already exists
    const existingUser = await prisma.userProfile.findUnique({
      where: { id: userId }
    })
    
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User already exists with this email'
      }, { status: 400 })
    }
    
    // Create new user profile
    const newUser = await prisma.userProfile.create({
      data: {
        id: userId,
        name: name,
        email: email,
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=128`,
        selectedIcon: '👤',
        userTitle: 'Developer',
        githubConnected: false,
        githubUsername: null,
        githubAvatarUrl: null,
        githubTokenRef: null
      }
    })
    
    console.log('✅ SIGNUP: User profile created successfully')
    console.log('User ID:', userId)
    
    // Store user session in localStorage (client-side will handle this)
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        profilePicture: newUser.profileImage
      }
    })
    
  } catch (error) {
    console.error('❌ SIGNUP ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create user account',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 