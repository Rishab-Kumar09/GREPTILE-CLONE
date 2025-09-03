'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardHeader from '@/components/DashboardHeader'

interface AnalysisResult {
  type: string
  name: string
  file: string
  line: number
  code: string
  description: string
}

interface AnalysisStatus {
  status: string
  progress: number
  currentFile: string
  results: AnalysisResult[]
}

export default function EnterpriseAnalysisPage() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/facebook/react')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>({
    status: 'idle',
    progress: 0,
    currentFile: '',
    results: []
  })
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startAnalysis = async () => {
    if (!repoUrl.includes('github.com')) {
      alert('Please enter a valid GitHub URL')
      return
    }

    setIsAnalyzing(true)
    setStatus({
      status: 'starting',
      progress: 0,
      currentFile: 'Initializing...',
      results: []
    })

    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      console.log('🔄 Making API request...')
      const response = await fetch('/api/enterprise-analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo })
      })

      const data = await response.json()
      console.log('📡 API response:', data)

      if (data.success && data.analysisId) {
        setAnalysisId(data.analysisId)
        
        // Start polling for status updates
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/enterprise-analysis/status/${data.analysisId}`)
            const statusData = await statusResponse.json()
            
            if (statusData.status) {
              setStatus({
                status: statusData.status,
                progress: statusData.progress || 0,
                currentFile: statusData.currentFile || '',
                results: statusData.results || []
              })
              
              if (statusData.status === 'completed' || statusData.status === 'failed') {
                setIsAnalyzing(false)
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current)
                  pollingIntervalRef.current = null
                }
              }
            }
          } catch (error) {
            console.error('Status polling error:', error)
          }
        }, 2000)
        
      } else {
        setStatus({
          status: 'failed',
          progress: 0,
          currentFile: `Error: ${data.error}`,
          results: []
        })
        setIsAnalyzing(false)
      }
    } catch (error) {
      console.error('❌ Request failed:', error)
      setStatus({
        status: 'failed',
        progress: 0,
        currentFile: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: []
      })
      setIsAnalyzing(false)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="Enterprise Analysis" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            Enterprise Code Analysis
          </h1>
          <p className="text-gray-600">
            Competitor-inspired analysis: Incremental, Priority-based, and Streaming Results
          </p>
        </div>

        {/* Analysis Strategy Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-500">⚡</span>
              <h3 className="font-semibold text-gray-900">Incremental Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Like Greptile - Only analyze changed files since last scan
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">🕒</span>
              <span className="text-gray-500">30 seconds - 2 minutes</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-500">🎯</span>
              <h3 className="font-semibold text-gray-900">Priority Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Like SonarQube - Critical files first, stream results
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-600">🕒</span>
              <span className="text-gray-500">2-5 minutes</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-500">🔍</span>
              <h3 className="font-semibold text-gray-900">Full Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Complete analysis with background processing
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600">🕒</span>
              <span className="text-gray-500">5-30 minutes</span>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isAnalyzing}
              />
            </div>
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Start Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Analysis Progress */}
        {(isAnalyzing || status.status !== 'idle') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Progress</h2>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{status.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                status.status === 'completed' ? 'bg-green-500' :
                status.status === 'failed' ? 'bg-red-500' :
                'bg-blue-500 animate-pulse'
              }`}></div>
              <span>{status.currentFile || 'Processing...'}</span>
            </div>
          </div>
        )}

        {/* Results Section */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <span>📊</span>
              Analysis Results ({status.results.length} found)
            </h2>
            
            <div className="space-y-4">
              {status.results.map((result, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                        {result.type}
                      </span>
                      <h3 className="font-medium text-gray-900">{result.name}</h3>
                    </div>
                    <span className="text-gray-500 text-sm">
                      {result.file}:{result.line}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">{result.description}</p>
                  
                  <div className="bg-gray-900 rounded p-3 border">
                    <code className="text-green-400 text-sm font-mono">
                      {result.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}