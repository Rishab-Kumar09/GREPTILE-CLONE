import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw`
      SELECT id FROM admins WHERE user_id = ${userId} AND is_active = true LIMIT 1
    ` as any[]
    return result.length > 0
  } catch (error) {
    console.error('Admin check error:', error)
    return false
  }
}

// POST: Submit report or sign off
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'report') {
      // Submit bug report
      const { issueId, title, description, category, userId, userEmail } = await request.json()
      
      if (!issueId || !title || !description || !userId) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields'
        }, { status: 400 })
      }

      await prisma.$executeRaw`
        INSERT INTO issue_reports (
          issue_id, title, description, category,
          reported_by_user_id, reported_by_email, status, created_at
        ) VALUES (
          ${issueId}, ${title}, ${description}, ${category || 'bug'},
          ${userId}, ${userEmail || null}, 'open', NOW()
        )
      `

      return NextResponse.json({
        success: true,
        message: 'Issue reported successfully'
      })
      
    } else if (action === 'signoff') {
      // Admin sign-off
      const { reportId, userId, status, notes } = await request.json()
      
      if (!reportId || !userId || !status) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields'
        }, { status: 400 })
      }

      // Check admin
      const userIsAdmin = await isAdmin(userId)
      if (!userIsAdmin) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized: Admin access required'
        }, { status: 403 })
      }

      // Insert/update sign-off
      await prisma.$executeRaw`
        INSERT INTO issue_signoffs (report_id, signed_off_by, signed_off_at, admin_notes)
        VALUES (${reportId}, ${userId}, NOW(), ${notes || null})
        ON CONFLICT (report_id)
        DO UPDATE SET
          signed_off_by = ${userId},
          signed_off_at = NOW(),
          admin_notes = ${notes || null}
      `
      
      // Update report status
      await prisma.$executeRaw`
        UPDATE issue_reports
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${reportId}
      `

      // Log action
      await prisma.$executeRaw`
        INSERT INTO admin_activity (admin_user_id, action, target_id, details)
        VALUES (${userId}, 'SIGNOFF', ${reportId.toString()}, ${status})
      `

      return NextResponse.json({
        success: true,
        message: `Issue marked as ${status}`
      })
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Operation failed'
    }, { status: 500 })
  }
}

// GET: List reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeResolved = searchParams.get('includeResolved') === 'true'
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID required'
      }, { status: 400 })
    }

    const userIsAdmin = await isAdmin(userId)
    
    let reports
    if (userIsAdmin) {
      // Admins see ALL reports
      reports = await prisma.$queryRaw`
        SELECT 
          r.*,
          s.signed_off_by,
          s.signed_off_at,
          s.admin_notes
        FROM issue_reports r
        LEFT JOIN issue_signoffs s ON r.id = s.report_id
        ${includeResolved ? prisma.$queryRaw`` : prisma.$queryRaw`WHERE r.status != 'resolved'`}
        ORDER BY r.created_at DESC
      ` as any[]
    } else {
      // Users see only their own reports
      reports = await prisma.$queryRaw`
        SELECT * FROM issue_reports
        WHERE reported_by_user_id = ${userId}
        ${includeResolved ? prisma.$queryRaw`` : prisma.$queryRaw`AND status != 'resolved'`}
        ORDER BY created_at DESC
      ` as any[]
    }

    return NextResponse.json({
      success: true,
      reports,
      isAdmin: userIsAdmin
    })

  } catch (error) {
    console.error('Get reports error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch reports'
    }, { status: 500 })
  }
}
