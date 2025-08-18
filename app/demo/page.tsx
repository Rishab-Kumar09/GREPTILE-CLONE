'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Demo() {
  const [currentStep, setCurrentStep] = useState(0)
  const [demoMessages, setDemoMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: "Hello! I'm your AI code assistant. I have full context of your codebase. Ask me anything about your code, architecture, or specific functions."
    },
    {
      id: 2,
      type: 'user',
      content: "How does user authentication work in our API?"
    },
    {
      id: 3,
      type: 'ai',
      content: "Your API uses JWT-based authentication. The main files involved are: auth/views.py, auth/middleware.py, and models/user.py. The system validates credentials, generates tokens, and validates them on protected routes."
    }
  ])
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [demoInput, setDemoInput] = useState('')

  const demoAiResponses = [
    "Great question! In your codebase, I can see that user authentication is implemented using JWT tokens. The main authentication logic is in the AuthService class.",
    "Based on your code structure, the API endpoints are organized in the routes directory. Each endpoint has proper validation and error handling.",
    "I've analyzed your database schema and found that you're using proper indexing. However, consider adding a composite index on user_id and created_at for better performance.",
    "Your React components follow good practices with proper state management. The useAuth hook centralizes authentication logic nicely.",
    "I notice you have some unused imports in your utils folder. Cleaning these up would reduce your bundle size by approximately 15KB."
  ]

  const handleDemoSend = () => {
    if (!demoInput.trim() || isDemoLoading) return

    const userMessage = {
      id: demoMessages.length + 1,
      type: 'user',
      content: demoInput.trim()
    }

    setDemoMessages(prev => [...prev, userMessage])
    setDemoInput('')
    setIsDemoLoading(true)

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse = {
        id: demoMessages.length + 2,
        type: 'ai',
        content: demoAiResponses[Math.floor(Math.random() * demoAiResponses.length)]
      }
      setDemoMessages(prev => [...prev, aiResponse])
      setIsDemoLoading(false)
    }, 2000)
  }
  
  const demoSteps = [
    {
      title: "Connect Your Repository",
      description: "Connect your GitHub or GitLab repository to start analyzing your codebase.",
      mockup: (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Connect Repository</h3>
          <div className="space-y-4">
            <div className="flex items-center p-4 border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium">johndoe/my-awesome-project</p>
                <p className="text-sm text-gray-600">TypeScript • Last updated 2 hours ago</p>
              </div>
              <button className="btn-primary">Connect</button>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "AI Analyzes Your Codebase",
      description: "Our AI creates a detailed graph of your code and understands relationships between files.",
      mockup: (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Codebase Analysis</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm">Indexed 1,247 files</span>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm">Mapped 3,456 function relationships</span>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 animate-spin">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className="text-sm">Building dependency graph...</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Automated PR Reviews",
      description: "AI reviews every pull request with full context, catching bugs and suggesting improvements.",
      mockup: (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Pull Request Review</h3>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center mr-2">
                  <span className="text-white text-xs">🤖</span>
                </div>
                <span className="font-medium text-sm">Greptile AI</span>
                <span className="text-xs text-gray-500 ml-auto">2 minutes ago</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-2">
                <p className="text-sm text-red-800">
                  <strong>Potential Security Issue:</strong> This endpoint doesn't validate user permissions 
                  before accessing sensitive data. Consider adding authentication middleware.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>Suggestion:</strong> The getUserData function in auth/middleware.py 
                  can be reused here instead of duplicating the logic.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "AI Code Chat",
      description: "Ask questions about your codebase in natural language and get instant, contextual answers.",
      mockup: (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">AI Code Assistant</h3>
                      <div className="space-y-4 h-64 overflow-y-auto bg-gray-50 rounded-lg p-4">
              {demoMessages.map((message) => (
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
              {isDemoLoading && (
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
            
            <div className="flex space-x-2 mt-4">
              <input
                type="text"
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleDemoSend()
                  }
                }}
                placeholder="Try asking about your codebase..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                disabled={isDemoLoading}
              />
              <button 
                onClick={handleDemoSend}
                disabled={!demoInput.trim() || isDemoLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        )
      }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🦎</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Greptile Clone</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link href="/auth/signin" className="text-gray-600 hover:text-gray-900">
                Sign In
              </Link>
              <Link href="/auth/signup" className="btn-primary">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            See Greptile Clone in Action
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Experience how our AI-powered code review platform analyzes your codebase, 
            catches bugs, and accelerates your development workflow.
          </p>
        </div>

        {/* Demo Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Steps */}
          <div className="space-y-8">
            {demoSteps.map((step, index) => (
              <div 
                key={index}
                className={`flex items-start space-x-4 cursor-pointer transition-all ${
                  currentStep === index ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                }`}
                onClick={() => setCurrentStep(index)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  currentStep === index ? 'bg-primary-600' : 'bg-gray-400'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Side - Mockup */}
          <div className="lg:sticky lg:top-8">
            <div className="bg-gray-100 rounded-lg p-8 min-h-[400px] flex items-center justify-center">
              {demoSteps[currentStep].mockup}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mt-12 space-x-4">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(demoSteps.length - 1, currentStep + 1))}
            disabled={currentStep === demoSteps.length - 1}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16 bg-white rounded-lg p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to transform your code reviews?
          </h2>
          <p className="text-gray-600 mb-6">
            Join thousands of developers using AI to catch more bugs and ship faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="btn-primary">
              Sign Up
            </Link>
            <Link href="/dashboard" className="btn-outline">
              View Dashboard Demo
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
} 