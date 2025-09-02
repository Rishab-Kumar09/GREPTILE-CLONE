import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { prisma } from '@/lib/prisma'

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
    
    // Call Lambda function directly - no database for now
    const lambdaUrl = 'https://zhs2iniuc3.execute-api.us-east-2.amazonaws.com/default/enterprise-code-analyzer'
    const repoUrl = `https://github.com/${owner}/${repo}.git`
    
    console.log('🚀 Calling Lambda:', lambdaUrl)
    
    // Call Lambda in background - don't wait
    setTimeout(async () => {
      try {
        const response = await fetch(lambdaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl, analysisId })
        })
        const data = await response.json()
        console.log('✅ Lambda completed:', data)
      } catch (error) {
        console.error('❌ Lambda error:', error)
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