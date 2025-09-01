// Enterprise Analysis Utilities
// Database storage for persistent status across Lambda instances

import { prisma } from './prisma'

interface AnalysisStatusData {
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
}

// Helper function to update analysis status
export async function updateAnalysisStatus(
  analysisId: string, 
  updates: Partial<AnalysisStatusData>
) {
  // Skip database in local development if DATABASE_URL not set
  if (!process.env.DATABASE_URL) {
    console.log(`⚠️ No DATABASE_URL - skipping database update (local dev mode)`)
    console.log(`📊 STATUS UPDATE [${analysisId}]:`, updates)
    return
  }
  
  try {
    // Get current status from database
    const current = await prisma.analysisStatus.findUnique({
      where: { id: analysisId }
    })
    
    if (!current) {
      console.warn(`⚠️ Analysis ${analysisId} not found for update`)
      return
    }
    
    // Prepare update data
    const updateData: any = {}
    
    // Handle simple fields
    if (updates.status) updateData.status = updates.status
    if (updates.progress !== undefined) updateData.progress = updates.progress
    if (updates.filesAnalyzed !== undefined) updateData.filesAnalyzed = updates.filesAnalyzed
    if (updates.totalFiles !== undefined) updateData.totalFiles = updates.totalFiles
    if (updates.currentFile !== undefined) updateData.currentFile = updates.currentFile
    if (updates.batchJobId) updateData.batchJobId = updates.batchJobId
    if (updates.batchStatus) updateData.batchStatus = updates.batchStatus
    if (updates.batchStatusReason) updateData.batchStatusReason = updates.batchStatusReason
    
    // Handle JSON fields - accumulate results instead of replacing
    if (updates.results) {
      const currentResults = Array.isArray(current.results) ? current.results as any[] : []
      updateData.results = [...currentResults, ...updates.results]
    }
    
    if (updates.errors) {
      const currentErrors = Array.isArray(current.errors) ? current.errors as any[] : []
      updateData.errors = [...currentErrors, ...updates.errors]
    }
    
    // Update in database
    const updatedStatus = await prisma.analysisStatus.update({
      where: { id: analysisId },
      data: updateData
    })
    
    console.log(`📊 STATUS UPDATE [${analysisId}]:`, {
      status: updatedStatus.status,
      progress: updatedStatus.progress,
      filesAnalyzed: updatedStatus.filesAnalyzed,
      totalResults: Array.isArray(updatedStatus.results) ? (updatedStatus.results as any[]).length : 0
    })
    
  } catch (error) {
    console.error(`❌ Failed to update analysis status [${analysisId}]:`, error)
  }
}

// Helper function to get analysis status
export async function getAnalysisStatus(analysisId: string) {
  try {
    const status = await prisma.analysisStatus.findUnique({
      where: { id: analysisId }
    })
    
    if (!status) {
      return null
    }
    
    // Convert database format to expected format
    return {
      status: status.status as any,
      progress: status.progress,
      filesAnalyzed: status.filesAnalyzed,
      totalFiles: status.totalFiles,
      currentFile: status.currentFile,
      results: Array.isArray(status.results) ? status.results as any[] : [],
      errors: Array.isArray(status.errors) ? status.errors as any[] : [],
      startTime: Number(status.startTime),
      strategy: status.strategy,
      repository: status.repository,
      repositoryInfo: status.repositoryInfo,
      estimatedCompletion: status.estimatedCompletion ? Number(status.estimatedCompletion) : undefined,
      batchJobId: status.batchJobId,
      batchStatus: status.batchStatus,
      batchStatusReason: status.batchStatusReason
    }
  } catch (error) {
    console.error(`❌ Failed to get analysis status [${analysisId}]:`, error)
    return null
  }
}

// Helper function to create new analysis
export async function createAnalysisStatus(analysisId: string, initialData: any) {
  // Skip database in local development if DATABASE_URL not set
  if (!process.env.DATABASE_URL) {
    console.log(`⚠️ No DATABASE_URL - skipping database storage (local dev mode)`)
    console.log(`✅ Created analysis status [${analysisId}] in memory (local)`)
    return { id: analysisId, ...initialData }
  }
  
  try {
    const status = await prisma.analysisStatus.create({
      data: {
        id: analysisId,
        status: initialData.status || 'initializing',
        progress: initialData.progress || 0,
        filesAnalyzed: initialData.filesAnalyzed || 0,
        totalFiles: initialData.totalFiles || 0,
        currentFile: initialData.currentFile || '',
        results: initialData.results || [],
        errors: initialData.errors || [],
        startTime: BigInt(initialData.startTime || Date.now()),
        strategy: initialData.strategy,
        repository: initialData.repository,
        repositoryInfo: initialData.repositoryInfo
      }
    })
    
    console.log(`✅ Created analysis status [${analysisId}] in database`)
    return status
  } catch (error) {
    console.error(`❌ Failed to create analysis status [${analysisId}]:`, error)
    throw error
  }
}
