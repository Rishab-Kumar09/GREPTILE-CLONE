import { NextRequest, NextResponse } from 'next/server'

// In a real implementation, you'd store this in a database
// For demo purposes, we'll use in-memory storage
const analysisStatus = new Map<string, {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  filesAnalyzed: number
  totalFiles: number
  currentFile: string
  results: any[]
  errors: string[]
  startTime: number
  estimatedCompletion?: number
}>()

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
    const status = analysisStatus.get(analysisId)
    
    if (!status) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }
    
    // Calculate estimated completion time
    let estimatedCompletion = null
    if (status.status === 'processing' && status.progress > 0) {
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

// Helper function to update analysis status (would be called by background processor)
export function updateAnalysisStatus(
  analysisId: string, 
  updates: Partial<{
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    filesAnalyzed: number
    totalFiles: number
    currentFile: string
    results: any[]
    errors: string[]
  }>
) {
  const current = analysisStatus.get(analysisId) || {
    status: 'queued' as const,
    progress: 0,
    filesAnalyzed: 0,
    totalFiles: 0,
    currentFile: '',
    results: [],
    errors: [],
    startTime: Date.now()
  }
  
  analysisStatus.set(analysisId, { ...current, ...updates })
}
