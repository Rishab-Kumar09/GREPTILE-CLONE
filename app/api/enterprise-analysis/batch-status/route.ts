import { NextRequest, NextResponse } from 'next/server'
import { BatchClient, DescribeJobsCommand } from '@aws-sdk/client-batch'
import { updateAnalysisStatus } from '@/lib/enterprise-analysis-utils'

// Initialize AWS Batch client
const batchClient = new BatchClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const analysisId = searchParams.get('analysisId')
    
    if (!jobId || !analysisId) {
      return NextResponse.json(
        { error: 'Missing jobId or analysisId parameter' },
        { status: 400 }
      )
    }
    
    console.log(`🔍 Checking AWS Batch job status: ${jobId}`)
    
    // Get job details from AWS Batch
    const describeJobsCommand = new DescribeJobsCommand({
      jobs: [jobId]
    })
    
    const result = await batchClient.send(describeJobsCommand)
    const job = result.jobs?.[0]
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    // Map AWS Batch status to our internal status
    const statusMap: { [key: string]: string } = {
      'SUBMITTED': 'cloning',
      'PENDING': 'cloning', 
      'RUNNABLE': 'cloning',
      'STARTING': 'cloning',
      'RUNNING': 'analyzing',
      'SUCCEEDED': 'completed',
      'FAILED': 'failed'
    }
    
    const status = statusMap[job.status || ''] || 'unknown'
    
    // Calculate progress based on status
    let progress = 0
    switch (job.status) {
      case 'SUBMITTED':
      case 'PENDING':
        progress = 10
        break
      case 'RUNNABLE':
      case 'STARTING':
        progress = 20
        break
      case 'RUNNING':
        progress = 50 // Will be updated by the actual job
        break
      case 'SUCCEEDED':
        progress = 100
        break
      case 'FAILED':
        progress = 0
        break
    }
    
    // Update analysis status
    updateAnalysisStatus(analysisId, {
      status: status as any,
      progress,
      currentFile: `AWS Batch: ${job.status}`,
      batchStatus: job.status,
      batchStatusReason: job.statusReason
    })
    
    console.log(`📊 Batch job ${jobId} status: ${job.status} (${progress}%)`)
    
    return NextResponse.json({
      jobId,
      analysisId,
      batchStatus: job.status,
      status,
      progress,
      statusReason: job.statusReason,
      createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      stoppedAt: job.stoppedAt ? new Date(job.stoppedAt).toISOString() : null
    })
    
  } catch (error) {
    console.error('❌ Batch status check error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown batch status error'
      },
      { status: 500 }
    )
  }
}
