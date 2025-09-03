import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  
  try {
    const body = await request.json()
    const { owner, repo } = body
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo are required' },
        { status: 400 }
      )
    }
    
    console.log(`📋 Starting analysis for ${owner}/${repo}`)
    
    // Generate unique analysis ID
    const analysisId = uuid()
    
    // Create database record for status tracking
    try {
      await prisma.analysisStatus.create({
        data: {
          id: analysisId,
          status: 'initializing',
          progress: 0,
          currentFile: 'Starting Lambda analysis...',
          results: [],
          startTime: BigInt(Date.now()),
          strategy: { name: 'Lambda Git Clone', description: 'Fast git clone analysis' }
        }
      })
      console.log('💾 Database record created')
    } catch (dbError) {
      console.error('Database error:', dbError)
      // Continue without database if it fails
    }
    
    // Call Lambda function
    const lambdaUrl = 'https://zhs2iniuc3.execute-api.us-east-2.amazonaws.com/default/enterprise-code-analyzer'
    const repoUrl = `https://github.com/${owner}/${repo}.git`
    
    console.log('🚀 Calling Lambda:', lambdaUrl)
    
    // Call Lambda in background
    setTimeout(async () => {
      try {
        console.log('🔄 Making Lambda request...')
        const response = await fetch(lambdaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl, analysisId })
        })
        
        console.log(`📡 Lambda response status: ${response.status}`)
        const responseText = await response.text()
        console.log('📄 Lambda raw response:', responseText)
        
        let data
        try {
          data = JSON.parse(responseText)
          console.log('✅ Lambda JSON response:', data)
        } catch (parseError) {
          console.error('❌ Failed to parse Lambda response:', parseError)
          return
        }
        
        // Update database with results if successful
        if (data.success && data.results) {
          try {
            console.log(`💾 Updating database with ${data.results.length} results...`)
            await prisma.analysisStatus.update({
              where: { id: analysisId },
              data: {
                status: 'completed',
                progress: 100,
                results: data.results,
                currentFile: `Analysis completed! Found ${data.results.length} results`
              }
            })
            console.log('✅ Database updated successfully with real Lambda results!')
          } catch (dbError) {
            console.error('❌ Database update error:', dbError)
          }
        } else {
          console.log('⚠️ Lambda response missing success/results:', data)
          console.log('🔍 Full Lambda response structure:', JSON.stringify(data, null, 2))
          
          // Update status as failed if no results
          try {
            await prisma.analysisStatus.update({
              where: { id: analysisId },
              data: {
                status: 'failed',
                currentFile: 'Lambda returned no results'
              }
            })
          } catch (dbError) {
            console.error('Database error setting failed status:', dbError)
          }
        }
        
      } catch (error) {
        console.error('❌ Lambda call failed:', error)
      }
    }, 100)
    
    return NextResponse.json({
      success: true,
      analysisId,
      message: `🚀 Analysis started for ${owner}/${repo}`
    })
    
  } catch (error) {
    console.error('❌ Analysis error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}