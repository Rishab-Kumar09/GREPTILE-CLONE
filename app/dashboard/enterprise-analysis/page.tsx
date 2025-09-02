'use client'

import { useState, useEffect, useRef } from 'react'

interface AnalysisResult {
  type: string
  pattern: string
  match: string
  timestamp: number
}

export default function EnterpriseAnalysis() {
  // Simple state - no counts!
  const [repoUrl, setRepoUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMode, setAnalysisMode] = useState<'incremental' | 'priority' | 'full'>('incremental')
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState('')
  const [results, setResults] = useState<AnalysisResult[]>([])
  
  // Polling for updates
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  // Analysis strategies
  const analysisStrategies = {
    incremental: {
      name: '⚡ Incremental Analysis',
      description: 'Like Greptile - Only analyze changed files since last scan',
      estimatedTime: '30 seconds - 2 minutes',
      color: 'bg-green-100 text-green-800'
    },
    priority: {
      name: '🎯 Priority Analysis', 
      description: 'Like SonarQube - Critical files first, stream results',
      estimatedTime: '2-5 minutes',
      color: 'bg-orange-100 text-orange-800'
    },
    full: {
      name: '🔍 Full Analysis',
      description: 'Complete analysis with background processing',
      estimatedTime: '5-30 minutes',
      color: 'bg-blue-100 text-blue-800'
    }
  }

  // Start polling
  const connectPolling = (analysisId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    setConnectionStatus('connecting')
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/enterprise-analysis/status/${analysisId}`)
        if (response.ok) {
          const status = await response.json()
          
          // Update progress without counts
          setProgress(status.progress || 0)
          setCurrentFile(status.currentFile || '')
          
          if (status.results) {
            setResults(status.results)
          }
          
          if (status.status === 'completed') {
            setIsAnalyzing(false)
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
          }
          
          if (!connectionStatus || connectionStatus === 'connecting') {
            setConnectionStatus('connected')
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
        setConnectionStatus('disconnected')
      }
    }, 2000)
  }

  // Start analysis
  const startAnalysis = async () => {
    if (!repoUrl.trim()) return

    setIsAnalyzing(true)
    setResults([])
    setProgress(0)
    setCurrentFile('')
    
    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      const response = await fetch('/api/enterprise-analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          strategy: analysisMode
        })
      })
      
      if (!response.ok) {
        throw new Error('Analysis failed to start')
      }
      
      const { analysisId } = await response.json()
      connectPolling(analysisId)
      
    } catch (error) {
      console.error('Failed to start analysis:', error)
      setIsAnalyzing(false)
    }
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">🚀 Enterprise Code Analysis</h1>
        <p className="text-gray-600">
          Competitor-inspired analysis: Incremental, Priority-based, and Streaming Results
        </p>
      </div>

      {/* Analysis Strategy Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Choose Analysis Strategy</h2>
        
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {Object.entries(analysisStrategies).map(([key, strategy]) => (
            <div
              key={key}
              className={`p-4 border-2 rounded-lg cursor-pointer ${
                analysisMode === key 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setAnalysisMode(key as any)}
            >
              <h3 className="font-bold mb-2">{strategy.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
              <span className={`inline-block px-2 py-1 rounded text-sm ${strategy.color}`}>
                ⏱️ {strategy.estimatedTime}
              </span>
            </div>
          ))}
        </div>

        {/* Repository Input */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="https://github.com/owner/repository"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={isAnalyzing}
            className="flex-1 px-4 py-2 border rounded"
          />
          <button 
            onClick={startAnalysis} 
            disabled={isAnalyzing || !repoUrl}
            className="px-6 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            {isAnalyzing ? '⚡ Analyzing...' : '🚀 Start Analysis'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Analysis Progress</h2>
            <span className={`px-2 py-1 rounded text-sm ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {connectionStatus === 'connected' ? '🟢 Live' : '🔴 Offline'}
            </span>
          </div>

          {/* Simple progress bar */}
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Current file - no counts! */}
            {currentFile && (
              <div className="text-sm text-gray-600">
                🔍 Analyzing: {currentFile}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results - no counts! */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Analysis Results</h2>
          
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded">
                <div className="font-mono text-sm mb-2">{result.match}</div>
                <div className="text-sm text-gray-500">
                  Found: {result.pattern} ({result.type})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}