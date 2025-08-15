'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import React from 'react' // Added for RepoChat component

interface Repository {
  id?: string | number
  name: string
  fullName: string
  language?: string
  lastReview?: string
  status?: 'active' | 'inactive' | 'pending'
  reviews?: number
  bugs: number
  stars: number
  forks: number
  isPrivate?: boolean
  description?: string
  updatedAt?: string
  htmlUrl?: string
  url: string
  analyzing?: boolean
  createdAt?: string
}

export default function Repositories() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('octocat')
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisResults, setAnalysisResults] = useState<{[key: string]: any}>({})
  const [expandedResults, setExpandedResults] = useState<{[key: string]: boolean}>({})

  // Load repositories from database on component mount
  const loadRepositories = async () => {
    try {
      const response = await fetch('/api/repositories')
      if (response.ok) {
        const repos = await response.json()
        setRepositories(repos)
      } else {
        console.error('Failed to load repositories from database')
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
    }
  }

  // Save repository to database
  const saveRepository = async (repo: Repository) => {
    try {
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repo),
      })
      if (response.ok) {
        const savedRepo = await response.json()
        return savedRepo
      } else {
        console.error('Failed to save repository to database')
      }
    } catch (error) {
      console.error('Error saving repository:', error)
    }
  }

  // Load repositories on component mount
  useEffect(() => {
    loadRepositories()
  }, [])

  const fetchRepositories = async (githubUsername: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/github/repos?username=${githubUsername}`)
      if (response.ok) {
        const repos = await response.json()
        // Save each repository to database
        for (const repo of repos) {
          await saveRepository(repo)
        }
        // Reload from database to get the saved versions
        await loadRepositories()
      } else {
        console.error('Failed to fetch repositories')
      }
    } catch (error) {
      console.error('Error fetching repositories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchRepos = () => {
    if (username.trim()) {
      fetchRepositories(username.trim())
    }
  }

  const handleConnectRepository = async () => {
    if (!repoUrl.trim()) {
      alert('Please enter a repository URL')
      return
    }

    console.log('Connecting repository:', repoUrl)

    try {
      // Extract username and repo name from GitHub URL
      const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (!urlMatch) {
        alert('Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)')
        return
      }

      const [, owner, repo] = urlMatch
      console.log('Extracted owner:', owner, 'repo:', repo)
      
      // Fetch the specific repository
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
      console.log('Fetching from:', apiUrl)
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Greptile-Clone'
        }
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GitHub API error:', errorText)
        alert(`Repository not found or is private. Status: ${response.status}`)
        return
      }

      const repoData = await response.json()
      console.log('Repository data received:', repoData.name, repoData.full_name)

      // Add to repositories list
      const newRepo: Repository = {
        id: Date.now(), // Use timestamp for unique ID
        name: repoData.name,
        fullName: repoData.full_name,
        language: repoData.language || 'Unknown',
        lastReview: 'Never',
        status: 'pending',
        reviews: 0,
        bugs: 0,
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        isPrivate: repoData.private || false,
        description: repoData.description || 'No description',
        updatedAt: repoData.updated_at,
        htmlUrl: repoData.html_url,
        url: repoData.html_url
      }

      console.log('Adding new repo:', newRepo)
      
      // Save to database
      const savedRepo = await saveRepository(newRepo)
      if (savedRepo) {
        // Reload repositories from database to get the saved version
        await loadRepositories()
        alert(`✅ Successfully connected ${repoData.full_name}!`)
      } else {
        alert('❌ Failed to save repository to database')
      }
      
      setRepoUrl('')
      setShowAddRepo(false)
    } catch (error) {
      console.error('Error connecting repository:', error)
      alert(`❌ Failed to connect repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const toggleDetailedResults = (repoFullName: string) => {
    setExpandedResults(prev => ({
      ...prev,
      [repoFullName]: !prev[repoFullName]
    }))
  }

  const analyzeRepository = async (repo: Repository) => {
    const repoKey = `${repo.fullName}`
    setAnalyzing(repoKey)
    
    try {
      console.log('🚀 Starting UNLIMITED batch analysis for:', repo.fullName)
      
      const [owner, repoName] = repo.fullName.split('/')
      
      // Initialize batch processing
      let batchIndex = 0
      let allResults: any[] = []
      let totalBugs = 0
      let totalSecurityIssues = 0
      let totalCodeSmells = 0
      let totalFilesInRepo = 0
      let totalFilesProcessed = 0
      let hasMoreBatches = true
      
      // Process all batches until complete
      while (hasMoreBatches) {
        console.log(`📊 Processing BATCH ${batchIndex + 1}...`)
        
        const response = await fetch('/api/github/analyze-repository-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repoUrl: repo.htmlUrl,
            owner: owner,
            repo: repoName,
            batchIndex: batchIndex,
            batchSize: 15  // Smaller batches = faster completion
          }),
        })

        if (!response.ok) {
          if (response.status === 504 || response.status === 502) {
            console.log(`⏰ Batch ${batchIndex + 1} timeout (${response.status}) - continuing with next batch...`)
            batchIndex++
            // Small delay before retrying next batch
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          console.error(`❌ Batch ${batchIndex + 1} failed with status ${response.status}`)
          batchIndex++
          continue // Continue with next batch instead of throwing error
        }

        let batchData
        try {
          batchData = await response.json()
          console.log(`✅ BATCH ${batchIndex + 1} results:`, batchData)
        } catch (jsonError) {
          console.error('JSON parsing error for batch:', jsonError)
          batchIndex++
          continue
        }

        if (batchData.success) {
          // Accumulate results from this batch
          allResults.push(...(batchData.results || []))
          totalBugs += batchData.totalBugs || 0
          totalSecurityIssues += batchData.totalSecurityIssues || 0
          totalCodeSmells += batchData.totalCodeSmells || 0
          totalFilesInRepo = batchData.totalFilesInRepo || 0
          totalFilesProcessed = batchData.progress?.filesProcessed || 0
          
          console.log(`📈 PROGRESS: ${totalFilesProcessed}/${totalFilesInRepo} files (${batchData.progress?.percentage || 0}%)`)
          
          // Check if there are more batches
          hasMoreBatches = batchData.hasMoreBatches
          batchIndex = batchData.nextBatchIndex || batchIndex + 1
          
          // Update UI with current progress (use TOTAL issues, not just bugs)
          const currentTotalIssues = totalBugs + totalSecurityIssues + totalCodeSmells
          console.log(`📊 BATCH ${batchIndex + 1} UPDATE: Setting total issues to ${currentTotalIssues} (${totalBugs} bugs + ${totalSecurityIssues} security + ${totalCodeSmells} smells) for ${repo.fullName}`)
          setRepositories(prev => prev.map(r => 
            r.fullName === repo.fullName 
              ? { ...r, bugs: currentTotalIssues, reviews: totalFilesProcessed, status: 'active' as const }
              : r
          ))
          
        } else {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, batchData.error)
          batchIndex++
          if (batchIndex > 20) break // Safety limit
        }
        
        // Shorter delay between batches for faster processing
        if (hasMoreBatches) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
      // Store final combined results
      const finalResults = {
        success: true,
        repository: `${owner}/${repoName}`,
        totalFilesFound: totalFilesInRepo,
        filesAnalyzed: totalFilesProcessed,
        totalBugs,
        totalSecurityIssues,
        totalCodeSmells,
        results: allResults,
        coverage: {
          percentage: Math.round((totalFilesProcessed / totalFilesInRepo) * 100),
          analyzed: totalFilesProcessed,
          total: totalFilesInRepo
        }
      }
      
      setAnalysisResults(prev => ({
        ...prev,
        [repoKey]: finalResults
      }))
      
      const coverage = finalResults.coverage ? `${finalResults.coverage.percentage}%` : '100%'
      const totalIssues = totalBugs + totalSecurityIssues + totalCodeSmells
      
      // Show results dialog
      // Show detailed results in a better format
      const detailedResults = `🚀 ANALYSIS COMPLETE!\n\n` +
            `📊 Repository: ${finalResults.repository}\n` +
            `📁 Total Files: ${totalFilesInRepo}\n` +
            `🔍 Files Analyzed: ${totalFilesProcessed}\n` +
            `📈 Coverage: ${coverage}\n\n` +
            `🎯 ISSUES BREAKDOWN:\n` +
            `🐛 Logic Bugs: ${totalBugs}\n` +
            `🔒 Security Issues: ${totalSecurityIssues}\n` +
            `💡 Code Smells: ${totalCodeSmells}\n` +
            `📊 TOTAL: ${totalIssues} issues\n\n` +
            `Click "View Details" to see specific issues!`
      
      alert(detailedResults)
      
      // Log detailed results to console for inspection
      console.log('🔍 DETAILED ANALYSIS RESULTS:', {
        repository: finalResults.repository,
        totalIssues: totalIssues,
        breakdown: { bugs: totalBugs, security: totalSecurityIssues, codeSmells: totalCodeSmells },
        allResults: allResults
      })
      
      // Show first few issues as examples
      if (allResults.length > 0) {
        console.log('📋 SAMPLE ISSUES FOUND:')
        allResults.slice(0, 3).forEach((result: any, index: number) => {
          console.log(`\n📁 File ${index + 1}: ${result.file}`)
          if (result.bugs?.length > 0) {
            console.log('🐛 Bugs:', result.bugs.slice(0, 2))
          }
          if (result.securityIssues?.length > 0) {
            console.log('🔒 Security:', result.securityIssues.slice(0, 2))
          }
          if (result.codeSmells?.length > 0) {
            console.log('💡 Code Smells:', result.codeSmells.slice(0, 2))
          }
        })
        console.log('\n💡 TIP: Check the browser console for detailed issue descriptions!')
      }
      
      // CRITICAL: Final UI update AFTER alert is dismissed (use TOTAL issues)
      const finalTotalIssues = totalBugs + totalSecurityIssues + totalCodeSmells
      
      // Update local state
      setRepositories(prev => prev.map(r => 
        r.fullName === repo.fullName 
          ? { ...r, bugs: finalTotalIssues, reviews: totalFilesProcessed, status: 'active' as const }
          : r
      ))
      
      // SAVE TO DATABASE - Update the repository with analysis results
      try {
        const updatedRepo = repositories.find(r => r.fullName === repo.fullName)
        if (updatedRepo) {
          const repoToSave = {
            ...updatedRepo,
            bugs: finalTotalIssues,
            analyzing: false
          }
          await saveRepository(repoToSave)
          console.log(`💾 SAVED TO DATABASE: ${repo.fullName} with ${finalTotalIssues} issues`)
        }
      } catch (dbError) {
        console.error('Failed to save analysis results to database:', dbError)
      }
      
      console.log(`🔒 FINAL UPDATE: Setting total issues to ${finalTotalIssues} (${totalBugs} bugs + ${totalSecurityIssues} security + ${totalCodeSmells} smells) for ${repo.fullName}`)
            
    } catch (error) {
      console.error('Batch analysis error:', error)
      alert(`❌ Batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🦎</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Greptile Clone</span>
              </Link>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/dashboard/repositories" className="text-primary-600 font-medium">
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repositories</h1>
            <p className="text-gray-600">Manage your connected repositories and their AI review settings</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="GitHub username"
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleFetchRepos()
                  }
                }}
              />
              <button 
                onClick={handleFetchRepos}
                disabled={loading}
                className="btn-primary disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Fetch Repos'}
              </button>
            </div>
            <button 
              onClick={() => setShowAddRepo(true)}
              className="btn-outline"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Repository
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Repositories</p>
                <p className="text-2xl font-bold text-gray-900">{repositories.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{repositories.filter(r => r.status === 'active').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Setup</p>
                <p className="text-2xl font-bold text-gray-900">{repositories.filter(r => r.status === 'pending').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reviews</p>
                <p className="text-2xl font-bold text-gray-900">{repositories.reduce((sum, repo) => sum + (repo.reviews || 0), 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Repository List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Repositories</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {repositories.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No repositories connected</h3>
                <p className="text-gray-500 mb-6">Get started by connecting your first repository or fetching repos from a GitHub user.</p>
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setShowAddRepo(true)}
                    className="btn-primary"
                  >
                    Add Repository
                  </button>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="GitHub username"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleFetchRepos()
                        }
                      }}
                    />
                    <button
                      onClick={handleFetchRepos}
                      disabled={loading}
                      className="btn-outline text-sm"
                    >
                      {loading ? 'Loading...' : 'Fetch Repos'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              repositories.map((repo) => (
              <div key={repo.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-7 h-7 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold text-gray-900">{repo.name}</h3>
                        {repo.isPrivate && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{repo.fullName}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-sm text-gray-500">
                          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
                          {repo.language}
                        </span>
                        <span className="text-sm text-gray-500">
                          ⭐ {repo.stars}
                        </span>
                        <span className="text-sm text-gray-500">
                          🍴 {repo.forks}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{repo.reviews}</p>
                      <p className="text-sm text-gray-600">Reviews</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{repo.bugs}</p>
                      <p className="text-sm text-gray-600">Issues Found</p>
                    </div>
                    <div className="text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        repo.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : repo.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {repo.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Last: {repo.lastReview}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex gap-2">
                        {repo.bugs > 0 ? (
                          <button
                            onClick={() => toggleDetailedResults(repo.fullName)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                          >
                            📋 View {repo.bugs} Issues
                          </button>
                        ) : (
                          <button
                            onClick={() => analyzeRepository(repo)}
                            disabled={analyzing === repo.fullName}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              analyzing === repo.fullName
                                ? 'bg-blue-100 text-blue-800 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {analyzing === repo.fullName ? '🔍 Analyzing...' : '🔍 Analyze Code'}
                          </button>
                        )}
                        
                        {analysisResults[repo.fullName] && (
                          <button
                            onClick={() => toggleDetailedResults(repo.fullName)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              expandedResults[repo.fullName]
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {expandedResults[repo.fullName] ? '🔼 Hide Details' : '📋 View Details'}
                          </button>
                        )}
                      </div>
                      <button className="p-2 text-gray-600 hover:text-gray-900">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button className="p-2 text-gray-600 hover:text-red-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Expandable Results Section */}
                {(expandedResults[repo.fullName] || repo.bugs > 0) && (
                  <div className="mx-6 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="space-y-4">
                      {/* Results Header */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-900">📋 Analysis Results</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          {analysisResults[repo.fullName] ? (
                            <>
                              <span>📁 {analysisResults[repo.fullName].filesAnalyzed} files analyzed</span>
                              <span>📈 {analysisResults[repo.fullName].coverage?.percentage || 100}% coverage</span>
                            </>
                          ) : (
                            <span>📊 {repo.bugs} issues found in previous analysis</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Issue Breakdown */}
                      {analysisResults[repo.fullName] ? (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-red-100 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{analysisResults[repo.fullName].totalBugs || 0}</div>
                            <div className="text-sm text-red-800">🐛 Logic Bugs</div>
                          </div>
                          <div className="text-center p-3 bg-orange-100 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">{analysisResults[repo.fullName].totalSecurityIssues || 0}</div>
                            <div className="text-sm text-orange-800">🔒 Security Issues</div>
                          </div>
                          <div className="text-center p-3 bg-yellow-100 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{analysisResults[repo.fullName].totalCodeSmells || 0}</div>
                            <div className="text-sm text-yellow-800">💡 Code Smells</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-6 bg-blue-50 rounded-lg border-2 border-dashed border-blue-200">
                          <div className="text-2xl font-bold text-blue-600">{repo.bugs}</div>
                          <div className="text-sm text-blue-800 mb-3">🔍 Total Issues Found</div>
                          <button
                            onClick={() => analyzeRepository(repo)}
                            disabled={analyzing === repo.fullName}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                          >
                            {analyzing === repo.fullName ? '🔍 Re-analyzing...' : '🔄 Re-analyze for Details'}
                          </button>
                          <p className="text-xs text-blue-600 mt-2">Re-run analysis to see detailed breakdown</p>
                        </div>
                      )}
                      
                      {/* Detailed Issues */}
                      {analysisResults[repo.fullName].results && analysisResults[repo.fullName].results.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="font-medium text-gray-900">🔍 Issues Found:</h5>
                                                     <div className="max-h-96 overflow-y-auto space-y-3">
                             {analysisResults[repo.fullName].results.map((fileResult: any, index: number) => (
                              <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                                <div className="font-medium text-gray-900 mb-2">📁 {fileResult.file}</div>
                                
                                {/* Security Issues */}
                                {fileResult.securityIssues?.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-sm font-medium text-orange-700 mb-1">🔒 Security Issues ({fileResult.securityIssues.length}):</div>
                                                                         {fileResult.securityIssues.map((issue: any, issueIndex: number) => (
                                      <div key={issueIndex} className="text-sm bg-orange-50 p-2 rounded border-l-2 border-orange-200 mb-1">
                                                                                 <div className="font-medium text-orange-800">Line {issue.line}: {issue.type} 
                                           <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                                             issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                             issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                             issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                             'bg-blue-100 text-blue-800'
                                           }`}>
                                             {issue.severity}
                                           </span>
                                         </div>
                                         {issue.codeSnippet && (
                                           <div className="bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono mt-1 overflow-x-auto">
                                             <span className="text-gray-400">Line {issue.line}:</span> {issue.codeSnippet}
                                           </div>
                                         )}
                                         <div className="text-orange-700 mt-1">{issue.description}</div>
                                         {issue.suggestion && (
                                           <div className="text-orange-600 text-xs mt-1 italic">💡 {issue.suggestion}</div>
                                         )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Code Smells */}
                                {fileResult.codeSmells?.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-sm font-medium text-yellow-700 mb-1">💡 Code Smells ({fileResult.codeSmells.length}):</div>
                                                                         {fileResult.codeSmells.map((smell: any, smellIndex: number) => (
                                      <div key={smellIndex} className="text-sm bg-yellow-50 p-2 rounded border-l-2 border-yellow-200 mb-1">
                                                                                 <div className="font-medium text-yellow-800">Line {smell.line}: {smell.type}</div>
                                         {smell.codeSnippet && (
                                           <div className="bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono mt-1 overflow-x-auto">
                                             <span className="text-gray-400">Line {smell.line}:</span> {smell.codeSnippet}
                                           </div>
                                         )}
                                         <div className="text-yellow-700 mt-1">{smell.description}</div>
                                         {smell.suggestion && (
                                           <div className="text-yellow-600 text-xs mt-1 italic">💡 {smell.suggestion}</div>
                                         )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Logic Bugs */}
                                {fileResult.bugs?.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-sm font-medium text-red-700 mb-1">🐛 Logic Bugs ({fileResult.bugs.length}):</div>
                                                                         {fileResult.bugs.map((bug: any, bugIndex: number) => (
                                      <div key={bugIndex} className="text-sm bg-red-50 p-2 rounded border-l-2 border-red-200 mb-1">
                                                                                 <div className="font-medium text-red-800">Line {bug.line}: {bug.type}
                                           <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                                             bug.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                             bug.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                             bug.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                             'bg-blue-100 text-blue-800'
                                           }`}>
                                             {bug.severity}
                                           </span>
                                         </div>
                                         {bug.codeSnippet && (
                                           <div className="bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono mt-1 overflow-x-auto">
                                             <span className="text-gray-400">Line {bug.line}:</span> {bug.codeSnippet}
                                           </div>
                                         )}
                                         <div className="text-red-700 mt-1">{bug.description}</div>
                                         {bug.suggestion && (
                                           <div className="text-red-600 text-xs mt-1 italic">💡 {bug.suggestion}</div>
                                         )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            
                          </div>
                        </div>
                      )}

                      {/* Repo Q&A */}
                      <div className="mt-6 border-t pt-4">
                        <h5 className="font-semibold text-gray-900 mb-2">💬 Ask a question about this repository</h5>
                        <RepoChat repoFullName={repo.fullName} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )))}
          </div>
        </div>

        {/* Add Repository Modal */}
        {showAddRepo && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Repository</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Repository URL</label>
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleConnectRepository()
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowAddRepo(false)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConnectRepository}
                    className="btn-primary"
                  >
                    Connect Repository
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
} 

// Lightweight repo chat widget
function RepoChat({ repoFullName }: { repoFullName: string }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [citations, setCitations] = useState<any[]>([])

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true)
    setAnswer(null)
    setCitations([])
    try {
      const res = await fetch('/api/github/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName, question }),
      })
      const data = await res.json()
      setAnswer(data.answer || 'No answer')
      setCitations(Array.isArray(data.citations) ? data.citations : [])
    } catch (e) {
      setAnswer('Failed to get answer. Check your OpenAI key and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this repo (e.g., How does auth work?)"
          className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
        />
        <button onClick={ask} disabled={loading} className={`px-3 py-2 rounded-md text-white ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}>{loading ? 'Thinking…' : 'Ask'}</button>
      </div>

      {answer && (
        <div className="bg-white border rounded-md p-3 space-y-2">
          <div className="prose prose-sm max-w-none">
            <p>{answer}</p>
          </div>
          {citations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">Sources:</div>
              {citations.map((c, i) => (
                <div key={i} className="bg-gray-50 border rounded p-2">
                  <div className="text-xs text-gray-600">{c.file}{Array.isArray(c.lines) ? ` (lines ${c.lines[0]}-${c.lines[1]})` : ''}</div>
                  {c.snippet && (
                    <pre className="mt-1 bg-gray-900 text-gray-100 text-xs p-2 rounded overflow-x-auto"><code>{c.snippet}</code></pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 