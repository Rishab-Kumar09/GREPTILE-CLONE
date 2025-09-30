import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// GET: Get user's admin role
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID required'
      }, { status: 400 })
    }

    // Check if user is admin and get super admin status
    const admin = await prisma.$queryRaw`
      SELECT is_super_admin FROM admins 
      WHERE user_id = ${userId} AND is_active = true
      LIMIT 1
    ` as any[]

    if (admin.length === 0) {
      return NextResponse.json({
        success: true,
        isAdmin: false,
        isSuperAdmin: false
      })
    }

    return NextResponse.json({
      success: true,
      isAdmin: true,
      isSuperAdmin: admin[0].is_super_admin
    })

  } catch (error) {
    console.error('Get role error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get role'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

