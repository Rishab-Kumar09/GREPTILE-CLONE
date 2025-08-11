'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Reviews() {
  const [reviews] = useState([
    {
      id: 1,
      prTitle: 'Add user authentication system',
      repository: 'johndoe/my-awesome-project',
      author: 'johndoe',
      createdAt: '2 hours ago',
      status: 'reviewed',
      aiComments: 3,
      bugsFound: 2,
      suggestions: 5,
      severity: 'medium',
      prNumber: 42
    },
    {
      id: 2,
      prTitle: 'Fix memory leak in data processing',
      repository: 'johndoe/api-service',
      author: 'janedoe',
      createdAt: '5 hours ago',
      status: 'in_progress',
      aiComments: 1,
      bugsFound: 1,
      suggestions: 2,
      severity: 'high',
      prNumber: 38
    },
    {
      id: 3,
      prTitle: 'Update dependencies and improve performance',
      repository: 'company/frontend-app',
      author: 'developer123',
      createdAt: '1 day ago',
      status: 'reviewed',
      aiComments: 7,
      bugsFound: 0,
      suggestions: 8,
      severity: 'low',
      prNumber: 156
    },
    {
      id: 4,
      prTitle: 'Implement new payment gateway',
      repository: 'johndoe/api-service',
      author: 'johndoe',
      createdAt: '2 days ago',
      status: 'reviewed',
      aiComments: 4,
      bugsFound: 3,
      suggestions: 6,
      severity: 'high',
      prNumber: 35
    }
  ])

  const [selectedReview, setSelectedReview] = useState<typeof reviews[0] | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🦎</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Greptile Clone</span>
              </Link>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/dashboard/repositories" className="text-gray-600 hover:text-gray-900">
                Repositories
              </Link>
              <Link href="/dashboard/reviews" className="text-primary-600 font-medium">
                Reviews
              </Link>
              <Link href="/dashboard/settings" className="text-gray-600 hover:text-gray-900">
                Settings
              </Link>
            </nav>

            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pull Request Reviews</h1>
          <p className="text-gray-600">AI-powered code reviews for your repositories</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{reviews.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Bugs Found</p>
                <p className="text-2xl font-bold text-gray-900">{reviews.reduce((sum, review) => sum + review.bugsFound, 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Suggestions</p>
                <p className="text-2xl font-bold text-gray-900">{reviews.reduce((sum, review) => sum + review.suggestions, 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Review Time</p>
                <p className="text-2xl font-bold text-gray-900">3.2m</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Reviews</h2>
              <div className="flex items-center space-x-2">
                <select className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                  <option>All Repositories</option>
                  <option>johndoe/my-awesome-project</option>
                  <option>johndoe/api-service</option>
                  <option>company/frontend-app</option>
                </select>
                <select className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                  <option>All Status</option>
                  <option>Reviewed</option>
                  <option>In Progress</option>
                </select>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {reviews.map((review) => (
              <div 
                key={review.id} 
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedReview(review)}
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
                      <span className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-1 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {review.aiComments} AI comments
                      </span>
                      <span className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-1 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        {review.bugsFound} bugs
                      </span>
                      <span className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {review.suggestions} suggestions
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      review.status === 'reviewed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {review.status.replace('_', ' ')}
                    </span>
                    <button className="p-2 text-gray-600 hover:text-gray-900">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Review Detail Modal */}
        {selectedReview && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedReview.prTitle}
                </h3>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center mr-2">
                      <span className="text-white text-xs">🤖</span>
                    </div>
                    <span className="font-medium text-sm">Greptile AI</span>
                    <span className="text-xs text-gray-500 ml-auto">2 minutes ago</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                    <p className="text-sm text-red-800">
                      <strong>Security Issue:</strong> The API endpoint at line 45 doesn't validate user permissions 
                      before accessing sensitive data. This could lead to unauthorized data access.
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                    <p className="text-sm text-blue-800">
                      <strong>Performance Suggestion:</strong> Consider using pagination for the user list endpoint 
                      to improve response times when dealing with large datasets.
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Code Quality:</strong> The function `processUserData` could be refactored to use 
                      the existing helper function in `utils/dataProcessor.js` to reduce code duplication.
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">AI Review Summary</h4>
                  <p className="text-sm text-gray-700 mb-4">
                    This pull request introduces user authentication functionality. The implementation looks solid overall, 
                    but there are a few security and performance considerations that should be addressed before merging.
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-red-600">{selectedReview.bugsFound}</p>
                      <p className="text-sm text-gray-600">Issues Found</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{selectedReview.suggestions}</p>
                      <p className="text-sm text-gray-600">Suggestions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">8/10</p>
                      <p className="text-sm text-gray-600">Code Quality</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
} 