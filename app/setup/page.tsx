'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'

export default function Setup() {
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [githubConnected, setGithubConnected] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [prSummaryEnabled, setPrSummaryEnabled] = useState(true)
  const [reviewBehaviorSet, setReviewBehaviorSet] = useState(false)
  const [filtersConfigured, setFiltersConfigured] = useState(false)

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
              <button
                onClick={() => {
                  setGithubConnected(true)
                  handleStepComplete(1)
                }}
                className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Connect GitHub Account
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Repositories</h2>
              <p className="text-gray-600 mb-6">Choose which repositories you want Greptile to review</p>
              
              <div className="space-y-3 mb-6">
                {['OWASP/NodeGoat', 'facebook/react', 'microsoft/vscode', 'your-org/private-repo'].map((repo) => (
                  <label key={repo} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRepos([...selectedRepos, repo])
                        } else {
                          setSelectedRepos(selectedRepos.filter(r => r !== repo))
                        }
                      }}
                    />
                    <div className="ml-3 flex items-center">
                      <svg className="w-5 h-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span className="font-medium text-gray-900">{repo}</span>
                      {repo.includes('private') && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Private
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

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
                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-green-600 rounded-full" style={{width: '60%'}}></div>
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
                          defaultChecked
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
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">Labels</span>
                  <span className="text-sm text-gray-500">None</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">Authors</span>
                  <span className="text-sm text-gray-500">None</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">Branches</span>
                  <span className="text-sm text-gray-500">None</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">Keywords</span>
                  <span className="text-sm text-gray-500">None</span>
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