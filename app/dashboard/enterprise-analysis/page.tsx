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
  const [expandedFiles, setExpandedFiles] = useState<{[key: string]: boolean}>({})
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const toggleFileExpanded = (fileName: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileName]: !prev[fileName]
    }))
  }

  const groupResultsByFile = (results: AnalysisResult[]) => {
    const grouped = results.reduce((acc, result) => {
      if (!acc[result.file]) {
        acc[result.file] = []
      }
      acc[result.file].push(result)
      return acc
    }, {} as {[key: string]: AnalysisResult[]})

    return Object.entries(grouped).map(([file, issues]) => ({
      file,
      issues: issues.sort((a, b) => a.line - b.line)
    }))
  }

  const getTypeIcon = (type: string) => {
    const icons: {[key: string]: string} = {
      'function': '⚡',
      'component': '🧩', 
      'import': '📦',
      'api': '🌐',
      'security': '🔒',
      'database': '🗄️',
      'config': '⚙️',
      'performance': '🚀',
      'type': '📝'
    }
    return icons[type] || '📄'
  }

  const getSeverityColor = (description: string) => {
    if (description.includes('HIGH:')) {
      return 'bg-red-100 text-red-800'
    } else if (description.includes('MEDIUM:')) {
      return 'bg-orange-100 text-orange-800'
    } else {
      return 'bg-blue-100 text-blue-800'
    }
  }

  const getSeverityLevel = (description: string) => {
    if (description.includes('HIGH:')) return 'High'
    if (description.includes('MEDIUM:')) return 'Medium'
    return 'Info'
  }

  const getAISuggestion = (type: string, name: string, description: string) => {
    const suggestions: {[key: string]: string} = {
      'function': 'Consider adding JSDoc comments to document this function\'s purpose, parameters, and return value. This improves code maintainability and helps other developers understand the function\'s behavior.',
      'component': 'Ensure this component follows React best practices: use proper prop types, implement error boundaries if needed, and consider memoization for performance optimization.',
      'import': 'Review this import to ensure it\'s necessary and consider using tree-shaking to reduce bundle size. Group related imports together for better organization.',
      'api': 'Add proper error handling, loading states, and timeout configuration. Consider implementing retry logic and caching for better user experience.',
      'security': 'This appears to contain sensitive information. Move secrets to environment variables, use proper encryption, and never commit sensitive data to version control.',
      'database': 'Implement proper error handling, input validation, and consider using prepared statements to prevent SQL injection. Add appropriate indexes for performance.',
      'config': 'Ensure configuration values are properly validated and have fallback defaults. Consider using a configuration management system for complex applications.',
      'performance': 'This pattern might impact performance. Consider optimization techniques like memoization, lazy loading, or moving expensive operations to web workers.',
      'type': 'Good TypeScript usage! Consider making types more specific and adding documentation comments for complex type definitions.'
    }
    
    return suggestions[type] || 'Review this code pattern for potential improvements in readability, maintainability, and performance. Consider following established best practices for this technology stack.'
  }

  const startAnalysis = async () => {
    if (!repoUrl.includes('github.com')) {
      alert('Please enter a valid GitHub URL')
      return
    }

    setIsAnalyzing(true)
    setStatus({
      status: 'analyzing',
      progress: 50,
      currentFile: 'Calling Lambda function...',
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

      if (data.success) {
        setAnalysisId(data.analysisId)
        
        // Handle direct results (no polling needed)
        if (data.results && data.results.length > 0) {
          console.log(`🎉 Got ${data.results.length} results directly from Lambda!`)
          setStatus({
            status: 'completed',
            progress: 100,
            currentFile: data.message || 'Analysis completed!',
            results: data.results
          })
        } else if (data.status === 'completed') {
          // Lambda completed but no results
          setStatus({
            status: 'completed',
            progress: 100,
            currentFile: 'Analysis completed - no code patterns found',
            results: []
          })
        } else {
          // No results - show error
          setStatus({
            status: 'failed',
            progress: 0,
            currentFile: data.error || 'No results returned',
            results: []
          })
        }
        
      } else {
        setStatus({
          status: 'failed',
          progress: 0,
          currentFile: `Error: ${data.error}`,
          results: []
        })
      }
      
      setIsAnalyzing(false)
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

        {/* AI Summary */}
        {status.results.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>🤖</span>
              AI-Generated Analysis Summary
            </h3>
            <p className="text-gray-700">
              This analysis identified <strong>{status.results.length} issues</strong> across <strong>{Math.ceil(status.results.length / 10)} files</strong> in the repository. 
              The review focused on functions, components, security patterns, and API calls with comprehensive code scanning. 
              Key areas requiring attention include potential security vulnerabilities, performance optimizations, 
              and code quality improvements that could enhance application stability and maintainability.
            </p>
          </div>
        )}

        {/* Analysis Stats */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {status.results.filter(r => r.description.includes('HIGH:')).length}
                </div>
                <div className="text-sm text-gray-500">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {status.results.filter(r => r.description.includes('MEDIUM:')).length}
                </div>
                <div className="text-sm text-gray-500">Medium Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {status.results.filter(r => r.description.includes('INFO:')).length}
                </div>
                <div className="text-sm text-gray-500">Informational</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{status.results.length}</div>
                <div className="text-sm text-gray-500">Total Issues</div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {status.results.length > 0 && (
          <div className="space-y-4">
            {groupResultsByFile(status.results).map((fileGroup, fileIndex) => (
              <div key={fileIndex} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div 
                  className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleFileExpanded(fileGroup.file)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <svg className={`w-5 h-5 transform transition-transform ${expandedFiles[fileGroup.file] ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900">{fileGroup.file}</h3>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {fileGroup.issues.length} issues
                      </span>
                    </div>
                  </div>
                </div>

                {expandedFiles[fileGroup.file] && (
                  <div className="p-4 space-y-4">
                    {fileGroup.issues.map((result, issueIndex) => (
                      <div key={issueIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getTypeIcon(result.type)}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(result.description)}`}>
                              {getSeverityLevel(result.description)}
                            </span>
                            <span className="text-sm text-gray-500">Line {result.line}</span>
                          </div>
                        </div>
                        
                        <h4 className="font-medium text-gray-900 mb-2">{result.name}</h4>
                        <p className="text-gray-700 mb-3">{result.description}</p>
                        
                        <div className="bg-gray-900 rounded p-3 border mb-3">
                          <code className="text-green-400 text-sm font-mono">
                            {result.code}
                          </code>
                        </div>

                        {/* AI Suggestion */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <span className="text-blue-600 mt-0.5">🤖</span>
                            <div>
                              <h5 className="font-medium text-blue-900 mb-1">AI Suggestion:</h5>
                              <p className="text-blue-800 text-sm">
                                {getAISuggestion(result.type, result.name, result.description)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}