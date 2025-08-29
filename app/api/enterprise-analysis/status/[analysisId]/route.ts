import { NextRequest, NextResponse } from 'next/server'
import { getAnalysisStatus } from '@/lib/enterprise-analysis-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { analysisId: string } }
) {
  try {
    const { analysisId } = params
    
    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      )
    }
    
    // Get status from storage (in real app, this would be from database)
    const status = getAnalysisStatus(analysisId)
    
    if (!status) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }
    
    // Calculate estimated completion time
    let estimatedCompletion = null
    const activeStatuses = ['cloning', 'scanning', 'analyzing']
    if (activeStatuses.includes(status.status) && status.progress > 0) {
      const elapsed = Date.now() - status.startTime
      const estimatedTotal = (elapsed / status.progress) * 100
      estimatedCompletion = status.startTime + estimatedTotal
    }
    
    return NextResponse.json({
      analysisId,
      status: status.status,
      progress: status.progress,
      filesAnalyzed: status.filesAnalyzed,
      totalFiles: status.totalFiles,
      currentFile: status.currentFile,
      results: status.results,
      errors: status.errors,
      estimatedCompletion,
      elapsedTime: Date.now() - status.startTime
    })
    
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: 'Failed to get analysis status' },
      { status: 500 }
    )
  }
}

// Helper function moved to a separate utility file
// This function would be imported from a utils file in a real implementation
