'use client'

import { useState, useEffect, useRef } from 'react'
// Using standard HTML components with Tailwind CSS - no external UI library needed

interface AnalysisResult {
  file: string
  bugs?: Array<{
    type: 'bug' | 'security' | 'smell'
    severity: 'critical' | 'high' | 'medium' | 'low'
    line: number
    message: string
    code: string
  }>
  securityIssues?: Array<{
    type: 'bug' | 'security' | 'smell'
    severity: 'critical' | 'high' | 'medium' | 'low'
    line: number
    message: string
    code: string
  }>
  codeSmells?: Array<{
    type: 'bug' | 'security' | 'smell'
    severity: 'critical' | 'high' | 'medium' | 'low'
    line: number
    message: string
    code: string
  }>
  // Computed property for all issues
  issues?: Array<{
    type: 'bug' | 'security' | 'smell'
    severity: 'critical' | 'high' | 'medium' | 'low'
    line: number
    message: string
    code: string
  }>
  timestamp?: number
}

interface StreamingUpdate {
  type: 'progress' | 'result' | 'complete' | 'error'
  data: any
}

export default function EnterpriseAnalysis() {
  // State management
  const [repoUrl, setRepoUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMode, setAnalysisMode] = useState<'incremental' | 'priority' | 'full'>('incremental')
  
  // Progress tracking
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState('')
  const [filesAnalyzed, setFilesAnalyzed] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState('')
  const [currentStage, setCurrentStage] = useState<'initializing' | 'downloading' | 'extracting' | 'scanning' | 'analyzing' | 'complete'>('initializing')
  const [downloadSpeed, setDownloadSpeed] = useState('')
  const [eta, setEta] = useState('')
  
  // Results streaming
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [criticalIssues, setCriticalIssues] = useState(0)
  const [totalIssues, setTotalIssues] = useState(0)
  const [analysisStrategy, setAnalysisStrategy] = useState('')
  
  // Polling for real-time updates (better for serverless)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  // Competitor-inspired analysis strategies
  const analysisStrategies = {
    incremental: {
      name: '🚀 Incremental Analysis',
      description: 'Like Greptile - Only analyze changed files since last scan',
      icon: '⚡',
      estimatedTime: '30 seconds - 2 minutes',
      color: 'bg-green-100 text-green-800'
    },
    priority: {
      name: '🎯 Priority Analysis', 
      description: 'Like SonarQube - Critical files first, stream results',
      icon: '🔥',
      estimatedTime: '2-5 minutes',
      color: 'bg-orange-100 text-orange-800'
    },
    full: {
      name: '🏭 Full Analysis',
      description: 'Complete analysis with background processing',
      icon: '🌊',
      estimatedTime: '5-30 minutes',
      color: 'bg-blue-100 text-blue-800'
    }
  }

  // Initialize polling connection  
  const connectPolling = (analysisId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    setConnectionStatus('connecting')
    
    // Start polling for updates
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/enterprise-analysis/status/${analysisId}`)
        if (response.ok) {
          const status = await response.json()
          handlePollingUpdate(status)
          if (!connectionStatus || connectionStatus === 'connecting') {
            setConnectionStatus('connected')
            console.log('🔄 Polling connected for real-time updates')
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
        setConnectionStatus('disconnected')
      }
    }, 2000) // Poll every 2 seconds
  }

  // Handle polling updates (replaces SSE message handler)
  const handlePollingUpdate = (status: any) => {
    try {
      // Update progress
      setProgress(status.progress || 0)
      setFilesAnalyzed(status.filesAnalyzed || 0)
      setTotalFiles(status.totalFiles || 0)
      setCurrentFile(status.currentFile || '')
      
      // Update stage based on status
      if (status.status === 'cloning') {
        setCurrentStage('downloading')
      } else if (status.status === 'scanning') {
        setCurrentStage('scanning')  
      } else if (status.status === 'analyzing') {
        setCurrentStage('analyzing')
      } else if (status.status === 'completed') {
        setCurrentStage('complete')
        setIsAnalyzing(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
      } else if (status.status === 'failed') {
        setIsAnalyzing(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
      }
      
      // Update results if available
      if (status.results && status.results.length > 0) {
        setResults(status.results)
        const totalIssues = status.results.reduce((sum: number, result: any) => 
          sum + (result.issues?.length || 0), 0)
        setTotalIssues(totalIssues)
        setCriticalIssues(status.results.reduce((sum: number, result: any) => 
          sum + (result.issues?.filter((issue: any) => issue.severity === 'high').length || 0), 0))
      }
    } catch (error) {
      console.error('Failed to process polling update:', error)
    }
  }



  // Handle real-time streaming updates
  const handleStreamingUpdate = (update: StreamingUpdate) => {
    switch (update.type) {
      case 'progress':
        setProgress(update.data.percentage)
        setCurrentFile(update.data.currentFile)
        setFilesAnalyzed(update.data.filesAnalyzed)
        setTotalFiles(update.data.totalFiles)
        setEstimatedTime(update.data.estimatedTime)
        
        // Handle new stage-specific progress
        if (update.data.stage) {
          setCurrentStage(update.data.stage)
        }
        if (update.data.downloadSpeed) {
          setDownloadSpeed(update.data.downloadSpeed)
        }
        if (update.data.eta) {
          setEta(update.data.eta)
        }
        break
        
      case 'result':
        // Stream results as they come in
        const newResult: AnalysisResult = update.data
        
        // Combine all issues from different categories
        const allIssues = [
          ...(newResult.bugs || []),
          ...(newResult.securityIssues || []),
          ...(newResult.codeSmells || [])
        ]
        
        // Add computed issues property
        newResult.issues = allIssues
        
        setResults(prev => [...prev, newResult])
        
        // Update counters
        const criticalCount = allIssues.filter(i => i.severity === 'critical').length
        setCriticalIssues(prev => prev + criticalCount)
        setTotalIssues(prev => prev + allIssues.length)
        break
        
      case 'complete':
        setIsAnalyzing(false)
        setProgress(100)
        console.log('✅ Analysis complete!', update.data)
        break
        
      case 'error':
        console.error('❌ Analysis error:', update.data)
        setIsAnalyzing(false)
        break
    }
  }

  // Start enterprise analysis
  const startAnalysis = async () => {
    if (!repoUrl.trim()) return

    setIsAnalyzing(true)
    setResults([])
    setCriticalIssues(0)
    setTotalIssues(0)
    setProgress(0)
    
    try {
      // Parse repository URL
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      // Start analysis with selected strategy
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed to start')
      }
      
      const { analysisId, strategy } = await response.json()
      setAnalysisStrategy(strategy?.description || 'Analysis started')
      
      // Connect Server-Sent Events for real-time updates
      connectPolling(analysisId)
      
      // Fallback polling in case SSE fails
      const pollInterval = setInterval(async () => {
        if (!isAnalyzing) {
          clearInterval(pollInterval)
          return
        }
        
        try {
          const statusResponse = await fetch(`/api/enterprise-analysis/status/${analysisId}`)
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            
            // Update UI with polling data if SSE is disconnected
            if (connectionStatus === 'disconnected') {
              setProgress(statusData.progress || 0)
              setFilesAnalyzed(statusData.filesAnalyzed || 0)
              setTotalFiles(statusData.totalFiles || 0)
              setCurrentFile(statusData.currentFile || '')
              
              if (statusData.status === 'completed') {
                setIsAnalyzing(false)
                clearInterval(pollInterval)
              }
            }
          }
        } catch (pollError) {
          console.warn('Polling failed:', pollError)
        }
      }, 5000) // Poll every 5 seconds as fallback
      
    } catch (error) {
      console.error('Failed to start analysis:', error)
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800' 
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'security': return '🚨'
      case 'bug': return '🐛'
      case 'smell': return '👃'
      default: return '⚠️'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🚀 Enterprise Code Analysis</h1>
        <p className="text-gray-600">
          Competitor-inspired analysis: Incremental, Priority-based, and Streaming Results
        </p>
      </div>

      {/* Analysis Strategy Selection */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Choose Analysis Strategy</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {Object.entries(analysisStrategies).map(([key, strategy]) => (
              <div
                key={key}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  analysisMode === key 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setAnalysisMode(key as any)}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">{strategy.icon}</span>
                  <h3 className="font-semibold">{strategy.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${strategy.color}`}>
                  ⏱️ {strategy.estimatedTime}
                </span>
              </div>
            ))}
          </div>

          {/* Repository Input */}
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="https://github.com/owner/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isAnalyzing}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
            <button 
              onClick={startAnalysis} 
              disabled={isAnalyzing || !repoUrl.trim()}
              className="min-w-[150px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {isAnalyzing ? '🔄 Analyzing...' : '🚀 Start Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Progress */}
      {isAnalyzing && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">📊 Live Analysis Progress</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {connectionStatus === 'connected' ? '🟢 Live' : '🔴 Offline'}
              </span>
            </div>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>
                  {currentStage === 'downloading' && '📥 Downloading repository...'}
                  {currentStage === 'extracting' && '📥 Downloading files...'}
                  {currentStage === 'scanning' && '📁 Getting file list...'}
                  {currentStage === 'analyzing' && `🔍 Analyzing: ${filesAnalyzed} / ${totalFiles} files`}
                  {currentStage === 'initializing' && '🚀 Preparing analysis...'}
                  {currentStage === 'complete' && '✅ Analysis complete!'}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              
              {/* Stage-specific details */}
              {currentStage === 'downloading' && downloadSpeed && eta && (
                <div className="text-xs text-gray-600 mb-2">
                  {downloadSpeed} • ETA: {eta}
                </div>
              )}
              
              {currentStage === 'analyzing' && currentFile && (
                <div className="text-xs text-gray-600 mb-2 truncate">
                  Current: {currentFile}
                </div>
              )}
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{criticalIssues}</div>
                <div className="text-sm text-gray-600">🚨 Critical Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalIssues}</div>
                <div className="text-sm text-gray-600">📊 Total Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{results.length}</div>
                <div className="text-sm text-gray-600">📁 Files Processed</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-purple-600">{estimatedTime}</div>
                <div className="text-sm text-gray-600">⏱️ Est. Remaining</div>
              </div>
            </div>
            
            {currentFile && (
              <div className="bg-gray-50 p-3 rounded">
                <span className="text-sm text-gray-600">Currently analyzing: </span>
                <span className="font-mono text-sm">{currentFile}</span>
              </div>
            )}
            
            {analysisStrategy && (
              <div className="bg-blue-50 p-3 rounded">
                <span className="text-sm text-blue-600">Strategy: </span>
                <span className="text-sm">{analysisStrategy}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streaming Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">🔄 Live Results Stream</h3>
          </div>
          <div className="px-6 py-4">
            <div className="w-full">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button className="border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
                    🚨 Critical ({results.reduce((acc, r) => acc + (r.issues || []).filter(i => i.severity === 'critical').length, 0)})
                  </button>
                  <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
                    📊 All Issues ({totalIssues})
                  </button>
                  <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
                    📁 Files ({results.length})
                  </button>
                </nav>
              </div>
              
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                {/* Show ALL issues, not just critical */}
                {results.map((result, idx) => 
                  (result.issues || []).map((issue, issueIdx) => (
                    <div 
                      key={`${idx}-${issueIdx}`} 
                      className={`border-l-4 pl-4 py-3 cursor-pointer hover:bg-gray-50 rounded-r transition-colors ${
                        issue.severity === 'critical' ? 'border-red-500 bg-red-50' :
                        issue.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                        issue.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                      onClick={() => {
                        // Copy issue details to clipboard for easy viewing
                        const issueText = `${result.file}:${issue.line}\n${issue.message}\n\n${issue.code || ''}`
                        navigator.clipboard.writeText(issueText)
                        alert(`Issue details copied to clipboard!\n\nFile: ${result.file}:${issue.line}\nType: ${issue.type}\nSeverity: ${issue.severity}`)
                      }}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getTypeIcon(issue.type)}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                          {issue.severity.toUpperCase()}
                        </span>
                        <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {result.file}:{issue.line}
                        </span>
                        <span className="text-xs text-gray-500">Click to copy details</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-2">{issue.message}</p>
                      {issue.code && (
                        <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                          <code>{issue.code}</code>
                        </pre>
                      )}
                    </div>
                  ))
                )}
                
                {/* Show message if no issues found yet */}
                {results.length > 0 && totalIssues === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">🔍</div>
                    <p>No issues found yet. Analysis in progress...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">💡 How This Works</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <span className="mr-2">⚡</span>
                Incremental Analysis
              </h4>
              <p className="text-sm text-gray-600">
                Like Greptile - Only analyzes files changed since the last scan. Perfect for regular monitoring.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <span className="mr-2">🎯</span>
                Priority Analysis
              </h4>
              <p className="text-sm text-gray-600">
                Like SonarQube - Analyzes critical files first and streams results in real-time.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <span className="mr-2">🌊</span>
                Streaming Results
              </h4>
              <p className="text-sm text-gray-600">
                See issues as they're discovered. No waiting for complete analysis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
