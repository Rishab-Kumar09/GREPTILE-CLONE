import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔄 MIGRATION: Adding password field to UserProfile table...')
    
    // Add password column to UserProfile table
    await prisma.$executeRaw`
      ALTER TABLE "UserProfile" 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255)
    `
    
    console.log('✅ MIGRATION: Password field added successfully')
    
    // Set password for R.K.'s account (rk-company-com)
    const rkUserId = 'rk-company-com'
    const rkPassword = 'Password' // The password you mentioned
    
    // Hash the password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(rkPassword, saltRounds)
    
    // Update R.K.'s account with the hashed password
    const updatedUser = await prisma.userProfile.update({
      where: { id: rkUserId },
      data: { password: hashedPassword }
    })
    
    console.log('✅ MIGRATION: R.K. password set successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Password field added and R.K. password set',
      details: {
        passwordFieldAdded: true,
        rkPasswordSet: true,
        rkUserId: rkUserId,
        instructions: 'R.K. can now sign in with email: rk@company.com and password: Password'
      }
    })
    
  } catch (error) {
    console.error('❌ MIGRATION ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
