import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// GET: List saved analyses for user
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

    const analyses = await prisma.$queryRaw`
      SELECT id, analysis_id, repo_url, title, total_issues, created_at
      FROM saved_analyses
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 20
    ` as any[]

    return NextResponse.json({
      success: true,
      analyses
    })

  } catch (error) {
    console.error('Get saved analyses error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch saved analyses'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// POST: Save new analysis
export async function POST(request: NextRequest) {
  try {
    const { userId, analysisId, repoUrl, title, results, chatMessages } = await request.json()
    
    if (!userId || !analysisId || !repoUrl || !title || !results) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    const totalIssues = results.length
    const resultsJson = JSON.stringify(results)
    const chatJson = JSON.stringify(chatMessages || [])

    await prisma.$executeRaw`
      INSERT INTO saved_analyses (
        user_id, analysis_id, repo_url, title,
        results, chat_messages, total_issues, created_at, updated_at
      ) VALUES (
        ${userId}, ${analysisId}, ${repoUrl}, ${title},
        ${resultsJson}::jsonb, ${chatJson}::jsonb, ${totalIssues}, NOW(), NOW()
      )
    `

    return NextResponse.json({
      success: true,
      message: 'Analysis saved successfully'
    })

  } catch (error) {
    console.error('Save analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save analysis'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// DELETE: Remove saved analysis
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')
    
    if (!id || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    await prisma.$executeRaw`
      DELETE FROM saved_analyses
      WHERE id = ${parseInt(id)} AND user_id = ${userId}
    `

    return NextResponse.json({
      success: true,
      message: 'Analysis deleted successfully'
    })

  } catch (error) {
    console.error('Delete analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete analysis'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

