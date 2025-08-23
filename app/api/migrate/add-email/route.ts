import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Starting email column migration...')
    
    // Check if email column already exists
    const checkResult = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserProfile' AND column_name = 'email'
    ` as any[]
    
    if (checkResult.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Email column already exists',
        alreadyExists: true
      })
    }
    
    // Add email column to UserProfile table
    await prisma.$executeRaw`
      ALTER TABLE "UserProfile" 
      ADD COLUMN email VARCHAR(255) DEFAULT 'user@example.com'
    `
    
    console.log('✅ Email column added successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Email column added successfully to UserProfile table'
    })
    
  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add email column',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 