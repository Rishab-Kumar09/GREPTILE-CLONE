import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// Helper to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const admin = await prisma.$queryRaw`
      SELECT id FROM admins WHERE user_id = ${userId} AND is_active = true
    ` as any[]
    return admin.length > 0
  } catch (error) {
    return false
  }
}

// GET: List all users
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 GET /api/admin/manage-users called')
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('userId')
    console.log('📋 Requesting userId:', requestingUserId)
    
    if (!requestingUserId) {
      console.log('❌ No userId provided')
      return NextResponse.json({
        success: false,
        error: 'User ID required'
      }, { status: 400 })
    }

    console.log('🔐 Checking if user is admin...')
    const userIsAdmin = await isAdmin(requestingUserId)
    console.log('✅ Is admin?', userIsAdmin)
    
    if (!userIsAdmin) {
      console.log('❌ Access denied: Not an admin')
      return NextResponse.json({
        success: false,
        error: 'Access Denied: Not an admin'
      }, { status: 403 })
    }

    // Get all users with report counts
    console.log('📊 Fetching all users from database...')
    const users = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.email,
        u.name,
        u."selectedIcon" as "profileIcon",
        u."profileImage",
        u."createdAt",
        COALESCE(
          (SELECT COUNT(*) FROM issue_reports WHERE reported_by_user_id = u.id),
          0
        ) as report_count
      FROM "UserProfile" u
      ORDER BY u."createdAt" DESC
    ` as any[]

    console.log('✅ Fetched users:', users.length)

    return NextResponse.json({
      success: true,
      users
    })

  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// DELETE: Remove user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('userId')
    const targetUserId = searchParams.get('targetUserId')
    
    if (!requestingUserId || !targetUserId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const userIsAdmin = await isAdmin(requestingUserId)
    
    if (!userIsAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Access Denied: Not an admin'
      }, { status: 403 })
    }

    // Can't delete yourself
    if (targetUserId === requestingUserId) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete yourself'
      }, { status: 400 })
    }

    // Get user email for logging
    const targetUser = await prisma.$queryRaw`
      SELECT email FROM "UserProfile" WHERE id = ${targetUserId}
    ` as any[]

    if (targetUser.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    const userEmail = targetUser[0].email

    // Remove from admins table if they are an admin
    await prisma.$executeRaw`
      DELETE FROM admins WHERE user_id = ${targetUserId}
    `

    // Delete user profile
    await prisma.$executeRaw`
      DELETE FROM "UserProfile" WHERE id = ${targetUserId}
    `

    // Note: Reports are kept for audit trail (they reference user_id)

    // Log activity
    await prisma.$executeRaw`
      INSERT INTO admin_activity (admin_user_id, action, target_id, details)
      VALUES (${requestingUserId}, 'DELETE_USER', ${targetUserId}, ${`Deleted user ${userEmail}`})
    `

    return NextResponse.json({
      success: true,
      message: `User ${userEmail} deleted successfully`
    })

  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete user'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

