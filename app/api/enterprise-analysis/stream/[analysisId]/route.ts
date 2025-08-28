import { NextRequest } from 'next/server'
import { getAnalysisStatus } from '@/lib/enterprise-analysis-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { analysisId: string } }
) {
  const { analysisId } = params

  // Set up Server-Sent Events (SSE)
  const encoder = new TextEncoder()
  
  const customReadable = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialData = `data: ${JSON.stringify({ 
        type: 'connected', 
        message: 'Real-time updates connected!' 
      })}\n\n`
      controller.enqueue(encoder.encode(initialData))

      // Set up interval to send progress updates
      const interval = setInterval(() => {
        try {
          const status = getAnalysisStatus(analysisId)
          
          if (!status) {
            // Analysis not found, close connection
            const errorData = `data: ${JSON.stringify({ 
              type: 'error', 
              message: 'Analysis not found' 
            })}\n\n`
            controller.enqueue(encoder.encode(errorData))
            clearInterval(interval)
            controller.close()
            return
          }

          // Send progress update with REAL results
          const progressData = `data: ${JSON.stringify({
            type: 'progress',
            data: {
              status: status.status,
              progress: status.progress,
              filesAnalyzed: status.filesAnalyzed,
              totalFiles: status.totalFiles,
              currentFile: status.currentFile,
              percentage: Math.round((status.filesAnalyzed / status.totalFiles) * 100) || 0,
              estimatedTime: getEstimatedTime(status)
            }
          })}\n\n`
          controller.enqueue(encoder.encode(progressData))

          // Send real analysis results as they come in
          if (status.results && status.results.length > 0) {
            const resultsData = `data: ${JSON.stringify({
              type: 'result',
              data: status.results[status.results.length - 1] // Send latest result
            })}\n\n`
            controller.enqueue(encoder.encode(resultsData))
          }

          // If analysis is complete or failed, close connection
          if (status.status === 'completed' || status.status === 'failed') {
            const completeData = `data: ${JSON.stringify({
              type: status.status === 'completed' ? 'complete' : 'error',
              data: {
                status: status.status,
                filesAnalyzed: status.filesAnalyzed,
                totalFiles: status.totalFiles,
                results: status.results || [],
                errors: status.errors || []
              }
            })}\n\n`
            controller.enqueue(encoder.encode(completeData))
            clearInterval(interval)
            controller.close()
          }
        } catch (error) {
          console.error('SSE error:', error)
          const errorData = `data: ${JSON.stringify({ 
            type: 'error', 
            message: 'Stream error occurred' 
          })}\n\n`
          controller.enqueue(encoder.encode(errorData))
          clearInterval(interval)
          controller.close()
        }
      }, 2000) // Update every 2 seconds

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

// Helper function to calculate estimated time remaining
function getEstimatedTime(status: any): string {
  if (status.progress === 0) return 'Calculating...'
  if (status.progress >= 100) return 'Complete!'
  
  const elapsed = Date.now() - status.startTime
  const estimatedTotal = (elapsed / status.progress) * 100
  const remaining = Math.max(0, estimatedTotal - elapsed)
  
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  
  if (minutes > 0) {
    return `~${minutes}m ${seconds}s remaining`
  } else {
    return `~${seconds}s remaining`
  }
}
