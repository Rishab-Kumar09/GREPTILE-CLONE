import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

// GET: Load full analysis by ID
export async function GET(request: NextRequest) {
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

    const analysis = await prisma.$queryRaw`
      SELECT *
      FROM saved_analyses
      WHERE id = ${parseInt(id)} AND user_id = ${userId}
      LIMIT 1
    ` as any[]

    if (analysis.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      analysis: analysis[0]
    })

  } catch (error) {
    console.error('Load analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load analysis'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

