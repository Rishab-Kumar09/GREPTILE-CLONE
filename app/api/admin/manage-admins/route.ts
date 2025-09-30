import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// Helper to check if user is admin
async function getAdminStatus(userId: string) {
  try {
    const admin = await prisma.$queryRaw`
      SELECT is_super_admin FROM admins 
      WHERE user_id = ${userId} AND is_active = true
    ` as any[]
    
    if (admin.length === 0) return { isAdmin: false, isSuperAdmin: false }
    return { isAdmin: true, isSuperAdmin: admin[0].is_super_admin }
  } catch (error) {
    return { isAdmin: false, isSuperAdmin: false }
  }
}

// GET: List all admins
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('userId')
    
    if (!requestingUserId) {
      return NextResponse.json({
        success: false,
        error: 'User ID required'
      }, { status: 400 })
    }

    const { isAdmin, isSuperAdmin } = await getAdminStatus(requestingUserId)
    
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Access Denied: Not an admin'
      }, { status: 403 })
    }

    // Get all admins
    let admins
    if (isSuperAdmin) {
      // Super Admin sees ALL admins (including themselves)
      admins = await prisma.$queryRaw`
        SELECT a.id, a.user_id, a.user_email, a.user_name, a.is_super_admin, a.created_at
        FROM admins a
        WHERE a.is_active = true
        ORDER BY a.is_super_admin DESC, a.created_at ASC
      ` as any[]
    } else {
      // Regular admins DON'T see Super Admins (R.K. is invisible)
      admins = await prisma.$queryRaw`
        SELECT a.id, a.user_id, a.user_email, a.user_name, a.is_super_admin, a.created_at
        FROM admins a
        WHERE a.is_active = true AND a.is_super_admin = false
        ORDER BY a.created_at ASC
      ` as any[]
    }

    return NextResponse.json({
      success: true,
      admins,
      isSuperAdmin
    })

  } catch (error) {
    console.error('Get admins error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch admins'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// POST: Add new admin
export async function POST(request: NextRequest) {
  try {
    const { requestingUserId, userEmail } = await request.json()
    
    if (!requestingUserId || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const { isAdmin } = await getAdminStatus(requestingUserId)
    
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Access Denied: Not an admin'
      }, { status: 403 })
    }

    // Find user by email
    const user = await prisma.$queryRaw`
      SELECT id, email, name FROM "UserProfile"
      WHERE email = ${userEmail}
      LIMIT 1
    ` as any[]

    if (user.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 })
    }

    const targetUser = user[0]

    // Check if already an admin
    const existingAdmin = await prisma.$queryRaw`
      SELECT id FROM admins WHERE user_id = ${targetUser.id}
    ` as any[]

    if (existingAdmin.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'User is already an admin'
      }, { status: 400 })
    }

    // Add as admin (NOT super admin)
    await prisma.$executeRaw`
      INSERT INTO admins (user_id, user_email, user_name, is_active, is_super_admin, created_by)
      VALUES (${targetUser.id}, ${targetUser.email}, ${targetUser.name || 'Admin'}, true, false, ${requestingUserId})
    `

    // Log activity
    await prisma.$executeRaw`
      INSERT INTO admin_activity (admin_user_id, action, target_id, details)
      VALUES (${requestingUserId}, 'ADD_ADMIN', ${targetUser.id}, ${`Added ${targetUser.email} as admin`})
    `

    return NextResponse.json({
      success: true,
      message: `${targetUser.email} is now an admin!`
    })

  } catch (error) {
    console.error('Add admin error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add admin'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// DELETE: Remove admin
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('userId')
    const targetAdminId = searchParams.get('adminId')
    
    if (!requestingUserId || !targetAdminId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const { isAdmin, isSuperAdmin } = await getAdminStatus(requestingUserId)
    
    if (!isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Access Denied: Not an admin'
      }, { status: 403 })
    }

    // Get target admin info
    const targetAdmin = await prisma.$queryRaw`
      SELECT user_id, user_email, is_super_admin FROM admins
      WHERE id = ${parseInt(targetAdminId)}
    ` as any[]

    if (targetAdmin.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Admin not found'
      }, { status: 404 })
    }

    const target = targetAdmin[0]

    // Can't remove yourself
    if (target.user_id === requestingUserId) {
      return NextResponse.json({
        success: false,
        error: 'Cannot remove yourself as admin'
      }, { status: 400 })
    }

    // Only Super Admin can remove other admins (if target is super admin)
    if (target.is_super_admin && !isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Access Denied: Cannot remove Super Admin'
      }, { status: 403 })
    }

    // Regular admins can remove other regular admins
    // Super admin can remove anyone (except themselves)

    // Remove admin (soft delete)
    await prisma.$executeRaw`
      UPDATE admins
      SET is_active = false
      WHERE id = ${parseInt(targetAdminId)}
    `

    // Log activity
    await prisma.$executeRaw`
      INSERT INTO admin_activity (admin_user_id, action, target_id, details)
      VALUES (${requestingUserId}, 'REMOVE_ADMIN', ${target.user_id}, ${`Removed ${target.user_email} as admin`})
    `

    return NextResponse.json({
      success: true,
      message: `${target.user_email} removed as admin`
    })

  } catch (error) {
    console.error('Remove admin error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to remove admin'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

