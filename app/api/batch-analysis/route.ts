import { NextRequest, NextResponse } from 'next/server'
import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch'

// Initialize AWS Batch client
const batchClient = new BatchClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, strategy, analysisId } = await request.json()
    
    if (!repoUrl || !strategy || !analysisId) {
      return NextResponse.json(
        { error: 'Missing required parameters: repoUrl, strategy, analysisId' },
        { status: 400 }
      )
    }
    
    console.log(`🚀 SUBMITTING AWS BATCH JOB:`)
    console.log(`   Repository: ${repoUrl}`)
    console.log(`   Strategy: ${strategy}`)
    console.log(`   Analysis ID: ${analysisId}`)
    
    // Submit job to AWS Batch
    const jobName = `analysis-${analysisId}-${Date.now()}`
    const submitJobCommand = new SubmitJobCommand({
      jobName,
      jobQueue: process.env.AWS_BATCH_JOB_QUEUE || 'greptile-analysis-queue',
      jobDefinition: process.env.AWS_BATCH_JOB_DEFINITION || 'greptile-analysis-job',
      parameters: {
        REPO_URL: repoUrl,
        ANALYSIS_STRATEGY: strategy,
        ANALYSIS_ID: analysisId,
        DATABASE_URL: process.env.DATABASE_URL || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      },
      timeout: {
        attemptDurationSeconds: 3600 // 1 hour timeout
      }
    })
    
    const result = await batchClient.send(submitJobCommand)
    
    console.log(`✅ AWS Batch job submitted successfully:`)
    console.log(`   Job ID: ${result.jobId}`)
    console.log(`   Job Name: ${result.jobName}`)
    
    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      jobName: result.jobName,
      message: `AWS Batch job submitted for ${repoUrl}`
    })
    
  } catch (error) {
    console.error('❌ AWS Batch submission error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown AWS Batch error'
      },
      { status: 500 }
    )
  }
}
