import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔄 MIGRATION: Fixing default-user profile...')
    
    // Check if default-user exists
    const defaultUser = await prisma.userProfile.findUnique({
      where: { id: 'default-user' }
    })
    
    if (defaultUser) {
      console.log('✅ Found default-user profile:', defaultUser.name)
      
      // Create a proper user account for R.K.
      const rkEmail = 'rk@company.com'
      const rkUserId = rkEmail.toLowerCase().replace(/[^a-z0-9]/g, '-') // rk-company-com
      
      // Check if rk-company-com already exists
      const existingRk = await prisma.userProfile.findUnique({
        where: { id: rkUserId }
      })
      
      if (!existingRk) {
        // Create new user profile for R.K.
        const newRkUser = await prisma.userProfile.create({
          data: {
            id: rkUserId,
            name: defaultUser.name || 'R.K.',
            email: rkEmail,
            profileImage: defaultUser.profileImage || `https://ui-avatars.com/api/?name=R.K.&background=10b981&color=fff&size=128`,
            selectedIcon: defaultUser.selectedIcon || '👤',
            userTitle: defaultUser.userTitle || 'Developer',
            githubConnected: defaultUser.githubConnected || false,
            githubUsername: defaultUser.githubUsername,
            githubAvatarUrl: defaultUser.githubAvatarUrl,
            githubTokenRef: defaultUser.githubTokenRef
          }
        })
        
        console.log('✅ Created new user profile for R.K.:', newRkUser.id)
        
        return NextResponse.json({
          success: true,
          message: 'Migration completed successfully',
          oldUser: 'default-user',
          newUser: newRkUser.id,
          email: rkEmail,
          instructions: `You can now sign in with email: ${rkEmail} and any password`
        })
      } else {
        console.log('✅ R.K. user profile already exists')
        return NextResponse.json({
          success: true,
          message: 'R.K. user profile already exists',
          userId: rkUserId,
          email: rkEmail,
          instructions: `You can sign in with email: ${rkEmail} and any password`
        })
      }
    } else {
      console.log('❌ No default-user profile found')
      return NextResponse.json({
        success: false,
        message: 'No default-user profile found to migrate'
      })
    }
    
  } catch (error) {
    console.error('❌ MIGRATION ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
