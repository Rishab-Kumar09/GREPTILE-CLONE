import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { EnterpriseAnalyzer } from '../analyzer'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, strategy = 'incremental' } = await request.json()
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo are required' },
        { status: 400 }
      )
    }

    // Generate unique analysis ID
    const analysisId = uuid()
    const repoUrl = `https://github.com/${owner}/${repo}.git`
    
    console.log(`🚀 Starting NEW parallel analyzer for ${owner}/${repo}`)
    
    // Create initial status
    await prisma.analysisStatus.create({
      data: {
        id: analysisId,
        status: 'starting',
        progress: 0,
        currentFile: 'Starting analysis...',
        results: [],
        startTime: Date.now(),
        strategy: {
          name: 'Parallel Analysis',
          description: 'Fast parallel processing'
        }
      }
    })
    
    // Start NEW parallel analyzer
    const analyzer = new EnterpriseAnalyzer()
    analyzer.start(repoUrl, analysisId)
    
    return NextResponse.json({
      success: true,
      analysisId,
      message: `⚡ Parallel analysis started for ${owner}/${repo}`
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}