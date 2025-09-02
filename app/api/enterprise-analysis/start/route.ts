import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { prisma } from '@/lib/prisma'
import { createAnalysisStatus, updateAnalysisStatus } from '@/lib/enterprise-analysis-utils'

export async function POST(request: NextRequest) {
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  
  try {
    const body = await request.json()
    const { owner, repo, strategy = 'incremental' } = body
    
    console.log('📋 Parsed params:', { owner, repo, strategy })
    
    // Generate analysis ID that frontend expects
    const analysisId = uuid()
    console.log('🆔 Generated analysisId:', analysisId)
    
    // Create database record so status endpoint works
    await createAnalysisStatus(analysisId, {
      status: 'initializing',
      progress: 0,
      currentFile: 'Starting Lambda analysis...',
      startTime: Date.now(),
      repository: `${owner}/${repo}`,
      strategy: { name: 'Lambda Git Clone', description: 'Fast git clone analysis' }
    })
    console.log('💾 Database record created')
    
    // Call Lambda function directly
    const lambdaUrl = 'https://zhs2iniuc3.execute-api.us-east-2.amazonaws.com/default/enterprise-code-analyzer'
    const repoUrl = `https://github.com/${owner}/${repo}.git`
    
    console.log('🚀 Calling Lambda:', lambdaUrl)
    
    // Call Lambda in background - don't wait
    setTimeout(async () => {
      try {
        console.log('🔄 Making Lambda request...')
        console.log('📦 Payload:', { repoUrl, analysisId })
        
        const response = await fetch(lambdaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl, analysisId })
        })
        
        console.log(`📡 Lambda response status: ${response.status}`)
        console.log(`📡 Lambda response headers:`, Object.fromEntries(response.headers.entries()))
        
        const responseText = await response.text()
        console.log('📄 Lambda raw response:', responseText)
        
        let data
        try {
          data = JSON.parse(responseText)
          console.log('✅ Lambda JSON response:', data)
        } catch (parseError) {
          console.error('❌ Failed to parse Lambda response as JSON:', parseError)
          console.log('📄 Raw response was:', responseText)
          return
        }
        
        // Update database with results if successful
        if (data.success && data.results) {
          console.log('💾 Updating database with Lambda results...')
          await updateAnalysisStatus(analysisId, {
            status: 'completed',
            progress: 100,
            results: data.results,
            currentFile: `Analysis completed! Found ${data.results.length} results`
          })
          console.log('✅ Database updated successfully')
        } else {
          console.log('⚠️ Lambda response missing success/results:', data)
          await updateAnalysisStatus(analysisId, {
            status: 'failed',
            currentFile: 'Lambda did not return results'
          })
        }
        
      } catch (error) {
        console.error('❌ Lambda call failed:', error)
        await updateAnalysisStatus(analysisId, {
          status: 'failed',
          currentFile: `Lambda error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }, 100)
    
    // Return what frontend expects
    return NextResponse.json({
      success: true,
      analysisId,
      message: `⚡ Analysis started for ${owner}/${repo}`
    })
    
  } catch (error) {
    console.error('❌ Route error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}