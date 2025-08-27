'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import React from 'react' // Added for RepoChat component
import DashboardHeader from '@/components/DashboardHeader'
import AnalysisProgressModal from '@/components/AnalysisProgressModal'

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
  analysisResults?: any // Added for detailed analysis results
}

export default function Repositories() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisResults, setAnalysisResults] = useState<{[key: string]: any}>({})
  const [expandedResults, setExpandedResults] = useState<{[key: string]: boolean}>({})
  const [profilePic, setProfilePic] = useState<string | null>(null)
  
  // New states for GitHub OAuth repos
  const [githubConnected, setGithubConnected] = useState(false)
  const [availableGithubRepos, setAvailableGithubRepos] = useState<any[]>([])
  const [showRepoDropdown, setShowRepoDropdown] = useState(false)
  const [loadingGithubRepos, setLoadingGithubRepos] = useState(false)
  const [refreshingGithub, setRefreshingGithub] = useState(false)
  
  // Progress Modal states
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({
    percentage: 0
  })
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false)
  const [hasAnalysisError, setHasAnalysisError] = useState(false)

  // Load repositories from database on component mount
  const loadRepositories = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot load repositories')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔍 REPOSITORIES: Loading repositories for user:', currentUser.id)
      
      const response = await fetch(`/api/repositories?userId=${currentUser.id}`)
      if (response.ok) {
        const repos = await response.json()
        console.log(`✅ REPOSITORIES: Loaded ${repos.length} repositories for user ${currentUser.id}:`, repos)
        
        // Remove duplicates by fullName (keep the first occurrence)
        const uniqueRepos = repos.filter((repo: Repository, index: number, self: Repository[]) => 
          index === self.findIndex(r => r.fullName === repo.fullName)
        )
        
        if (uniqueRepos.length !== repos.length) {
          console.log(`🧹 CLEANUP: Removed ${repos.length - uniqueRepos.length} duplicate repositories`)
        }
        
        // Set proper status for each repository
        const reposWithStatus = uniqueRepos.map((repo: Repository) => ({
          ...repo,
          status: repo.analyzing ? 'pending' : (repo.bugs > 0 ? 'active' : 'pending'),
          reviews: repo.analysisResults ? 1 : 0
        }))
        
        setRepositories(reposWithStatus)
        
        // Load stored analysis results for each repository
        const analysisData: {[key: string]: any} = {}
        for (const repo of repos) {
          console.log(`📊 Repository data for ${repo.fullName}:`, {
            stars: repo.stars,
            forks: repo.forks,
            language: repo.language,
            description: repo.description,
            bugs: repo.bugs
          })
          if (repo.analysisResults) {
            analysisData[repo.fullName] = repo.analysisResults
            console.log(`📊 Loaded analysis results for ${repo.fullName}:`, repo.analysisResults)
          }
        }
        setAnalysisResults(analysisData)
        
        console.log(`📊 Loaded ${repos.length} repositories with ${Object.keys(analysisData).length} analysis results`)
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
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot save repository')
        return null
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('💾 REPOSITORIES: Saving repository for user:', currentUser.id)
      
      // Add userId to repository data
      const repoWithUser = {
        ...repo,
        userId: currentUser.id
      }
      
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repoWithUser),
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

  // Check GitHub connection status
  const checkGithubConnection = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, GitHub connection unknown')
        setGithubConnected(false)
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      const response = await fetch(`/api/profile?userId=${currentUser.id}`)
      const data = await response.json()
      if (data.success && data.profile && data.profile.githubConnected) {
        setGithubConnected(true)
        console.log('✅ GitHub is connected')
      } else {
        console.log('❌ GitHub is not connected')
        setGithubConnected(false)
      }
    } catch (error) {
      console.error('Error checking GitHub connection:', error)
      setGithubConnected(false)
    }
  }

  // Load repositories on component mount
  useEffect(() => {
    loadRepositories()
    checkGithubConnection()
    // Load profile picture from localStorage
    const savedProfilePic = localStorage.getItem('profileImage')
    if (savedProfilePic) {
      setProfilePic(savedProfilePic)
    }
  }, [])



  // Fetch real GitHub repositories using OAuth
  const fetchGithubRepos = async () => {
    setLoadingGithubRepos(true)
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot fetch GitHub repositories')
        alert('Please sign in to fetch repositories')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔄 REPOS: Fetching GitHub repositories for user:', currentUser.id)
      
      const response = await fetch(`/api/github/repositories?userId=${currentUser.id}`)
      const data = await response.json()
      
      if (data.success && data.repositories) {
        setAvailableGithubRepos(data.repositories)
        setGithubConnected(true)
        setShowRepoDropdown(true)
        console.log('✅ Fetched GitHub repositories:', data.repositories.length, 'for user:', currentUser.id)
      } else {
        console.log('❌ GitHub not connected or no repositories found for user:', currentUser.id)
        console.log('Error details:', data.error)
        alert('Please connect your GitHub account first in the Setup Bot')
      }
    } catch (error) {
      console.error('Error fetching GitHub repositories:', error)
      alert('Failed to fetch GitHub repositories. Please try again.')
    } finally {
      setLoadingGithubRepos(false)
    }
  }

  const handleFetchRepos = () => {
    if (githubConnected) {
      fetchGithubRepos()
    } else {
      alert('Please connect your GitHub account first to fetch repositories.')
    }
  }

  // Simple refresh GitHub connection
  const refreshGithubConnection = async () => {
    if (!confirm('This will refresh your GitHub connection. You may need to re-authenticate. Continue?')) {
      return
    }

    try {
      setRefreshingGithub(true)
      
      // Get current user
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        alert('Please log in first')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔄 REFRESH: Starting GitHub refresh for user:', currentUser.id)
      
      // Direct redirect to OAuth endpoint - it will handle the redirect automatically
      console.log('🔄 REPOS: Redirecting to GitHub OAuth endpoint')
      window.location.href = `/api/github/oauth?userId=${currentUser.id}`
      
    } catch (error) {
      console.error('❌ REFRESH: Error refreshing GitHub connection:', error)
      alert('Failed to refresh GitHub connection. Please try again.')
      setRefreshingGithub(false)
    }
  }

  // Add repository from GitHub dropdown
  const addGithubRepository = async (repo: any) => {
    try {
      console.log('🔄 Adding GitHub repository:', repo.fullName)
      
      const repoToAdd = {
        name: repo.name,
        fullName: repo.fullName, // Use our API's transformed field name
        language: repo.language || 'Unknown',
        stars: repo.stars || 0, // Use our API's transformed field name
        forks: repo.forks || 0, // Use our API's transformed field name
        description: repo.description || '',
        url: repo.url, // Use our API's transformed field name
        bugs: 0,
        analyzing: false
      }
      
      console.log('📊 Repository data to save:', repoToAdd)
      
      // Validate data before sending
      if (!repoToAdd.name || !repoToAdd.fullName || !repoToAdd.url) {
        console.error('❌ FRONTEND: Invalid repository data:', repoToAdd)
        alert(`❌ Invalid repository data for ${repo.fullName}. Missing required fields.`)
        return
      }
      
      const savedRepo = await saveRepository(repoToAdd)
      if (savedRepo) {
        console.log('✅ Repository saved successfully:', savedRepo)
        await loadRepositories()
        setShowRepoDropdown(false)
        alert(`✅ Successfully added ${repo.fullName} to your repositories!`)
      } else {
        console.error('❌ Failed to save repository')
        alert('Failed to save repository. Please check the console for details.')
      }
    } catch (error) {
      console.error('❌ Error adding repository:', error)
      alert(`Failed to add repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    
    // 🎯 Initialize Progress Modal
    setShowProgressModal(true)
    setIsAnalysisComplete(false)
    setHasAnalysisError(false)
    setAnalysisProgress({ percentage: 0 })
    
    try {
      console.log('🚀 Starting MULTI-BATCH analysis for:', repo.fullName)
      
      const [owner, repoName] = repo.fullName.split('/')
      const analysisStartTime = Date.now()
      
      // Multi-batch processing - call API multiple times until all files are processed
      let batchIndex = 0
      let hasMoreBatches = true
      let allResults: any[] = []
      let totalBugs = 0
      let totalSecurityIssues = 0
      let totalCodeSmells = 0
      let totalBatches = 0
      
      while (hasMoreBatches) {
        console.log(`📦 Processing batch ${batchIndex + 1} for ${repo.fullName}`)
        
        const response = await fetch('/api/github/analyze-repository-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repoUrl: repo.url || `https://github.com/${repo.fullName}`,
            owner: owner,
            repo: repoName,
            batchIndex: batchIndex,
            batchSize: 4
          }),
        })

        if (!response.ok) {
          console.error(`❌ Batch ${batchIndex + 1} failed with status ${response.status}`)
          
          // 🔄 RETRY LOGIC: Don't give up on first failure
          const maxRetries = 2
          let retryCount = 0
          let retrySuccess = false
          
          while (retryCount < maxRetries && !retrySuccess) {
            retryCount++
            const retryDelay = 2000 * retryCount // 2s, 4s exponential backoff
            console.log(`🔄 RETRY ${retryCount}/${maxRetries}: Waiting ${retryDelay/1000}s before retry...`)
            
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            
            try {
              console.log(`🔄 RETRY ${retryCount}: Attempting batch ${batchIndex + 1} again...`)
              const retryResponse = await fetch('/api/github/analyze-repository-batch', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  repoUrl: repo.url || `https://github.com/${repo.fullName}`,
                  owner: owner,
                  repo: repoName,
                  batchIndex: batchIndex,
                  batchSize: 4
                }),
              })
              
              if (retryResponse.ok) {
                console.log(`✅ RETRY ${retryCount}: Batch ${batchIndex + 1} succeeded on retry!`)
                response = retryResponse // Use the successful retry response
                retrySuccess = true
              } else {
                console.log(`❌ RETRY ${retryCount}: Still failing with status ${retryResponse.status}`)
              }
            } catch (retryError) {
              console.log(`❌ RETRY ${retryCount}: Network error:`, retryError)
            }
          }
          
          if (!retrySuccess) {
            console.error(`💀 FINAL FAILURE: Batch ${batchIndex + 1} failed after ${maxRetries} retries`)
            
            // 🚀 FAULT-TOLERANT: Continue with next batch instead of stopping
            console.log(`🔄 FAULT-TOLERANT: Skipping batch ${batchIndex + 1}, continuing with next batch...`)
            batchIndex++
            continue // Skip this batch and try the next one
          }
        }

        const batchData = await response.json()
        console.log(`✅ Batch ${batchIndex + 1} completed:`, batchData.progress)
        
        // 🔍 DEBUG: Log the complete batch response to see what backend returned
        console.log(`🔍 DEBUG: Complete batch ${batchIndex + 1} response:`, {
          success: batchData.success,
          repository: batchData.repository,
          totalFilesInRepo: batchData.totalFilesInRepo,
          batchStartIndex: batchData.batchStartIndex,
          batchEndIndex: batchData.batchEndIndex,
          filesProcessedInBatch: batchData.filesProcessedInBatch,
          hasMoreBatches: batchData.hasMoreBatches,
          nextBatchIndex: batchData.nextBatchIndex,
          resultsCount: batchData.results?.length || 0
        })
        
        // Accumulate results from this batch
        allResults = allResults.concat(batchData.results || [])
        totalBugs += batchData.totalBugs || 0
        totalSecurityIssues += batchData.totalSecurityIssues || 0
        totalCodeSmells += batchData.totalCodeSmells || 0
        totalBatches++
        
        // 🎯 Update Progress Modal in Real-Time
        const currentProgress = batchData.progress || {}
        setAnalysisProgress({
          percentage: currentProgress.percentage || 0
        })
        
        // 📊 DETAILED FRONTEND BATCH LOGGING
        console.log(`📊 FRONTEND BATCH ${batchIndex + 1} SUMMARY:`)
        console.log(`   Repository: ${repo.fullName}`)
        console.log(`   Files processed in batch: ${batchData.filesProcessedInBatch || 0}`)
        console.log(`   Issues found in batch: ${batchData.totalBugs || 0} bugs, ${batchData.totalSecurityIssues || 0} security, ${batchData.totalCodeSmells || 0} smells`)
        console.log(`   Cumulative totals: ${totalBugs} bugs, ${totalSecurityIssues} security, ${totalCodeSmells} smells`)
        console.log(`   Batches completed: ${totalBatches}`)
        
        // Check if there are more batches
        hasMoreBatches = batchData.hasMoreBatches
        batchIndex = batchData.nextBatchIndex || batchIndex + 1
        
        // Show progress
        if (batchData.progress) {
          console.log(`📈 Repository Progress: ${batchData.progress.percentage}% (${batchData.progress.filesProcessed}/${batchData.progress.totalFiles} files)`)
        }
        
        if (hasMoreBatches) {
          console.log(`🔄 More batches remaining for ${repo.fullName}. Starting batch ${batchIndex + 1}...`)
        } else {
          console.log(`🏁 All batches completed for ${repo.fullName}!`)
        }
      }
      
      console.log(`🎉 MULTI-BATCH analysis completed for ${repo.fullName}:`, {
        totalBatches,
        totalFiles: allResults.length,
        totalBugs,
        totalSecurityIssues,
        totalCodeSmells
      })
      
      const totalIssues = totalBugs + totalSecurityIssues + totalCodeSmells
      
      // 🎯 Mark Analysis as Complete
      setIsAnalysisComplete(true)
      setAnalysisProgress({ percentage: 100 })
      
      // Store analysis results
      setAnalysisResults(prev => ({
        ...prev,
        [repo.fullName]: {
          summary: { 
            totalBugs,
            totalSecurityIssues, 
            totalCodeSmells,
            totalFilesProcessed: allResults.length
          },
          allResults: allResults
        }
      }))
      
      // Update repository with results
      setRepositories(prev => prev.map(r => 
        r.fullName === repo.fullName 
          ? { ...r, bugs: totalIssues, reviews: allResults.length, status: 'active' as const }
          : r
      ))
      
      // Save to database
      try {
        const analysisResultsToSave = {
          summary: { 
            totalBugs,
            totalSecurityIssues, 
            totalCodeSmells,
            totalFilesProcessed: allResults.length
          },
          allResults: allResults
        }
        
        console.log('🔍 DEBUG: Multi-batch analysis results to save:', JSON.stringify(analysisResultsToSave, null, 2))
        
        const updatedRepo = {
          ...repo,
          bugs: totalIssues,
          analyzing: false,
          analysisResults: analysisResultsToSave
        }
        
        console.log('🔍 DEBUG: Updated repo object:', JSON.stringify(updatedRepo, null, 2))
        
        const saveResult = await saveRepository(updatedRepo)
        console.log(`💾 SAVED TO DATABASE: ${repo.fullName} with ${totalIssues} issues from ${totalBatches} batches`)
        console.log('💾 Save result:', saveResult)
        
        // Immediately reload repositories to verify save
        setTimeout(() => {
          loadRepositories()
        }, 1000)
        
      } catch (dbError) {
        console.error('Failed to save analysis results to database:', dbError)
      }
      
      // Don't show alert anymore - progress modal handles completion
      
    } catch (error) {
      console.error('Error analyzing repository:', error)
      
      // 🎯 Handle Error in Progress Modal
      setHasAnalysisError(true)
      setIsAnalysisComplete(true)
      setTimeout(() => setShowProgressModal(false), 2000) // Show error for 2 seconds
    } finally {
      setAnalyzing(null)
    }
  }

  // Delete repository function
  const deleteRepository = async (repo: Repository) => {
    if (!confirm(`Are you sure you want to delete ${repo.fullName}?`)) {
      return
    }
    
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot delete repository')
        alert('Please sign in to delete repositories')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🗑️ Deleting repository:', repo.fullName, 'for user:', currentUser.id)
      
      const response = await fetch(`/api/repositories?fullName=${encodeURIComponent(repo.fullName)}&userId=${encodeURIComponent(currentUser.id)}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setRepositories(prev => prev.filter(r => r.fullName !== repo.fullName))
        console.log('✅ Repository deleted:', repo.fullName)
      } else {
        console.error('Failed to delete repository')
        alert('Failed to delete repository. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting repository:', error)
      alert('Failed to delete repository. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="repositories" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repositories</h1>
            <p className="text-gray-600">Manage your connected repositories and their AI review settings</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleFetchRepos}
              disabled={loading || loadingGithubRepos || refreshingGithub}
              className="btn-primary disabled:opacity-50"
            >
              {loadingGithubRepos ? 'Loading...' : (githubConnected ? 'Fetch GitHub Repos' : 'Fetch Repos')}
            </button>
            {githubConnected ? (
              <button 
                onClick={refreshGithubConnection}
                disabled={loading || loadingGithubRepos || refreshingGithub}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {refreshingGithub ? '🔄 Refreshing...' : '🔄 Refresh GitHub'}
              </button>
            ) : (
              <button 
                onClick={refreshGithubConnection}
                disabled={loading || loadingGithubRepos || refreshingGithub}
                className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-not-allowed"
              >
                {refreshingGithub ? '🔗 Connecting...' : '🔗 Connect GitHub'}
              </button>
            )}
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
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
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
                </div>
              </div>
            ) : (
              repositories.map((repo) => (
              <div key={repo.id} className="p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-semibold text-gray-900">{repo.name}</h3>
                        {repo.isPrivate && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{repo.fullName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span>⭐ {repo.stars}</span>
                      <span>🍴 {repo.forks}</span>
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                      <span>{repo.language}</span>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-600">{repo.bugs}</p>
                      <p className="text-xs text-gray-500">Issues</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {repo.bugs > 0 && (
                        <Link 
                          href="/dashboard/reviews"
                          onClick={() => localStorage.setItem('expandRepo', repo.fullName)}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          View Issues
                        </Link>
                      )}
                      
                      {!analyzing || analyzing !== repo.fullName ? (
                        <button
                          onClick={() => analyzeRepository(repo)}
                          disabled={analyzing === repo.fullName}
                          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700"
                        >
                          🔍 Analyze
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
                          🔍 Analyzing...
                        </span>
                      )}
                      
                      {/* Always show PR Analysis button for testing */}
                      <button
                        onClick={() => window.open(`/dashboard/pr-analysis?repo=${encodeURIComponent(repo.fullName)}`, '_blank')}
                        className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-green-600 text-white hover:bg-green-700"
                      >
                        📋 PR Analysis
                      </button>
                      
                      <button 
                        onClick={() => deleteRepository(repo)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete repository"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </div>

        {/* GitHub Repositories Dropdown Modal */}
        {showRepoDropdown && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Select GitHub Repository</h3>
                <button
                  onClick={() => setShowRepoDropdown(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                {availableGithubRepos.map((repo) => (
                  <div key={repo.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{repo.name}</h4>
                          {repo.private && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Private</span>
                          )}
                          {repo.language && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">{repo.language}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{repo.fullName}</p>
                        {repo.description && (
                          <p className="text-sm text-gray-500 mt-1">{repo.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center">
                            ⭐ {repo.stars}
                          </span>
                          <span className="flex items-center">
                            🍴 {repo.forks}
                          </span>
                          <span>Updated: {new Date(repo.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addGithubRepository(repo)}
                        className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      >
                        Add Repository
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {availableGithubRepos.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No repositories found. Make sure your GitHub account is connected.
                </div>
              )}
            </div>
          </div>
        )}

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
      
      {/* 🎯 Analysis Progress Modal */}
      <AnalysisProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        repositoryName={analyzing || ''}
        progress={analysisProgress}
        isComplete={isAnalysisComplete}
        hasError={hasAnalysisError}
      />
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