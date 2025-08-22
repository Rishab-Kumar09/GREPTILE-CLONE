'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'

interface Repository {
  id?: string | number
  name: string
  fullName: string
  language?: string
  bugs: number
  stars: number
  forks: number
  description?: string
  analyzing?: boolean
  createdAt?: string
  updatedAt?: string
  analysisResults?: {
    summary: {
      totalBugs: number
      totalSecurityIssues: number
      totalCodeSmells: number
      totalFilesProcessed: number
    }
    allResults: AnalysisResult[]
  }
}

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

interface Review {
  id: string | number
  prTitle: string
  repository: string
  author: string
  createdAt: string
  status: string
  aiComments: number
  bugsFound: number
  severity: string
  prNumber: number
  suggestions: number
  analysisResults?: AnalysisResult[]
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [expandedReviews, setExpandedReviews] = useState<{[key: string]: boolean}>({})
  const [profilePic, setProfilePic] = useState<string | null>(null)

  // Load repositories and their analysis results
  const loadReviews = async () => {
    try {
      const response = await fetch('/api/repositories')
      if (response.ok) {
        const repos: Repository[] = await response.json()
        setRepositories(repos)
        
        // Convert repositories with analysis results to review format  
        const reviewsData: Review[] = []
        
        for (const repo of repos) {
          if (repo.analyzing === false && repo.bugs > 0) {
            // Use analysis results directly from repository data
            let analysisResults: AnalysisResult[] = []
            
            console.log(`🔍 REVIEWS: Loading analysis for ${repo.fullName}`)
            console.log(`🔍 REVIEWS: Repository analysisResults:`, repo.analysisResults)
            
            if (repo.analysisResults && repo.analysisResults.allResults) {
              analysisResults = repo.analysisResults.allResults
              console.log(`✅ REVIEWS: Found ${analysisResults.length} analysis results for ${repo.fullName}`)
            } else {
              console.log(`❌ REVIEWS: No analysis results found for ${repo.fullName}`)
            }

            reviewsData.push({
              id: repo.id || reviewsData.length + 1,
              prTitle: `Code Analysis for ${repo.name}`,
              repository: repo.fullName,
              author: repo.fullName.split('/')[0],
              createdAt: repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString() : 'Recently',
              status: 'reviewed',
              aiComments: Math.floor(repo.bugs * 0.8),
              bugsFound: repo.bugs,
              suggestions: Math.floor(repo.bugs * 1.2),
              severity: repo.bugs > 5 ? 'high' : repo.bugs > 2 ? 'medium' : 'low',
              prNumber: Math.floor(Math.random() * 100) + 1,
              analysisResults
            })
          }
        }

        setReviews(reviewsData)
      }
    } catch (error) {
      console.error('Error loading reviews:', error)
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadReviews()
    // Load profile picture from localStorage
    const savedProfilePic = localStorage.getItem('profileImage')
    if (savedProfilePic) {
      setProfilePic(savedProfilePic)
    }
  }, [])

