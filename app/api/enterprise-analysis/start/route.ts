import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { EnterpriseAnalyzer } from '../analyzer'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  console.log('🎯 ROUTE CALLED: /api/enterprise-analysis/start')
  
  try {
    const body = await request.json()
    const { owner, repo, strategy = 'incremental' } = body
    
    console.log('📋 Parsed params:', { owner, repo, strategy })
    
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
    console.log(`🔗 Lambda URL: ${lambdaUrl}`)
    console.log(`📦 Payload:`, { repoUrl, analysisId })
    
    try {
      console.log('⏳ Making fetch request to Lambda...')
      const response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ repoUrl, analysisId })
      })
      
      console.log(`📡 Lambda response status: ${response.status} ${response.statusText}`)
      
      if (!response.ok) {
        throw new Error(`Lambda returned ${response.status}: ${response.statusText}`)
      }
      
      const lambdaData = await response.json()
      console.log('✅ Lambda response received:', lambdaData)
      
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