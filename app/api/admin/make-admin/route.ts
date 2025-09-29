import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const result = await sql`
      SELECT id FROM admins WHERE user_id = ${userId} AND is_active = true LIMIT 1
    `
    return result.length > 0
  } catch (error) {
    console.error('Admin check error:', error)
    return false
  }
}

// POST: Make a user an admin (admin only)
export async function POST(request: NextRequest) {
  try {
    const { targetUserId, requestingUserId, targetUserEmail } = await request.json()
    
    if (!targetUserId || !requestingUserId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    
    // Check if there are any admins in the system
    const adminCount = await sql`SELECT COUNT(*) as count FROM admins WHERE is_active = true`
    const hasAdmins = parseInt(adminCount[0].count) > 0
    
    if (hasAdmins) {
      // If admins exist, check if requesting user is admin
      const requesterIsAdmin = await isAdmin(requestingUserId)
      if (!requesterIsAdmin) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized: Only admins can make other users admins'
        }, { status: 403 })
      }
    }
    // If no admins exist, allow first admin to be created
    
    // Check if target user is already an admin
    const existingAdmin = await sql`
      SELECT id, is_active FROM admins WHERE user_id = ${targetUserId}
    `
    
    if (existingAdmin.length > 0) {
      if (existingAdmin[0].is_active) {
        return NextResponse.json({
          success: false,
          error: 'User is already an admin'
        }, { status: 400 })
      } else {
        // Reactivate admin
        await sql`
          UPDATE admins
          SET is_active = true, updated_at = NOW()
          WHERE user_id = ${targetUserId}
        `
        return NextResponse.json({
          success: true,
          message: 'Admin reactivated successfully'
        })
      }
    }
    
    // Create new admin
    await sql`
      INSERT INTO admins (
        user_id,
        email,
        is_active,
        created_at
      ) VALUES (
        ${targetUserId},
        ${targetUserEmail || null},
        true,
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      message: hasAdmins ? 'New admin created successfully' : 'First admin created successfully',
      isFirstAdmin: !hasAdmins
    })

  } catch (error) {
    console.error('Make admin error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to make user an admin'
    }, { status: 500 })
  }
}

// DELETE: Remove admin status (admin only, cannot remove yourself)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('targetUserId')
    const requestingUserId = searchParams.get('requestingUserId')
    
    if (!targetUserId || !requestingUserId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Check if requesting user is admin
    const requesterIsAdmin = await isAdmin(requestingUserId)
    if (!requesterIsAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized: Admin access required'
      }, { status: 403 })
    }

    // Prevent self-removal
    if (targetUserId === requestingUserId) {
      return NextResponse.json({
        success: false,
        error: 'Cannot remove your own admin status'
      }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)
    
    // Deactivate admin
    await sql`
      UPDATE admins
      SET is_active = false, updated_at = NOW()
      WHERE user_id = ${targetUserId}
    `

    return NextResponse.json({
      success: true,
      message: 'Admin status removed successfully'
    })

  } catch (error) {
    console.error('Remove admin error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to remove admin status'
    }, { status: 500 })
  }
}