  // Toggle expanded state for reviews
  const toggleReviewExpanded = (reviewId: string | number) => {
    setExpandedReviews(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }))
  }

  // Get all issues from analysis results
  const getAllIssues = (review: Review) => {
    if (!review.analysisResults) return []
    
    const allIssues: Array<{
      type: 'bug' | 'security' | 'codeSmell'
      file: string
      line: number
      severity?: string
      title: string
      description: string
      suggestion: string
      codeSnippet?: string
    }> = []

    review.analysisResults.forEach(result => {
      // Add bugs
      result.bugs?.forEach(bug => {
        allIssues.push({
          type: 'bug',
          file: result.file,
          line: bug.line,
          severity: bug.severity,
          title: bug.type,
          description: bug.description,
          suggestion: bug.suggestion,
          codeSnippet: bug.codeSnippet
        })
      })

      // Add security issues
      result.securityIssues?.forEach(security => {
        allIssues.push({
          type: 'security',
          file: result.file,
          line: security.line,
          severity: security.severity,
          title: security.type,
          description: security.description,
          suggestion: security.suggestion,
          codeSnippet: security.codeSnippet
        })
      })

      // Add code smells
      result.codeSmells?.forEach(smell => {
        allIssues.push({
          type: 'codeSmell',
          file: result.file,
          line: smell.line,
          title: smell.type,
          description: smell.description,
          suggestion: smell.suggestion,
          codeSnippet: smell.codeSnippet
        })
      })
    })

    return allIssues
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="reviews" />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-lg">📋</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Reviews</dt>
                    <dd className="text-lg font-medium text-gray-900">{reviews.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-lg">🐛</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Issues Found</dt>
                    <dd className="text-lg font-medium text-gray-900">{reviews.reduce((sum, r) => sum + r.bugsFound, 0)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 text-lg">💡</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">AI Suggestions</dt>
                    <dd className="text-lg font-medium text-gray-900">{reviews.reduce((sum, r) => sum + r.suggestions, 0)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-lg">⚡</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Review Time</dt>
                    <dd className="text-lg font-medium text-gray-900">68.0m</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="mt-8 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="sm:flex sm:items-center sm:justify-between">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Reviews</h3>
              <div className="mt-3 flex space-x-3 sm:mt-0">
                <select className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm">
                  <option>All Repositories</option>
                </select>
                <select className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm">
                  <option>All Status</option>
                </select>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-200 last:border-b-0">
                <div 
                  className="p-6 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleReviewExpanded(review.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {review.prTitle}
                        </h3>
                        <span className="text-sm text-gray-500">
                          #{review.prNumber}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          review.severity === 'high' 
                            ? 'bg-red-100 text-red-800'
                            : review.severity === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {review.severity} priority
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {review.repository} • by {review.author} • {review.createdAt}
                      </p>
                      <div className="flex items-center space-x-6">
                        <span className="flex items-center text-sm text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                          </svg>
                          {review.aiComments} AI comments
                        </span>
                        <span className="flex items-center text-sm text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {review.bugsFound} bugs
                        </span>
                        <span className="flex items-center text-sm text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          {review.suggestions} suggestions
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        review.status === 'reviewed' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {review.status}
                      </span>
                      <svg 
                        className={`ml-2 w-5 h-5 text-gray-400 transform transition-transform ${
                          expandedReviews[review.id] ? 'rotate-90' : ''
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Expandable Content */}
                {expandedReviews[review.id] && (
                  <div className="px-6 pb-6 bg-gray-50">
                    <div className="space-y-6">
                      {/* Real Issues from Analysis */}
                      {getAllIssues(review).length > 0 ? (
                        <div className="space-y-6">
                          <h4 className="font-medium text-gray-900">🔍 Issues Found</h4>
                          
                          {/* Group issues by file */}
                          {review.analysisResults?.map((fileResult, fileIndex) => (
                            <div key={fileIndex} className="bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center mb-4">
                                <span className="text-yellow-600 text-lg mr-2">📁</span>
                                <h5 className="font-medium text-gray-900">{fileResult.file}</h5>
                              </div>

                              {/* Security Issues */}
                              {fileResult.securityIssues?.length > 0 && (
                                <div className="mb-6">
                                  <div className="flex items-center mb-3">
                                    <span className="text-red-600 text-lg mr-2">🔒</span>
                                    <h6 className="font-medium text-red-700">Security Issues ({fileResult.securityIssues.length}):</h6>
                                  </div>
                                  {fileResult.securityIssues.map((issue, issueIndex) => (
                                    <div key={issueIndex} className="mb-4 last:mb-0">
                                      <div className="flex items-center justify-between mb-2">
                                        <h6 className="font-medium text-red-800">Line {issue.line}: {issue.type}</h6>
                                        {issue.severity && (
                                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                            issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                            issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                            issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-blue-100 text-blue-800'
                                          }`}>
                                            {issue.severity}
                                          </span>
                                        )}
                                      </div>
                                      {issue.codeSnippet && (
                                        <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono mb-2 overflow-x-auto">
                                          <span className="text-gray-400">Line {issue.line}:</span> {issue.codeSnippet}
                                        </div>
                                      )}
                                      <p className="text-red-700 text-sm mb-2">{issue.description}</p>
                                      {issue.suggestion && (
                                        <p className="text-red-600 text-sm italic flex items-start">
                                          <span className="mr-1">💡</span>
                                          <span>{issue.suggestion}</span>
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Logic Bugs */}
                              {fileResult.bugs?.length > 0 && (
                                <div className="mb-6">
                                  <div className="flex items-center mb-3">
                                    <span className="text-orange-600 text-lg mr-2">🐛</span>
                                    <h6 className="font-medium text-orange-700">Logic Bugs ({fileResult.bugs.length}):</h6>
                                  </div>
                                  {fileResult.bugs.map((bug, bugIndex) => (
                                    <div key={bugIndex} className="mb-4 last:mb-0">
                                      <div className="flex items-center justify-between mb-2">
                                        <h6 className="font-medium text-orange-800">Line {bug.line}: {bug.type}</h6>
                                        {bug.severity && (
                                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                            bug.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                            bug.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                            bug.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-blue-100 text-blue-800'
                                          }`}>
                                            {bug.severity}
                                          </span>
                                        )}
                                      </div>
                                      {bug.codeSnippet && (
                                        <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono mb-2 overflow-x-auto">
                                          <span className="text-gray-400">Line {bug.line}:</span> {bug.codeSnippet}
                                        </div>
                                      )}
                                      <p className="text-orange-700 text-sm mb-2">{bug.description}</p>
                                      {bug.suggestion && (
                                        <p className="text-orange-600 text-sm italic flex items-start">
                                          <span className="mr-1">💡</span>
                                          <span>{bug.suggestion}</span>
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Code Smells */}
                              {fileResult.codeSmells?.length > 0 && (
                                <div className="mb-6">
                                  <div className="flex items-center mb-3">
                                    <span className="text-yellow-600 text-lg mr-2">💡</span>
                                    <h6 className="font-medium text-yellow-700">Code Smells ({fileResult.codeSmells.length}):</h6>
                                  </div>
                                  {fileResult.codeSmells.map((smell, smellIndex) => (
                                    <div key={smellIndex} className="mb-4 last:mb-0">
                                      <h6 className="font-medium text-yellow-800 mb-2">Line {smell.line}: {smell.type}</h6>
                                      {smell.codeSnippet && (
                                        <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono mb-2 overflow-x-auto">
                                          <span className="text-gray-400">Line {smell.line}:</span> {smell.codeSnippet}
                                        </div>
                                      )}
                                      <p className="text-yellow-700 text-sm mb-2">{smell.description}</p>
                                      {smell.suggestion && (
                                        <p className="text-yellow-600 text-sm italic flex items-start">
                                          <span className="mr-1">💡</span>
                                          <span>{smell.suggestion}</span>
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No detailed analysis results available. Try re-running the analysis.</p>
                        </div>
                      )}

                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-2">AI Review Summary</h4>
                        <p className="text-sm text-gray-700 mb-4">
                          Analysis complete for {review.repository}. 
                          {review.bugsFound > 0 
                            ? ` Found ${review.bugsFound} issues that should be addressed.`
                            : ' No critical issues found. Code looks good!'
                          }
                        </p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-red-600">{review.bugsFound}</div>
                            <div className="text-sm text-red-800">Issues Found</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">{review.suggestions}</div>
                            <div className="text-sm text-blue-800">Suggestions</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">8/10</div>
                            <div className="text-sm text-green-800">Code Quality</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
} 