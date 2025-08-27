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

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  citations?: Array<{
    file: string
    line?: number
    snippet?: string
  }>
}

export default function Reviews() {
  
  const [reviews, setReviews] = useState<Review[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [expandedReviews, setExpandedReviews] = useState<{[key: string]: boolean}>({})
  const [profilePic, setProfilePic] = useState<string | null>(null)
  
  // Chat functionality
  const [chatMessages, setChatMessages] = useState<{[reviewId: string]: ChatMessage[]}>({})
  const [chatInput, setChatInput] = useState<{[reviewId: string]: string}>({})
  const [chatLoading, setChatLoading] = useState<{[reviewId: string]: boolean}>({})

  // Load repositories and their analysis results
  const loadReviews = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot load reviews')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔍 REVIEWS: Loading repositories for user:', currentUser.id)
      
      const response = await fetch(`/api/repositories?userId=${currentUser.id}`)
      if (response.ok) {
        const repos: Repository[] = await response.json()
        console.log(`✅ REVIEWS: Loaded ${repos.length} repositories for user ${currentUser.id}`)
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
        
        // 🎯 Simple auto-expand from localStorage
        const expandRepo = localStorage.getItem('expandRepo')
        if (expandRepo) {
          console.log(`🎯 AUTO-EXPAND: Looking for repository ${expandRepo}`)
          
          // Find the review for this repository and expand it
          const targetReview = reviewsData.find(review => review.repository === expandRepo)
          if (targetReview) {
            console.log(`✅ AUTO-EXPAND: Found review ID ${targetReview.id} for ${expandRepo}`)
            setExpandedReviews(prev => ({
              ...prev,
              [targetReview.id]: true
            }))
          } else {
            console.log(`❌ AUTO-EXPAND: No review found for ${expandRepo}`)
          }
          localStorage.removeItem('expandRepo') // Clean up
        }
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

  // Chat functionality
  const sendChatMessage = async (reviewId: string, message: string) => {
    if (!message.trim()) return

    const review = reviews.find(r => r.id.toString() === reviewId)
    if (!review) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

    setChatMessages(prev => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] || []), userMessage]
    }))

    setChatInput(prev => ({
      ...prev,
      [reviewId]: ''
    }))

    setChatLoading(prev => ({
      ...prev,
      [reviewId]: true
    }))

    try {
      // Call AI chat API with repository context
      const response = await fetch('/api/chat/repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          repository: review.repository,
          analysisResults: {
            allResults: review.analysisResults || []
          },
          chatHistory: (chatMessages[reviewId] || []).slice(-25) // Last 25 messages for context
        }),
      })

      if (response.ok) {
        const aiResponse = await response.json()
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: aiResponse.response,
          timestamp: new Date(),
          citations: aiResponse.citations || []
        }

        setChatMessages(prev => ({
          ...prev,
          [reviewId]: [...(prev[reviewId] || []), aiMessage]
        }))
      } else {
        throw new Error('Failed to get AI response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }

      setChatMessages(prev => ({
        ...prev,
        [reviewId]: [...(prev[reviewId] || []), errorMessage]
      }))
    } finally {
      setChatLoading(prev => ({
        ...prev,
        [reviewId]: false
      }))
    }
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

                      {/* AI Chat Box */}
                      <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                          <h4 className="font-medium text-gray-900 flex items-center">
                            <span className="mr-2">🤖</span>
                            Ask AI about this repository
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Get answers with file citations and line references
                          </p>
                        </div>
                        
                        {/* Chat Messages */}
                        <div className="max-h-80 overflow-y-auto p-4 space-y-4">
                          {chatMessages[review.id.toString()]?.length > 0 ? (
                            chatMessages[review.id.toString()].map((msg) => (
                              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                  msg.type === 'user' 
                                    ? 'bg-primary-600 text-white' 
                                    : 'bg-gray-100 text-gray-900'
                                }`}>
                                  <p className="text-sm">{msg.content}</p>
                                  
                                  {/* Citations */}
                                  {msg.citations && msg.citations.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <p className="text-xs text-gray-600 mb-1">📎 Sources:</p>
                                      {msg.citations.map((citation, idx) => (
                                        <div key={idx} className="text-xs bg-gray-50 rounded p-2 mb-1">
                                          <div className="font-mono text-blue-600">
                                            {citation.file}
                                            {citation.line && `:${citation.line}`}
                                          </div>
                                          {citation.snippet && (
                                            <div className="mt-1 bg-gray-900 text-gray-100 p-1 rounded text-xs font-mono">
                                              {citation.snippet}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <p className="text-xs opacity-75 mt-1">
                                    {msg.timestamp.toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-sm">Start a conversation about this repository</p>
                              <p className="text-xs mt-1">Ask about specific files, functions, or code patterns</p>
                            </div>
                          )}
                          
                          {/* Loading indicator */}
                          {chatLoading[review.id.toString()] && (
                            <div className="flex justify-start">
                              <div className="bg-gray-100 rounded-lg px-4 py-2">
                                <div className="flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  <span className="text-sm text-gray-600">AI is thinking...</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Chat Input */}
                        <div className="p-4 border-t border-gray-200">
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={chatInput[review.id.toString()] || ''}
                              onChange={(e) => setChatInput(prev => ({
                                ...prev,
                                [review.id.toString()]: e.target.value
                              }))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !chatLoading[review.id.toString()]) {
                                  sendChatMessage(review.id.toString(), chatInput[review.id.toString()] || '')
                                }
                              }}
                              placeholder="Ask about this code... (e.g., 'How does authentication work?')"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                              disabled={chatLoading[review.id.toString()]}
                            />
                            <button
                              onClick={() => sendChatMessage(review.id.toString(), chatInput[review.id.toString()] || '')}
                              disabled={!chatInput[review.id.toString()]?.trim() || chatLoading[review.id.toString()]}
                              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                              Send
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
💡 Try: "Fix the bug at line 1" or "How to resolve the security issue?" or "Show me exact code replacement"
                          </p>
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