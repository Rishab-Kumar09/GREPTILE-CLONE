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
    
    // Call Lambda function synchronously for immediate results
    const lambdaUrl = 'https://zhs2iniuc3.execute-api.us-east-2.amazonaws.com/default/enterprise-code-analyzer'
    
    console.log(`🚀 Calling Lambda function for ${owner}/${repo}`)
    
    try {
      const response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, analysisId })
      })
      
      const lambdaData = await response.json()
      console.log('Lambda response:', lambdaData)
      
      // Update database with Lambda results
      if (lambdaData.success && lambdaData.results) {
        await prisma.analysisStatus.update({
          where: { id: analysisId },
          data: {
            status: 'completed',
            progress: 100,
            results: lambdaData.results,
            currentFile: 'Lambda analysis completed!'
          }
        })
        
        console.log(`✅ Database updated with ${lambdaData.results.length} results`)
      }
    } catch (lambdaError) {
      console.error('Lambda call failed:', lambdaError)
      
      // Update status as failed
      await prisma.analysisStatus.update({
        where: { id: analysisId },
        data: {
          status: 'failed',
          currentFile: `Lambda error: ${lambdaError instanceof Error ? lambdaError.message : 'Unknown error'}`
        }
      })
    }
    
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