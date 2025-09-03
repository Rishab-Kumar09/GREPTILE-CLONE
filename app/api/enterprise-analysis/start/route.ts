import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'

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
    
    console.log(`📋 Starting REAL analysis for ${owner}/${repo}`)
    
    // Generate unique analysis ID
    const analysisId = uuid()
    
    // Call Lambda function DIRECTLY - no database, no setTimeout
    const lambdaUrl = 'https://zhs2iniuc3.execute-api.us-east-2.amazonaws.com/default/enterprise-code-analyzer'
    const repoUrl = `https://github.com/${owner}/${repo}.git`
    
    console.log('🚀 Calling Lambda SYNCHRONOUSLY:', lambdaUrl)
    console.log('📦 Payload:', { repoUrl, analysisId })
    
    try {
      const response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, analysisId })
      })
      
      console.log(`📡 Lambda response status: ${response.status}`)
      
      if (!response.ok) {
        throw new Error(`Lambda returned ${response.status}: ${response.statusText}`)
      }
      
      const responseText = await response.text()
      console.log('📄 Lambda raw response:', responseText.substring(0, 500) + '...')
      
      let data
      try {
        data = JSON.parse(responseText)
        console.log('✅ Lambda JSON response:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse Lambda response:', parseError)
        return NextResponse.json({
          success: false,
          error: 'Lambda returned invalid JSON',
          analysisId,
          rawResponse: responseText.substring(0, 200)
        })
      }
      
      // Return Lambda results DIRECTLY
      if (data.success && data.results) {
        console.log(`🎉 SUCCESS! Lambda returned ${data.results.length} results`)
        return NextResponse.json({
          success: true,
          analysisId,
          results: data.results,
          message: `✅ Real analysis completed for ${owner}/${repo}`,
          status: 'completed'
        })
      } else {
        console.log('⚠️ Lambda response missing success/results:', data)
        return NextResponse.json({
          success: false,
          error: 'Lambda returned no results',
          analysisId,
          lambdaResponse: data
        })
      }
      
    } catch (lambdaError) {
      console.error('❌ Lambda call failed:', lambdaError)
      return NextResponse.json({
        success: false,
        error: `Lambda error: ${lambdaError instanceof Error ? lambdaError.message : 'Unknown error'}`,
        analysisId
      })
    }
    
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