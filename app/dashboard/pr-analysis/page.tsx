'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardHeader from '../../../components/DashboardHeader'

interface AnalysisResult {
  file: string
  bugs: Array<{
    line: number
    severity: string
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  securityIssues: Array<{
    line: number
    severity: string
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  codeSmells: Array<{
    line: number
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
}

interface Repository {
  id: string
  name: string
  fullName: string
  bugs: number
  analysisResults?: AnalysisResult[]
}

function PRAnalysisContent() {
  const searchParams = useSearchParams()
  const repoName = searchParams.get('repo')
  
  const [repository, setRepository] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [setupConfig, setSetupConfig] = useState<any>(null)
  const [expandedFiles, setExpandedFiles] = useState<{[key: string]: boolean}>({})

  useEffect(() => {
    if (repoName) {
      loadAnalysisData()
      loadSetupConfig()
    }
  }, [repoName])

  const loadAnalysisData = async () => {
    try {
      // Load repository data
      const repoResponse = await fetch('/api/repositories')
      if (repoResponse.ok) {
        const repos = await repoResponse.json()
        const repo = repos.find((r: any) => r.fullName === repoName)
        if (repo) {
          setRepository(repo)
          
          // Load analysis results
                     const analysisResponse = await fetch(`/api/github/analysis-results?repo=${encodeURIComponent(repoName || '')}`)
           if (analysisResponse.ok) {
             const analysisData = await analysisResponse.json()
             setAnalysisResults(analysisData.results || [])
           }
        }
      }
    } catch (error) {
      console.error('Error loading analysis data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSetupConfig = async () => {
    // In a real app, this would load from user's setup configuration
    // For now, we'll use default values that match Setup Bot
    setSetupConfig({
      strictnessLevel: 60,
      commentTypes: {
        syntax: true,
        logic: true,
        style: true
      },
      filters: {
        labels: '',
        authors: '',
        branches: 'main,develop',
        keywords: 'TODO,FIXME'
      },
      prSummaryEnabled: true
    })
  }

  const toggleFileExpanded = (fileName: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileName]: !prev[fileName]
    }))
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'security': return '🔒'
      case 'bug': return '🐛'
      case 'performance': return '⚡'
      case 'style': return '🎨'
      case 'logic': return '🧠'
      default: return '💡'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader currentPage="repositories" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">Loading analysis...</span>
        </div>
      </div>
    )
  }

  if (!repository) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader currentPage="repositories" />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Repository Not Found</h1>
            <p className="text-gray-600">The requested repository could not be found or has not been analyzed yet.</p>
          </div>
        </div>
      </div>
    )
  }

  const totalIssues = analysisResults.reduce((total, result) => 
    total + result.bugs.length + result.securityIssues.length + result.codeSmells.length, 0
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="repositories" />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* PR Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Code Analysis for {repository.name}
                  </h1>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    ✅ Reviewed
                  </span>
                </div>
                <p className="text-gray-600 mt-1">{repository.fullName}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Analysis completed</div>
                <div className="text-lg font-semibold text-gray-900">{totalIssues} issues found</div>
              </div>
            </div>
          </div>

          {/* PR Summary (if enabled in setup) */}
          {setupConfig?.prSummaryEnabled && (
            <div className="p-6 bg-blue-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">🤖 AI-Generated PR Summary</h3>
              <p className="text-gray-700">
                This analysis identified <strong>{totalIssues} issues</strong> across <strong>{analysisResults.length} files</strong> in {repository.name}. 
                The review focused on {setupConfig.commentTypes.syntax && 'syntax'}{setupConfig.commentTypes.logic && ', logic'}{setupConfig.commentTypes.style && ', and style'} issues 
                with a strictness level of {setupConfig.strictnessLevel}%. Key areas requiring attention include security vulnerabilities, 
                code quality improvements, and potential bugs that could impact application stability.
              </p>
            </div>
          )}

          {/* Analysis Stats */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {analysisResults.reduce((total, result) => total + result.bugs.length, 0)}
                </div>
                <div className="text-sm text-gray-500">Bugs Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisResults.reduce((total, result) => total + result.securityIssues.length, 0)}
                </div>
                <div className="text-sm text-gray-500">Security Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analysisResults.reduce((total, result) => total + result.codeSmells.length, 0)}
                </div>
                <div className="text-sm text-gray-500">Code Smells</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{analysisResults.length}</div>
                <div className="text-sm text-gray-500">Files Analyzed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="space-y-4">
          {analysisResults.map((result, index) => {
                         const allIssues = [
               ...result.bugs.map(bug => ({ ...bug, category: 'bug', severity: bug.severity || 'medium' })),
               ...result.securityIssues.map(issue => ({ ...issue, category: 'security', severity: issue.severity || 'medium' })),
               ...result.codeSmells.map(smell => ({ ...smell, category: 'style', severity: 'low' }))
             ].sort((a, b) => a.line - b.line)

            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div 
                  className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleFileExpanded(result.file)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <svg className={`w-5 h-5 transform transition-transform ${expandedFiles[result.file] ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900">{result.file}</h3>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {allIssues.length} issues
                      </span>
                    </div>
                  </div>
                </div>

                {expandedFiles[result.file] && (
                  <div className="p-4 space-y-4">
                    {allIssues.map((issue, issueIndex) => (
                      <div key={issueIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getTypeIcon(issue.category)}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(issue.severity || 'medium')}`}>
                              {issue.severity || 'Medium'}
                            </span>
                            <span className="text-sm text-gray-500">Line {issue.line}</span>
                          </div>
                        </div>
                        
                        <h4 className="font-medium text-gray-900 mb-2">{issue.type}</h4>
                        <p className="text-gray-700 mb-3">{issue.description}</p>
                        
                        {issue.codeSnippet && (
                          <div className="bg-gray-900 rounded-md p-3 mb-3">
                            <pre className="text-sm text-gray-100 overflow-x-auto">
                              <code>{issue.codeSnippet}</code>
                            </pre>
                          </div>
                        )}
                        
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <h5 className="text-sm font-medium text-green-800 mb-1">💡 Suggestion</h5>
                          <p className="text-sm text-green-700">{issue.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {analysisResults.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Results</h3>
              <p className="text-gray-600">This repository has not been analyzed yet or the analysis is still in progress.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PRAnalysis() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader currentPage="repositories" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">Loading analysis...</span>
        </div>
      </div>
    }>
      <PRAnalysisContent />
    </Suspense>
  )
} 