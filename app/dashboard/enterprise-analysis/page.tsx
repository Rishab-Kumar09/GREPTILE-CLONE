'use client'

import { useState } from 'react'

interface AnalysisResult {
  type: string
  name: string
  file: string
  line: number
  code: string
  description: string
}

export default function EnterpriseAnalysisPage() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/facebook/react')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [message, setMessage] = useState('')

  const startAnalysis = async () => {
    if (!repoUrl.includes('github.com')) {
      setMessage('❌ Please enter a valid GitHub URL')
      return
    }

    setIsAnalyzing(true)
    setResults([])
    setMessage('🚀 Starting analysis...')

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
        setResults(data.results || [])
        setMessage(data.message || '✅ Analysis completed!')
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('❌ Request failed:', error)
      setMessage(`❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <span className="text-2xl">🚀</span>
            Enterprise Code Analysis
          </h1>
          <p className="text-gray-300 text-lg">
            Fast, parallel code analysis for any GitHub repository
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-8 border border-white/20">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-white font-medium mb-2">
                GitHub Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAnalyzing}
              />
            </div>
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
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

        {/* Status Message */}
        {message && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-8 border border-white/20">
            <p className="text-white font-medium">{message}</p>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span>📊</span>
              Analysis Results ({results.length} found)
            </h2>
            
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium">
                        {result.type}
                      </span>
                      <h3 className="text-white font-semibold">{result.name}</h3>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {result.file}:{result.line}
                    </span>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-3">{result.description}</p>
                  
                  <div className="bg-black/30 rounded p-3 border border-white/10">
                    <code className="text-green-400 text-sm font-mono">
                      {result.code}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}