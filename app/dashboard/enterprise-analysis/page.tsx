'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AnalysisResult {
  file: string
  issues: Array<{
    type: 'bug' | 'security' | 'smell'
    severity: 'critical' | 'high' | 'medium' | 'low'
    line: number
    message: string
    code: string
  }>
  timestamp: number
}

interface StreamingUpdate {
  type: 'progress' | 'result' | 'complete' | 'error'
  data: any
}

export default function EnterpriseAnalysis() {
  // State management
  const [repoUrl, setRepoUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMode, setAnalysisMode] = useState<'incremental' | 'priority' | 'full'>('incremental')
  
  // Progress tracking
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState('')
  const [filesAnalyzed, setFilesAnalyzed] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState('')
  
  // Results streaming
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [criticalIssues, setCriticalIssues] = useState(0)
  const [totalIssues, setTotalIssues] = useState(0)
  const [analysisStrategy, setAnalysisStrategy] = useState('')
  
  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

  // Competitor-inspired analysis strategies
  const analysisStrategies = {
    incremental: {
      name: '🚀 Incremental Analysis',
      description: 'Like Greptile - Only analyze changed files since last scan',
      icon: '⚡',
      estimatedTime: '30 seconds - 2 minutes',
      color: 'bg-green-100 text-green-800'
    },
    priority: {
      name: '🎯 Priority Analysis', 
      description: 'Like SonarQube - Critical files first, stream results',
      icon: '🔥',
      estimatedTime: '2-5 minutes',
      color: 'bg-orange-100 text-orange-800'
    },
    full: {
      name: '🏭 Full Analysis',
      description: 'Complete analysis with background processing',
      icon: '🌊',
      estimatedTime: '5-30 minutes',
      color: 'bg-blue-100 text-blue-800'
    }
  }

  // Initialize WebSocket connection
  const connectWebSocket = (analysisId: string) => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    setConnectionStatus('connecting')
    wsRef.current = new WebSocket(`ws://localhost:3001/ws/analysis/${analysisId}`)
    
    wsRef.current.onopen = () => {
      setConnectionStatus('connected')
      console.log('🔌 WebSocket connected for real-time updates')
    }
    
    wsRef.current.onmessage = (event) => {
      const update: StreamingUpdate = JSON.parse(event.data)
      handleStreamingUpdate(update)
    }
    
    wsRef.current.onclose = () => {
      setConnectionStatus('disconnected')
      console.log('🔌 WebSocket disconnected')
    }
    
    wsRef.current.onerror = (error) => {
      console.error('🚨 WebSocket error:', error)
      setConnectionStatus('disconnected')
    }
  }

  // Handle real-time streaming updates
  const handleStreamingUpdate = (update: StreamingUpdate) => {
    switch (update.type) {
      case 'progress':
        setProgress(update.data.percentage)
        setCurrentFile(update.data.currentFile)
        setFilesAnalyzed(update.data.filesAnalyzed)
        setTotalFiles(update.data.totalFiles)
        setEstimatedTime(update.data.estimatedTime)
        break
        
      case 'result':
        // Stream results as they come in
        const newResult: AnalysisResult = update.data
        setResults(prev => [...prev, newResult])
        
        // Update counters
        const criticalCount = newResult.issues.filter(i => i.severity === 'critical').length
        setCriticalIssues(prev => prev + criticalCount)
        setTotalIssues(prev => prev + newResult.issues.length)
        break
        
      case 'complete':
        setIsAnalyzing(false)
        setProgress(100)
        console.log('✅ Analysis complete!', update.data)
        break
        
      case 'error':
        console.error('❌ Analysis error:', update.data)
        setIsAnalyzing(false)
        break
    }
  }

  // Start enterprise analysis
  const startAnalysis = async () => {
    if (!repoUrl.trim()) return

    setIsAnalyzing(true)
    setResults([])
    setCriticalIssues(0)
    setTotalIssues(0)
    setProgress(0)
    
    try {
      // Parse repository URL
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      // Start analysis with selected strategy
      const response = await fetch('/api/enterprise-analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          strategy: analysisMode
        })
      })
      
      const { analysisId, strategy } = await response.json()
      setAnalysisStrategy(strategy.description)
      
      // Connect WebSocket for real-time updates
      connectWebSocket(analysisId)
      
    } catch (error) {
      console.error('Failed to start analysis:', error)
      setIsAnalyzing(false)
    }
  }

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800' 
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'security': return '🚨'
      case 'bug': return '🐛'
      case 'smell': return '👃'
      default: return '⚠️'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🚀 Enterprise Code Analysis</h1>
        <p className="text-gray-600">
          Competitor-inspired analysis: Incremental, Priority-based, and Streaming Results
        </p>
      </div>

      {/* Analysis Strategy Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Choose Analysis Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {Object.entries(analysisStrategies).map(([key, strategy]) => (
              <div
                key={key}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  analysisMode === key 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setAnalysisMode(key as any)}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">{strategy.icon}</span>
                  <h3 className="font-semibold">{strategy.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
                <Badge className={strategy.color}>
                  ⏱️ {strategy.estimatedTime}
                </Badge>
              </div>
            ))}
          </div>

          {/* Repository Input */}
          <div className="flex space-x-2">
            <Input
              placeholder="https://github.com/owner/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isAnalyzing}
            />
            <Button 
              onClick={startAnalysis} 
              disabled={isAnalyzing || !repoUrl.trim()}
              className="min-w-[150px]"
            >
              {isAnalyzing ? '🔄 Analyzing...' : '🚀 Start Analysis'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Progress */}
      {isAnalyzing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>📊 Live Analysis Progress</span>
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                {connectionStatus === 'connected' ? '🟢 Live' : '🔴 Offline'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress: {filesAnalyzed} / {totalFiles} files</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{criticalIssues}</div>
                <div className="text-sm text-gray-600">🚨 Critical Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalIssues}</div>
                <div className="text-sm text-gray-600">📊 Total Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{results.length}</div>
                <div className="text-sm text-gray-600">📁 Files Processed</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-purple-600">{estimatedTime}</div>
                <div className="text-sm text-gray-600">⏱️ Est. Remaining</div>
              </div>
            </div>
            
            {currentFile && (
              <div className="bg-gray-50 p-3 rounded">
                <span className="text-sm text-gray-600">Currently analyzing: </span>
                <span className="font-mono text-sm">{currentFile}</span>
              </div>
            )}
            
            {analysisStrategy && (
              <div className="bg-blue-50 p-3 rounded">
                <span className="text-sm text-blue-600">Strategy: </span>
                <span className="text-sm">{analysisStrategy}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Streaming Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🔄 Live Results Stream</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="critical" className="w-full">
              <TabsList>
                <TabsTrigger value="critical">🚨 Critical ({results.reduce((acc, r) => acc + r.issues.filter(i => i.severity === 'critical').length, 0)})</TabsTrigger>
                <TabsTrigger value="all">📊 All Issues ({totalIssues})</TabsTrigger>
                <TabsTrigger value="files">📁 Files ({results.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="critical" className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, idx) => 
                  result.issues
                    .filter(issue => issue.severity === 'critical')
                    .map((issue, issueIdx) => (
                      <div key={`${idx}-${issueIdx}`} className="border-l-4 border-red-500 pl-4 py-2">
                        <div className="flex items-center space-x-2 mb-1">
                          <span>{getTypeIcon(issue.type)}</span>
                          <Badge className={getSeverityColor(issue.severity)}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-sm text-gray-600">{result.file}:{issue.line}</span>
                        </div>
                        <p className="text-sm">{issue.message}</p>
                        {issue.code && (
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                            <code>{issue.code}</code>
                          </pre>
                        )}
                      </div>
                    ))
                )}
              </TabsContent>
              
              <TabsContent value="all" className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, idx) => 
                  result.issues.map((issue, issueIdx) => (
                    <div key={`${idx}-${issueIdx}`} className="border-l-2 border-gray-300 pl-4 py-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <span>{getTypeIcon(issue.type)}</span>
                        <Badge className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                        <span className="font-mono text-sm text-gray-600">{result.file}:{issue.line}</span>
                      </div>
                      <p className="text-sm">{issue.message}</p>
                    </div>
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="files" className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{result.file}</span>
                      <Badge variant="outline">
                        {result.issues.length} issues
                      </Badge>
                    </div>
                    <div className="flex space-x-2">
                      {result.issues.filter(i => i.severity === 'critical').length > 0 && (
                        <Badge className="bg-red-100 text-red-800">
                          🚨 {result.issues.filter(i => i.severity === 'critical').length}
                        </Badge>
                      )}
                      {result.issues.filter(i => i.type === 'security').length > 0 && (
                        <Badge className="bg-orange-100 text-orange-800">
                          🔒 {result.issues.filter(i => i.type === 'security').length}
                        </Badge>
                      )}
                      {result.issues.filter(i => i.type === 'bug').length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          🐛 {result.issues.filter(i => i.type === 'bug').length}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>💡 How This Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <span className="mr-2">⚡</span>
                Incremental Analysis
              </h4>
              <p className="text-sm text-gray-600">
                Like Greptile - Only analyzes files changed since the last scan. Perfect for regular monitoring.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <span className="mr-2">🎯</span>
                Priority Analysis
              </h4>
              <p className="text-sm text-gray-600">
                Like SonarQube - Analyzes critical files first and streams results in real-time.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <span className="mr-2">🌊</span>
                Streaming Results
              </h4>
              <p className="text-sm text-gray-600">
                See issues as they're discovered. No waiting for complete analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
