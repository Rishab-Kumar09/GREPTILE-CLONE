'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CustomContext() {
  const [activeTab, setActiveTab] = useState('rules')
  const [customRules, setCustomRules] = useState('')

  const tabs = [
    { id: 'rules', name: 'Rules Setup', icon: '⚙️' },
    { id: 'documentation', name: 'Documentation Setup', icon: '📚' },
    { id: 'additional', name: 'Additional Context', icon: '➕' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Greptile Clone</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">GitHub</span>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                ⚙️
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Rules Setup</span>
            </div>
            <div className="w-16 h-0.5 bg-blue-200"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                📚
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Documentation Setup</span>
            </div>
            <div className="w-16 h-0.5 bg-blue-200"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                ➕
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Additional Context</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Let's set up your Custom Context!</h1>
          <p className="text-gray-600">Configuring custom context helps Greptile deliver smarter, more relevant reviews.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'rules' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom Rules</h2>
                <p className="text-gray-600 mb-6">
                  Add specific coding standards, patterns, or rules that Greptile should enforce in your codebase.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Coding Standards & Rules
                    </label>
                    <textarea
                      value={customRules}
                      onChange={(e) => setCustomRules(e.target.value)}
                      placeholder="Example:
- Always use TypeScript strict mode
- Prefer functional components over class components
- Use async/await instead of .then() for promises
- All API endpoints must include error handling
- Database queries should use prepared statements"
                      className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Pro Tip</h4>
                        <p className="text-sm text-blue-700 mt-1">
                          Be specific about your team's preferences. The more context you provide, the better Greptile can tailor its reviews.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'documentation' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Documentation Setup</h2>
                <p className="text-gray-600 mb-6">
                  Link to your project's documentation, style guides, or architectural decisions to help Greptile understand your codebase better.
                </p>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Documentation URLs
                    </label>
                    <div className="space-y-3">
                      <input
                        type="url"
                        placeholder="https://docs.yourproject.com/style-guide"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <input
                        type="url"
                        placeholder="https://github.com/yourorg/repo/wiki/Architecture"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <button className="text-green-600 text-sm font-medium hover:text-green-700">
                        + Add another URL
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      README or Wiki Content
                    </label>
                    <textarea
                      placeholder="Paste relevant sections from your README, contributing guidelines, or architectural documentation..."
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'additional' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Context</h2>
                <p className="text-gray-600 mb-6">
                  Provide any other context that would help Greptile understand your project, team preferences, or specific requirements.
                </p>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Type & Technology Stack
                    </label>
                    <textarea
                      placeholder="Example:
- React/Next.js web application
- Node.js backend with Express
- PostgreSQL database
- Deployed on AWS
- Uses TypeScript throughout"
                      className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Team Preferences & Special Considerations
                    </label>
                    <textarea
                      placeholder="Example:
- We prioritize performance over readability in critical paths
- Security is paramount - flag any potential vulnerabilities
- We're migrating from JavaScript to TypeScript gradually
- Focus on accessibility compliance (WCAG 2.1 AA)"
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-yellow-900">Remember</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          You can always update this context later as your project evolves or team preferences change.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 px-8 py-4">
            <div className="flex justify-between">
              <Link 
                href="/setup"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Setup
              </Link>
              
              <div className="flex space-x-3">
                <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                  Save Draft
                </button>
                <Link 
                  href="/dashboard"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Complete Setup
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Context Examples */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Example Context Entry</h3>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  📄 FILE
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">Style guide for our web-app front end</h4>
                <p className="text-sm text-gray-500 mt-1">2 days ago</p>
                <p className="text-sm text-gray-600 mt-2">1 hr. ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 