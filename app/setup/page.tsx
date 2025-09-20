'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardHeader from '../../components/DashboardHeader'

export default function Setup() {
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)

  // Check GitHub connection status on component mount
  useEffect(() => {
    const checkGithubConnection = async () => {
      try {
        // Get current user from localStorage
        const currentUserStr = localStorage.getItem('currentUser')
        if (!currentUserStr) {
          console.log('No current user found in setup')
          return
        }
        
        const currentUser = JSON.parse(currentUserStr)
        const response = await fetch(`/api/profile?userId=${currentUser.id}`)
        const data = await response.json()
        
        if (data.success && data.profile) {
          setGithubConnected(data.profile.githubConnected || false)
          setGithubUsername(data.profile.githubUsername || null)
          
          // If GitHub is connected, mark setup as complete
          if (data.profile.githubConnected) {
            setSetupComplete(true)
          }
        }
      } catch (error) {
        console.error('Failed to check GitHub connection:', error)
      } finally {
        setLoading(false)
      }
    }

    checkGithubConnection()
  }, [])

  // Refresh GitHub connection (same as repositories page)
  const refreshGithubConnection = async () => {
    if (!confirm('This will refresh your GitHub connection. You may need to re-authenticate. Continue?')) {
      return
    }

    try {
      setIsRefreshing(true)
      
      // 🔒 SECURITY FIX: Get session token instead of userId from localStorage
      const sessionToken = localStorage.getItem('sessionToken')
      if (!sessionToken) {
        alert('Please log in first - no valid session found')
        return
      }
      
      console.log('🔄 SETUP: Starting GitHub OAuth with session token')
      
      // Direct redirect to OAuth endpoint with session token
      console.log('🔄 SETUP: Redirecting to GitHub OAuth endpoint with secure session')
      window.location.href = `/api/github/oauth?session=${encodeURIComponent(sessionToken)}`
      
    } catch (error) {
      console.error('Error refreshing GitHub connection:', error)
      alert('Failed to refresh GitHub connection')
      setIsRefreshing(false)
    }
  }

  // Handle successful GitHub connection
  const handleGithubConnected = () => {
    setGithubConnected(true)
    setSetupComplete(true)
    console.log('🎉 SETUP: GitHub connected! Setup complete.')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="setup" />

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Setup Bot</h1>
          <p className="text-gray-600">Connect your GitHub account to get started</p>
        </div>

        {/* Main Setup Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {!setupComplete ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect GitHub</h2>
              <p className="text-gray-600 mb-6">Connect your GitHub account to enable AI code reviews on your repositories</p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">🔗 Why Connect GitHub?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Access your private and public repositories</li>
                  <li>• Automatically analyze code for bugs and security issues</li>
                  <li>• Get AI-powered code reviews and suggestions</li>
                  <li>• Track code quality across all your projects</li>
                </ul>
              </div>
              
              {loading ? (
                <div className="text-gray-500">Checking connection status...</div>
              ) : githubConnected ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-800 font-medium">
                        Connected as @{githubUsername}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={refreshGithubConnection}
                    disabled={isRefreshing}
                    className={`px-4 py-2 text-sm rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      githubConnected 
                        ? 'px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed'
                        : 'px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isRefreshing ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refreshing...
                      </span>
                    ) : (
                      githubConnected ? '🔄 Refresh GitHub' : '🔗 Connect GitHub'
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={refreshGithubConnection}
                  disabled={isRefreshing}
                  className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Connecting...
                    </span>
                  ) : (
                    '🔗 Connect GitHub'
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
              <p className="text-xl text-gray-600 mb-2">You're all set! GitHub is connected.</p>
              <p className="text-gray-500 mb-8">You can now manage repositories and analyze your code.</p>
              
              <Link 
                href="/dashboard"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 