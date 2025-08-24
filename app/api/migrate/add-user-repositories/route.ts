import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔄 MIGRATION: Making repositories user-specific...')
    
    // Step 1: Add userId column to Repository table
    await prisma.$executeRaw`
      ALTER TABLE "Repository" 
      ADD COLUMN IF NOT EXISTS "userId" VARCHAR(255)
    `
    
    console.log('✅ MIGRATION: Added userId column to Repository table')
    
    // Step 2: Assign existing repositories to R.K. (rk-company-com)
    const rkUserId = 'rk-company-com'
    
    // Update all existing repositories to belong to R.K.
    const updateResult = await prisma.$executeRaw`
      UPDATE "Repository" 
      SET "userId" = ${rkUserId}
      WHERE "userId" IS NULL
    `
    
    console.log('✅ MIGRATION: Assigned existing repositories to R.K.')
    
    // Step 3: Drop the old unique constraint on fullName
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Repository" 
        DROP CONSTRAINT IF EXISTS "Repository_fullName_key"
      `
      console.log('✅ MIGRATION: Dropped old fullName unique constraint')
    } catch (error) {
      console.log('⚠️ MIGRATION: Old constraint might not exist, continuing...')
    }
    
    // Step 4: Add new unique constraint on (userId, fullName)
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Repository" 
        ADD CONSTRAINT "Repository_userId_fullName_key" 
        UNIQUE ("userId", "fullName")
      `
      console.log('✅ MIGRATION: Added new unique constraint on (userId, fullName)')
    } catch (error) {
      console.log('⚠️ MIGRATION: Constraint might already exist, continuing...')
    }
    
    // Step 5: Get repository counts
    const totalRepos = await prisma.repository.count()
    const rkRepos = await prisma.repository.count({
      where: { userId: rkUserId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Repositories are now user-specific',
      details: {
        userIdColumnAdded: true,
        existingReposAssignedToRK: true,
        uniqueConstraintUpdated: true,
        totalRepositories: totalRepos,
        rkRepositories: rkRepos,
        instructions: 'Each user now has their own separate repository list'
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
