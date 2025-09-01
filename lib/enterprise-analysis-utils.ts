// Enterprise Analysis Utilities
// In-memory storage for demo (in production, use database)

const analysisStatus = new Map<string, {
  status: 'initializing' | 'downloading' | 'cloning' | 'scanning' | 'analyzing' | 'completed' | 'failed'
  progress: number
  filesAnalyzed: number
  totalFiles: number
  currentFile: string
  results: any[]
  errors: string[]
  startTime: number
  strategy?: any
  repository?: string
  repositoryInfo?: any
  estimatedCompletion?: number
  batchJobId?: string
  batchStatus?: string
  batchStatusReason?: string
}>()

// Helper function to update analysis status
export function updateAnalysisStatus(
  analysisId: string, 
  updates: Partial<{
    status: 'initializing' | 'downloading' | 'cloning' | 'scanning' | 'analyzing' | 'completed' | 'failed'
    progress: number
    filesAnalyzed: number
    totalFiles: number
    currentFile: string
    results: any[]
    errors: string[]
    strategy?: any
    repository?: string
    repositoryInfo?: any
    batchJobId?: string
    batchStatus?: string
    batchStatusReason?: string
  }>
) {
  const current = analysisStatus.get(analysisId) || {
    status: 'initializing' as const,
    progress: 0,
    filesAnalyzed: 0,
    totalFiles: 0,
    currentFile: '',
    results: [],
    errors: [],
    startTime: Date.now()
  }
  
  // Accumulate results instead of replacing them
  const updatedStatus = { ...current, ...updates }
  if (updates.results && current.results) {
    updatedStatus.results = [...current.results, ...updates.results]
  }
  
  analysisStatus.set(analysisId, updatedStatus)
  
  console.log(`📊 STATUS UPDATE [${analysisId}]:`, {
    status: updatedStatus.status,
    progress: updatedStatus.progress,
    filesAnalyzed: updatedStatus.filesAnalyzed,
    totalResults: updatedStatus.results.length
  })
}

// Helper function to get analysis status
export function getAnalysisStatus(analysisId: string) {
  return analysisStatus.get(analysisId)
}

// Helper function to create new analysis
export function createAnalysisStatus(analysisId: string, initialData: any) {
  const status = {
    status: initialData.status || 'initializing' as const,
    progress: initialData.progress || 0,
    filesAnalyzed: initialData.filesAnalyzed || 0,
    totalFiles: initialData.totalFiles || 0,
    currentFile: initialData.currentFile || '',
    results: initialData.results || [],
    errors: initialData.errors || [],
    startTime: initialData.startTime || Date.now(),
    strategy: initialData.strategy,
    repository: initialData.repository,
    repositoryInfo: initialData.repositoryInfo
  }
  
  analysisStatus.set(analysisId, status)
  return status
}
