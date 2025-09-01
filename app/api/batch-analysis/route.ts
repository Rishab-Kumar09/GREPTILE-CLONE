import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log(`🧪 MOCK BATCH ANALYSIS ENDPOINT (LOCAL DEV)`)
  
  try {
    const { repoUrl, strategy, analysisId } = await request.json()
    console.log(`📝 Mock Batch params: repoUrl=${repoUrl}, strategy=${strategy}, analysisId=${analysisId}`)
    
    if (!repoUrl || !strategy || !analysisId) {
      return NextResponse.json(
        { error: 'Missing required parameters: repoUrl, strategy, analysisId' },
        { status: 400 }
      )
    }
    
    // Mock successful batch submission
    const mockJobId = `mock-job-${Date.now()}`
    
    console.log(`✅ MOCK: Would submit to AWS Batch:`)
    console.log(`   Repository: ${repoUrl}`)
    console.log(`   Strategy: ${strategy}`)
    console.log(`   Analysis ID: ${analysisId}`)
    console.log(`   Mock Job ID: ${mockJobId}`)
    
    return NextResponse.json({
      success: true,
      jobId: mockJobId,
      jobName: `analysis-${analysisId}-${Date.now()}`,
      message: `MOCK: AWS Batch job would be submitted for ${repoUrl}`
    })
    
  } catch (error) {
    console.error('❌ Mock Batch submission error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown batch error'
      },
      { status: 500 }
    )
  }
}