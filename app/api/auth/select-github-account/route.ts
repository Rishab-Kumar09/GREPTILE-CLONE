import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { accountId, githubUsername } = await request.json()
    
    if (!accountId || !githubUsername) {
      return NextResponse.json({
        success: false,
        error: 'Account ID and GitHub username are required'
      }, { status: 400 })
    }

    console.log('🔄 ACCOUNT SELECTION: User selected account:', accountId, 'for GitHub:', githubUsername)
    
    // Verify the account exists and has the correct GitHub username
    const selectedAccount = await prisma.$queryRaw`
      SELECT * FROM "UserProfile" 
      WHERE id = ${accountId} AND "githubUsername" = ${githubUsername}
      LIMIT 1
    ` as any[]
    
    if (selectedAccount.length === 0) {
      console.error('❌ ACCOUNT SELECTION: Invalid account selection')
      return NextResponse.json({
        success: false,
        error: 'Invalid account selection'
      }, { status: 400 })
    }

    const user = selectedAccount[0]
    console.log('✅ ACCOUNT SELECTION: Verified account:', user.id, `(${user.name})`)
    
    // Update lastUsed timestamp
    await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET "lastUsed" = NOW() 
      WHERE id = ${accountId}
    `
    
    console.log('✅ ACCOUNT SELECTION: Updated lastUsed timestamp for user:', user.id)
    
    // Create session for selected user
    const { createSession } = await import('@/lib/session-utils')
    const sessionToken = await createSession(user.id, user.email)
    
    console.log('✅ ACCOUNT SELECTION: Session created for selected account')
    
    return NextResponse.json({
      success: true,
      sessionToken: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profileImage
      }
    })

  } catch (error) {
    console.error('❌ ACCOUNT SELECTION ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to select account'
    }, { status: 500 })
  }
}
