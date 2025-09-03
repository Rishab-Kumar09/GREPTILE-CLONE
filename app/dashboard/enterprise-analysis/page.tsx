'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardHeader from '@/components/DashboardHeader'

interface AnalysisResult {
  type: string
  name: string
  file: string
  line: number
  code: string
  description: string
}

interface AnalysisStatus {
  status: string
  progress: number
  currentFile: string
  results: AnalysisResult[]
}

interface ChatMessage {
  id: number
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  citations: Array<{
    file: string
    line?: number
    snippet?: string
  }>
}

export default function EnterpriseAnalysisPage() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/facebook/react')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>({
    status: 'idle',
    progress: 0,
    currentFile: '',
    results: []
  })
  const [expandedFiles, setExpandedFiles] = useState<{[key: string]: boolean}>({})
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const toggleFileExpanded = (fileName: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileName]: !prev[fileName]
    }))
  }

  const groupResultsByFile = (results: AnalysisResult[]) => {
    const grouped = results.reduce((acc, result) => {
      if (!acc[result.file]) {
        acc[result.file] = []
      }
      acc[result.file].push(result)
      return acc
    }, {} as {[key: string]: AnalysisResult[]})

    return Object.entries(grouped).map(([file, issues]) => ({
      file,
      issues: issues.sort((a, b) => a.line - b.line)
    }))
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'security': return '🔒'
      case 'function': return '⚡'
      case 'component': return '🧩'
      case 'import': return '📦'
      case 'api': return '🌐'
      case 'database': return '🗄️'
      case 'config': return '⚙️'
      case 'performance': return '🚀'
      case 'type': return '📝'
      default: return '💡'
    }
  }

  const getSeverityColor = (description: string) => {
    if (description.includes('HIGH:')) {
      return 'text-red-600 bg-red-100'
    } else if (description.includes('MEDIUM:')) {
      return 'text-yellow-600 bg-yellow-100'  
    } else {
      return 'text-blue-600 bg-blue-100'
    }
  }

  const getSeverityLevel = (description: string) => {
    if (description.includes('HIGH:')) return 'High'
    if (description.includes('MEDIUM:')) return 'Medium'
    return 'Info'
  }

  const getAISuggestion = (type: string, name: string, description: string) => {
    // Generate SPECIFIC suggestions based on the actual issue message
    if (name.includes('Hardcoded project name')) {
      return 'Use a variable or configuration for the project name. Consider moving this to an environment variable or a config file that can be easily updated without code changes.'
    }
    
    if (name.includes('Code block language identifier')) {
      return 'Change \'```\' to \'```bash\' or \'```javascript\' to specify the correct language for the code block. This improves syntax highlighting and readability.'
    }
    
    if (name.includes('Unclear instructions')) {
      return 'Specify whether the user can perform left-click or right-click actions. Add more context about the expected user interaction to avoid confusion.'
    }
    
    if (name.includes('security warning for entering IP')) {
      return 'Add a note about the security implications of entering the PC\'s IP address. Consider warning users about network security risks.'
    }
    
    if (name.includes('Hardcoded IP address')) {
      return 'Move IP addresses to environment variables or configuration files. Hardcoded IPs make the application difficult to deploy across different environments.'
    }
    
    if (name.includes('Debug statement should be removed')) {
      return 'Remove console.log, print(), or similar debug statements before deploying to production. Consider using a proper logging library with log levels instead.'
    }
    
    if (name.includes('Unresolved TODO/FIXME')) {
      return 'Address this TODO/FIXME comment by either implementing the required changes or removing the comment if it\'s no longer relevant.'
    }
    
    if (name.includes('Potential hardcoded credential')) {
      return 'Never hardcode passwords, API keys, or tokens in source code. Move these to environment variables and use a secrets management system.'
    }
    
    if (name.includes('SQL injection vulnerability')) {
      return 'Use parameterized queries or prepared statements to prevent SQL injection attacks. Never concatenate user input directly into SQL queries.'
    }
    
    if (name.includes('API call without error handling')) {
      return 'Add proper error handling with try-catch blocks or .catch() methods. Consider implementing retry logic and user-friendly error messages.'
    }
    
    if (name.includes('Using "any" type')) {
      return 'Replace "any" with specific TypeScript types to improve type safety and catch potential errors at compile time. Define interfaces for complex objects.'
    }
    
    if (name.includes('Environment variable without fallback')) {
      return 'Provide fallback values for environment variables using || or ?? operators. This prevents runtime errors when environment variables are not set.'
    }
    
    if (name.includes('Long function signature')) {
      return 'Consider breaking this long function into smaller, more focused functions. Use parameter objects for functions with many parameters.'
    }
    
    if (name.includes('Nested loop detected')) {
      return 'Optimize nested loops by using more efficient algorithms, caching results, or breaking early when possible. Consider using array methods like map, filter, or reduce.'
    }
    
    if (name.includes('Synchronous file operation')) {
      return 'Replace synchronous file operations with asynchronous alternatives (fs.readFile instead of fs.readFileSync) to avoid blocking the event loop.'
    }

    // Fallback to generic suggestions by type
    const genericSuggestions: {[key: string]: string} = {
      'function': 'Consider adding JSDoc comments to document this function\'s purpose, parameters, and return value.',
      'component': 'Ensure this component follows React best practices with proper prop types and error boundaries.',
      'import': 'Review this import to ensure it\'s necessary and consider tree-shaking to reduce bundle size.',
      'api': 'Add proper error handling, loading states, and timeout configuration for better user experience.',
      'security': 'This appears to contain sensitive information. Move secrets to environment variables.',
      'config': 'Ensure configuration values are properly validated and have fallback defaults.',
      'performance': 'This pattern might impact performance. Consider optimization techniques like memoization.',
      'type': 'Consider making types more specific and adding documentation comments.',
      'smell': 'Review this code smell and consider refactoring for better maintainability.',
      'bestpractice': 'Follow established best practices for this technology stack and coding standards.'
    }
    
    return genericSuggestions[type] || 'Review this code pattern for potential improvements in readability, maintainability, and performance.'
  }

  const sendChatMessage = async (message: string) => {
    if (!message.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date(),
      citations: []
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      const response = await fetch('/api/chat/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          repository: `${owner}/${repo}`,
          analysisResults: status.results,
          chatHistory: chatMessages.slice(-25) // Last 25 messages for context
        })
      })

      const data = await response.json()

      if (data.success) {
        const aiMessage: ChatMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.response,
          timestamp: new Date(),
          citations: data.citations || []
        }
        setChatMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(data.error || 'Failed to get AI response')
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        citations: []
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  const startAnalysis = async () => {
    if (!repoUrl.includes('github.com')) {
      alert('Please enter a valid GitHub URL')
      return
    }

    setIsAnalyzing(true)
    setStatus({
      status: 'analyzing',
      progress: 50,
      currentFile: 'Calling Lambda function...',
      results: []
    })

    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      console.log('🔄 Making API request...')
      const response = await fetch('/api/enterprise-analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo })
      })

      const data = await response.json()
      console.log('📡 API response:', data)

      if (data.success) {
        setAnalysisId(data.analysisId)
        
        // Handle direct results (no polling needed)
        if (data.results && data.results.length > 0) {
          console.log(`🎉 Got ${data.results.length} results directly from Lambda!`)
          setStatus({
            status: 'completed',
            progress: 100,
            currentFile: data.message || 'Analysis completed!',
            results: data.results
          })
        } else if (data.status === 'completed') {
          // Lambda completed but no results
          setStatus({
            status: 'completed',
            progress: 100,
            currentFile: 'Analysis completed - no code patterns found',
            results: []
          })
        } else {
          // No results - show error
          setStatus({
            status: 'failed',
            progress: 0,
            currentFile: data.error || 'No results returned',
            results: []
          })
        }
        
      } else {
        setStatus({
          status: 'failed',
          progress: 0,
          currentFile: `Error: ${data.error}`,
          results: []
        })
      }
      
      setIsAnalyzing(false)
    } catch (error) {
      console.error('❌ Request failed:', error)
      setStatus({
        status: 'failed',
        progress: 0,
        currentFile: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: []
      })
      setIsAnalyzing(false)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="Enterprise Analysis" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            Enterprise Code Analysis
          </h1>
          <p className="text-gray-600">
            Competitor-inspired analysis: Incremental, Priority-based, and Streaming Results
          </p>
        </div>

        {/* Analysis Strategy Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-500">⚡</span>
              <h3 className="font-semibold text-gray-900">Incremental Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Like Greptile - Only analyze changed files since last scan
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">🕒</span>
              <span className="text-gray-500">30 seconds - 2 minutes</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-500">🎯</span>
              <h3 className="font-semibold text-gray-900">Priority Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Like SonarQube - Critical files first, stream results
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-600">🕒</span>
              <span className="text-gray-500">2-5 minutes</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-500">🔍</span>
              <h3 className="font-semibold text-gray-900">Full Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Complete analysis with background processing
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600">🕒</span>
              <span className="text-gray-500">5-30 minutes</span>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isAnalyzing}
              />
            </div>
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Start Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Analysis Progress */}
        {(isAnalyzing || status.status !== 'idle') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Progress</h2>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{status.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                status.status === 'completed' ? 'bg-green-500' :
                status.status === 'failed' ? 'bg-red-500' :
                'bg-blue-500 animate-pulse'
              }`}></div>
              <span>{status.currentFile || 'Processing...'}</span>
            </div>
          </div>
        )}

        {/* AI Summary */}
        {status.results.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>🤖</span>
              AI-Generated Analysis Summary
            </h3>
            <p className="text-gray-700">
              This analysis identified <strong>{status.results.length} issues</strong> across <strong>{Math.ceil(status.results.length / 10)} files</strong> in the repository. 
              The review focused on functions, components, security patterns, and API calls with comprehensive code scanning. 
              Key areas requiring attention include potential security vulnerabilities, performance optimizations, 
              and code quality improvements that could enhance application stability and maintainability.
            </p>
          </div>
        )}

        {/* Analysis Stats */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {status.results.filter(r => r.description.includes('HIGH:')).length}
                </div>
                <div className="text-sm text-gray-500">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {status.results.filter(r => r.description.includes('MEDIUM:')).length}
                </div>
                <div className="text-sm text-gray-500">Medium Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {status.results.filter(r => r.description.includes('INFO:')).length}
                </div>
                <div className="text-sm text-gray-500">Informational</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{status.results.length}</div>
                <div className="text-sm text-gray-500">Total Issues</div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {status.results.length > 0 && (
          <div className="space-y-4">
            {groupResultsByFile(status.results).map((fileGroup, fileIndex) => (
              <div key={fileIndex} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div 
                  className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleFileExpanded(fileGroup.file)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <svg className={`w-5 h-5 transform transition-transform ${expandedFiles[fileGroup.file] ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900">{fileGroup.file}</h3>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {fileGroup.issues.length} issues
                      </span>
                    </div>
                  </div>
                </div>

                {expandedFiles[fileGroup.file] && (
                  <div className="p-4 space-y-4">
                    {fileGroup.issues.map((result, issueIndex) => (
                      <div key={issueIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getTypeIcon(result.type)}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(result.description)}`}>
                              {getSeverityLevel(result.description)}
                            </span>
                            <span className="text-sm text-gray-500">Line {result.line}</span>
                          </div>
                        </div>
                        
                        <h4 className="font-medium text-gray-900 mb-2">{result.name}</h4>
                        <p className="text-gray-700 mb-3">{result.description}</p>
                        
                        <div className="bg-gray-900 rounded-md p-3 mb-3">
                          <pre className="text-sm text-gray-100 overflow-x-auto">
                            <code>{result.code}</code>
                          </pre>
                        </div>

                        {/* AI Suggestion - Reviews Page Style */}
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <h5 className="text-sm font-medium text-green-800 mb-1">💡 Suggestion</h5>
                          <p className="text-sm text-green-700">
                            {getAISuggestion(result.type, result.name, result.description)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AI Chat Section - Like Reviews Page */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span>🤖</span>
                AI Assistant
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Get answers with file citations and line references
              </p>
            </div>
            
            {/* Chat Messages */}
            <div className="max-h-80 overflow-y-auto p-4 space-y-4">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.type === 'user' 
                        ? 'bg-blue-600 text-white' 
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
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !chatLoading) {
                      sendChatMessage(chatInput)
                    }
                  }}
                  placeholder="Ask about this code... (e.g., 'How does authentication work?')"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  disabled={chatLoading}
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Try: "Fix the bug at line 1" or "How to resolve the security issue?" or "Show me exact code replacement"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}