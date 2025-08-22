'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardHeader from '../../components/DashboardHeader'

export default function Setup() {
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [prSummaryEnabled, setPrSummaryEnabled] = useState(true)
  const [reviewBehaviorSet, setReviewBehaviorSet] = useState(false)
  const [filtersConfigured, setFiltersConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [githubRepos, setGithubRepos] = useState<any[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  
  // Add missing state for interactive elements
  const [strictnessLevel, setStrictnessLevel] = useState(60)
  const [commentTypes, setCommentTypes] = useState({
    syntax: true,
    logic: true,
    style: true
  })
  const [filters, setFilters] = useState({
    labels: '',
    authors: '',
    branches: '',
    keywords: ''
  })

  // Check GitHub connection status on component mount
  useEffect(() => {
    const checkGithubConnection = async () => {
      try {
        const response = await fetch('/api/profile')
        const data = await response.json()
        
        if (data.success && data.profile) {
          setGithubConnected(data.profile.githubConnected || false)
          setGithubUsername(data.profile.githubUsername || null)
        }
      } catch (error) {
        console.error('Failed to check GitHub connection:', error)
      } finally {
        setLoading(false)
      }
    }

    checkGithubConnection()
  }, [])

  // Handle GitHub OAuth initiation
  const handleGithubConnect = async () => {
    try {
      const response = await fetch('/api/github/oauth')
      const data = await response.json()
      
      if (data.success && data.authUrl) {
        // Redirect to GitHub OAuth
        window.location.href = data.authUrl
      } else {
        alert('Failed to initiate GitHub connection')
      }
    } catch (error) {
      console.error('GitHub connection error:', error)
      alert('Failed to connect to GitHub')
    }
  }

  // Fetch GitHub repositories when user reaches step 2
  const fetchGithubRepos = async () => {
    if (!githubConnected || githubRepos.length > 0) return

    setLoadingRepos(true)
    try {
      const response = await fetch('/api/github/repositories')
      const data = await response.json()
      
      if (data.success && data.repositories) {
        setGithubRepos(data.repositories)
      } else {
        console.error('Failed to fetch GitHub repositories:', data.error)
      }
    } catch (error) {
      console.error('Error fetching GitHub repositories:', error)
    } finally {
      setLoadingRepos(false)
    }
  }

  // Fetch repos when reaching step 2 and GitHub is connected
  useEffect(() => {
    if (currentStep === 2 && githubConnected && githubRepos.length === 0) {
      console.log('🔄 SETUP: Fetching GitHub repositories for step 2...')
      fetchGithubRepos()
    }
  }, [currentStep, githubConnected, githubRepos.length])

  const steps = [
    { id: 1, title: 'Connect GitHub', completed: githubConnected },
    { id: 2, title: 'Select Repositories', completed: selectedRepos.length > 0 },
    { id: 3, title: 'Configure PR Summary', completed: prSummaryEnabled },
    { id: 4, title: 'Control Review Behavior', completed: reviewBehaviorSet },
    { id: 5, title: 'Add Filtering', completed: filtersConfigured }
  ]

  const handleStepComplete = (stepId: number) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId])
    }
    if (stepId < 5) {
      setCurrentStep(stepId + 1)
    } else if (stepId === 5) {
      // Move to completion screen (step 6)
      setCurrentStep(6)
      console.log('🎉 SETUP: All steps completed! Moving to success screen.')
    }
  }

  const isStepCompleted = (stepId: number) => {
    return steps.find(s => s.id === stepId)?.completed || false
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="setup" />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Code Review Bot</h1>
          <p className="text-gray-600">Set up your automated code review system in just a few steps</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    isStepCompleted(step.id) 
                      ? 'bg-green-600 text-white' 
                      : currentStep === step.id
                      ? 'bg-green-100 text-green-600 border-2 border-green-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isStepCompleted(step.id) ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${
                    currentStep === step.id ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    isStepCompleted(step.id) ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {currentStep === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect GitHub</h2>
              <p className="text-gray-600 mb-6">Connect your GitHub account to enable AI code reviews</p>
              
              {loading ? (
                <div className="text-gray-500">Checking connection status...</div>
              ) : githubConnected ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-800 font-medium">
                      Connected as @{githubUsername}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGithubConnect}
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  Connect GitHub Account
                </button>
              )}
              
              {githubConnected && (
                <button
                  onClick={() => handleStepComplete(1)}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors ml-4"
                >
                  Continue
                </button>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Repositories</h2>
              <p className="text-gray-600 mb-6">
                {githubConnected 
                  ? `Choose which repositories you want Greptile to review from your GitHub account (@${githubUsername})`
                  : 'Connect GitHub first to see your repositories'
                }
              </p>
              
              {!githubConnected ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </div>
                  <p className="text-gray-500 mb-4">Please go back and connect your GitHub account first</p>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Back to GitHub Connection
                  </button>
                </div>
              ) : loadingRepos ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading your repositories...</p>
                </div>
              ) : (
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                  {githubRepos.map((repo) => (
                    <label key={repo.fullName} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRepos([...selectedRepos, repo.fullName])
                          } else {
                            setSelectedRepos(selectedRepos.filter(r => r !== repo.fullName))
                          }
                        }}
                      />
                      <div className="ml-3 flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <div>
                            <span className="font-medium text-gray-900">{repo.fullName}</span>
                            {repo.description && (
                              <p className="text-sm text-gray-500 mt-1">{repo.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {repo.language && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {repo.language}
                            </span>
                          )}
                          {repo.isPrivate && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Private
                            </span>
                          )}
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {repo.stars}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <button
                onClick={() => handleStepComplete(2)}
                disabled={selectedRepos.length === 0}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  selectedRepos.length > 0
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue with {selectedRepos.length} repositories
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure PR Summary</h2>
              <p className="text-gray-600 mb-6">A PR summary is a Greptile generated summary of the changes in a PR, and adds it as a comment to the PR.</p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-gray-900">Generate PR Summary</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prSummaryEnabled}
                      onChange={(e) => setPrSummaryEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
                <p className="text-sm text-gray-600 text-left">Summary will be posted as comment</p>
              </div>

              <button
                onClick={() => handleStepComplete(3)}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">What should Greptile comment on?</h2>
              <p className="text-gray-600 mb-6">Set Greptile's sensitivity and choose comment types.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Strictness Level</label>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">LOW</span>
                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={strictnessLevel}
                        onChange={(e) => setStrictnessLevel(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          WebkitAppearance: 'none',
                          background: `linear-gradient(to right, #059669 0%, #059669 ${strictnessLevel}%, #e5e7eb ${strictnessLevel}%, #e5e7eb 100%)`
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">HIGH</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Balanced approach focusing on important issues.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Comment Types</label>
                  <div className="grid grid-cols-3 gap-4">
                    {['Syntax', 'Logic', 'Style'].map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={commentTypes[type.toLowerCase() as keyof typeof commentTypes]}
                          onChange={(e) => setCommentTypes({
                            ...commentTypes,
                            [type.toLowerCase()]: e.target.checked
                          })}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-900">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setReviewBehaviorSet(true)
                  handleStepComplete(4)
                }}
                className="mt-6 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {currentStep === 5 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Filters</h2>
              <p className="text-gray-600 mb-6">Filters help you control which pull requests get reviewed.</p>
              
              <div className="text-left space-y-4 mb-6">
                <div className="p-3 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-900 mb-2">Labels</label>
                  <input
                    type="text"
                    placeholder="e.g., bug, feature, hotfix"
                    value={filters.labels}
                    onChange={(e) => setFilters({...filters, labels: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="p-3 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-900 mb-2">Authors</label>
                  <input
                    type="text"
                    placeholder="e.g., @username1, @username2"
                    value={filters.authors}
                    onChange={(e) => setFilters({...filters, authors: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="p-3 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-900 mb-2">Branches</label>
                  <input
                    type="text"
                    placeholder="e.g., main, develop, feature/*"
                    value={filters.branches}
                    onChange={(e) => setFilters({...filters, branches: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="p-3 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-900 mb-2">Keywords</label>
                  <input
                    type="text"
                    placeholder="e.g., TODO, FIXME, urgent"
                    value={filters.keywords}
                    onChange={(e) => setFilters({...filters, keywords: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setFiltersConfigured(true)
                    handleStepComplete(5)
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => {
                    setFiltersConfigured(true)
                    handleStepComplete(5)
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {currentStep > 5 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
              <p className="text-xl text-gray-600 mb-2">You're all set! Greptile will now review new PRs!</p>
              <p className="text-gray-500 mb-8">Next step: Add custom context to help Greptile with your team's preferences.</p>
              
              <div className="space-y-3">
                <button className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors">
                  Add Custom Context
                </button>
                <Link 
                  href="/dashboard"
                  className="block w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {currentStep > 1 && currentStep <= 5 && (
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Back
            </button>
            <div className="text-sm text-gray-500">
              Step {currentStep} of 5
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 