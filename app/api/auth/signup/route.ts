import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()
    
    console.log('🔄 SIGNUP: Creating new user profile...')
    console.log('Name:', name)
    console.log('Email:', email)
    
    // Hash the password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    console.log('🔐 SIGNUP: Password hashed successfully')
    
    // Generate a unique user ID based on email
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-')
    
    // Check if user already exists using raw SQL (same pattern as signin)
    const existingUsers = await prisma.$queryRaw`
      SELECT * FROM "UserProfile" WHERE id = ${userId} LIMIT 1
    ` as any[]
    
    if (existingUsers.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'User already exists with this email'
      }, { status: 400 })
    }
    
    // Create new user profile using raw SQL
    const newUserResult = await prisma.$executeRaw`
      INSERT INTO "UserProfile" (
        id, name, email, password, "profileImage", "selectedIcon", "userTitle",
        "githubConnected", "githubUsername", "githubAvatarUrl", "githubTokenRef",
        "createdAt", "updatedAt"
      ) VALUES (
        ${userId}, ${name}, ${email}, ${hashedPassword},
        ${`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=128`},
        ${'👤'}, ${'Developer'}, ${false}, ${null}, ${null}, ${null},
        NOW(), NOW()
      )
    `
    
    // Get the created user data
    const newUserData = await prisma.$queryRaw`
      SELECT * FROM "UserProfile" WHERE id = ${userId} LIMIT 1
    ` as any[]
    
    const newUser = newUserData[0]
    
    console.log('✅ SIGNUP: User profile created successfully')
    console.log('User ID:', userId)
    
    // 🔒 SECURITY FIX: Create server-side session instead of client-side storage
    const { createSession } = await import('@/lib/session-utils')
    const sessionToken = await createSession(newUser.id, newUser.email)
    
    console.log('✅ SIGNUP: Server-side session created for new user:', newUser.id)
    
    // Return user data with session token
    return NextResponse.json({
      success: true,
      sessionToken: sessionToken, // 🔒 Server-side session token
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