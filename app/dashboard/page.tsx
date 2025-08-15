'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Repository {
  id?: string | number
  name: string
  fullName: string
  language?: string
  lastReview?: string
  status?: string
  reviews?: number
  bugs: number
  stars: number
  forks: number
  description?: string
  url: string
  analyzing?: boolean
  createdAt?: string
  updatedAt?: string
}

export default function Dashboard() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)

  // Load repositories from database
  const loadRepositories = async () => {
    try {
      const response = await fetch('/api/repositories')
      if (response.ok) {
        const repos = await response.json()
        setRepositories(repos)
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
    }
  }

  // Load repositories on component mount
  useEffect(() => {
    loadRepositories()
  }, [])

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: "Hello! I'm your AI code assistant. I have full context of your codebase. Ask me anything about your code, architecture, or specific functions.",
      timestamp: new Date()
    }
  ])

  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)


  const getAiResponse = () => {
    const responses = [
      repositories.length > 0 
        ? `I've analyzed your ${repositories.length} connected repositories. I can help you with code questions, architecture decisions, or specific functions from: ${repositories.map(r => r.name).join(', ')}.`
        : "I'm ready to help you with code analysis! Connect some repositories and I'll have full context of your codebase to answer questions about your code, architecture, or specific functions.",
      "I can help you understand your codebase structure, find potential issues, suggest improvements, or explain complex code patterns.",
      "Ask me about your code architecture, security vulnerabilities, performance optimizations, or any specific functions you're working on.",
      "I have the ability to analyze your entire codebase and provide contextual answers about your code, dependencies, and best practices.",
      "Feel free to ask about code reviews, refactoring suggestions, debugging help, or explanations of how different parts of your code work together.",
      "I can help identify code smells, suggest architectural improvements, explain complex algorithms, or help you understand legacy code in your repositories."
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Call repository-specific AI API if a repo is selected, otherwise general AI
      const apiEndpoint = selectedRepo ? '/api/github/chat' : '/api/ai/chat'
      const requestBody = selectedRepo 
        ? {
            repoFullName: selectedRepo.fullName,
            question: inputMessage.trim()
          }
        : {
            message: inputMessage.trim(),
            context: { repositories: repositories }
          }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown API error' }))
        throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`)
      }

      const data = await response.json()
      
      const aiResponse = {
        id: messages.length + 2,
        type: 'ai',
        content: selectedRepo ? (data.answer || 'Sorry, I encountered an error processing your request.') : (data.response || 'Sorry, I encountered an error processing your request.'),
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, aiResponse])
    } catch (error) {
      console.error('Error calling AI API:', error)
      const errorResponse = {
        id: messages.length + 2,
        type: 'ai',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. ${selectedRepo ? 'Repository-specific chat failed.' : 'General AI failed.'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorResponse])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🦎</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">Greptile Clone</span>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-primary-600 font-medium">
                Dashboard
              </Link>
              <Link href="/dashboard/repositories" className="text-gray-600 hover:text-gray-900">
                Repositories
              </Link>
              <Link href="/dashboard/reviews" className="text-gray-600 hover:text-gray-900">
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, John!</h1>
          <p className="text-gray-600">Here's what's happening with your code reviews today.</p>
        </div>

        {/* Stats Cards */}
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
                <p className="text-2xl font-bold text-gray-900">
                  {repositories.filter(repo => repo.bugs > 0).length}
                </p>
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
                <p className="text-sm font-medium text-gray-600">Issues Found</p>
                <p className="text-2xl font-bold text-gray-900">
                  {repositories.reduce((total, repo) => total + (repo.bugs || 0), 0)}
                </p>
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
                <p className="text-sm font-medium text-gray-600">Time Saved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {repositories.reduce((total, repo) => total + (repo.bugs || 0), 0) * 5}m
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Repos</p>
                <p className="text-2xl font-bold text-gray-900">{repositories.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Repositories */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Your Repositories</h2>
                <Link href="/dashboard/repositories" className="text-primary-600 hover:text-primary-500 text-sm font-medium">
                  View all
                </Link>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {repositories.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <p className="text-gray-500 mb-4">No repositories connected yet</p>
                    <Link href="/dashboard/repositories" className="btn-primary text-sm">
                      Connect Repository
                    </Link>
                  </div>
                ) : (
                  repositories.map((repo) => (
                  <div 
                    key={repo.id} 
                    onClick={() => setSelectedRepo(repo)}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRepo?.fullName === repo.fullName
                        ? 'border-primary-500 bg-primary-50 shadow-md'
                        : 'border-gray-200 hover:bg-gray-50 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{repo.name}</p>
                        <p className="text-sm text-gray-500">{repo.fullName} • {repo.language}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          repo.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {repo.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Last: {repo.lastReview}</p>
                    </div>
                  </div>
                )))}
              </div>
            </div>
          </div>

          {/* AI Chat Interface */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    Ask AI about your code
                    {selectedRepo && (
                      <span className="ml-3 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                        🎯 {selectedRepo.name} Expert
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRepo 
                      ? `I have full context of ${selectedRepo.name} (${selectedRepo.fullName}). Ask me anything about its code, architecture, or the ${selectedRepo.bugs} issues found!`
                      : "Query your codebase in natural language"
                    }
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedRepo && (
                    <button
                      onClick={() => setSelectedRepo(null)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors"
                    >
                      🔄 General AI
                    </button>
                  )}
                  <div className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
                    ✅ OpenAI Connected
                  </div>
                </div>
              </div>

            </div>
            <div className="p-6">
              <div className="space-y-4 mb-4 h-64 overflow-y-auto bg-gray-50 rounded-lg p-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex items-start space-x-2 ${message.type === 'user' ? 'justify-end' : ''}`}>
                    {message.type === 'ai' && (
                      <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs">🤖</span>
                      </div>
                    )}
                    <div className={`rounded-lg p-3 max-w-xs ${
                      message.type === 'user' 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-white shadow-sm'
                    }`}>
                      <p className={`text-sm ${message.type === 'user' ? 'text-white' : 'text-gray-900'}`}>
                        {message.content}
                      </p>
                    </div>
                    {message.type === 'user' && (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-start space-x-2">
                    <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">🤖</span>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your codebase..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                  disabled={isLoading}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>


      </main>
    </div>
  )
} 