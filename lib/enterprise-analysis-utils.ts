// Enterprise Analysis Utilities
// In-memory storage for demo (in production, use database)

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

// Helper function to update analysis status
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

// Helper function to get analysis status
export function getAnalysisStatus(analysisId: string) {
  return analysisStatus.get(analysisId)
}

// Helper function to create new analysis
export function createAnalysisStatus(analysisId: string, totalFiles: number) {
  const status = {
    status: 'queued' as const,
    progress: 0,
    filesAnalyzed: 0,
    totalFiles,
    currentFile: '',
    results: [],
    errors: [],
    startTime: Date.now()
  }
  
  analysisStatus.set(analysisId, status)
  return status
}
