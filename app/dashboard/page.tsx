'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import DashboardHeader from '@/components/DashboardHeader'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import FullScreenChat from '../../components/FullScreenChat'

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

export default function Dashboard() {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState('👤')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [userName, setUserName] = useState('John Doe')
  const [userTitle, setUserTitle] = useState('Software Developer')
  const [githubConnected, setGithubConnected] = useState(false)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [realStats, setRealStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Load real analysis statistics from analyzed repositories
  const loadAnalysisStats = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot load analysis stats')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('📊 DASHBOARD: Loading analysis statistics for user:', currentUser.id)
      
      const response = await fetch(`/api/repositories?userId=${currentUser.id}`)
      if (response.ok) {
        const repos = await response.json()
        
        // Remove duplicates by fullName (keep the first occurrence)
        const uniqueRepos = repos.filter((repo: Repository, index: number, self: Repository[]) => 
          index === self.findIndex(r => r.fullName === repo.fullName)
        )
        
        if (uniqueRepos.length !== repos.length) {
          console.log(`🧹 DASHBOARD: Filtered out ${repos.length - uniqueRepos.length} duplicate repositories`)
        }
        
        // Calculate real stats from analyzed repositories
        const analyzedRepos = uniqueRepos.filter((repo: any) => repo.analyzing === false && repo.bugs > 0)
        const totalIssuesFound = analyzedRepos.reduce((total: number, repo: any) => total + (repo.bugs || 0), 0)
        const totalReviewsCompleted = analyzedRepos.length
        const totalFilesReviewed = analyzedRepos.reduce((total: number, repo: any) => total + (repo.reviews || 0), 0)
        const avgTimePerReview = 45 // minutes
        const totalTimeSaved = totalReviewsCompleted * avgTimePerReview
        
        const analysisStats = {
          reviewsCompleted: totalReviewsCompleted,
          issuesFound: totalIssuesFound,
          timeSaved: totalTimeSaved,
          filesReviewed: totalFilesReviewed,
          activeRepos: repos.length,
          analyzedRepos: analyzedRepos.length
        }
        
        console.log('✅ DASHBOARD: Real analysis stats calculated:', analysisStats)
        setRealStats(analysisStats)
      }
    } catch (error) {
      console.error('❌ DASHBOARD: Error loading analysis stats:', error)
    }
  }

  // Load real GitHub statistics
  const loadRealStats = async () => {
    if (!githubConnected || loadingStats) return
    
    setLoadingStats(true)
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot load GitHub statistics')
        setLoadingStats(false)
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('📊 DASHBOARD: Loading real GitHub statistics for user:', currentUser.id)
      
      const response = await fetch(`/api/github/stats?userId=${currentUser.id}`)
      const data = await response.json()
      
      if (data.success && data.stats) {
        console.log('✅ DASHBOARD: Loaded real GitHub stats:', data.stats)
        setRealStats(data.stats)
      } else {
        console.log('❌ DASHBOARD: Failed to load real stats for user:', currentUser.id, 'Error:', data.error)
        // Fallback to analysis stats
        loadAnalysisStats()
      }
    } catch (error) {
      console.error('❌ DASHBOARD: Error loading real stats:', error)
      // Fallback to analysis stats
      loadAnalysisStats()
    } finally {
      setLoadingStats(false)
    }
  }

  // Load repositories from database or GitHub
  const loadRepositories = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, cannot load repositories')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      
      // First try to load real GitHub repositories if connected
      const githubResponse = await fetch(`/api/github/repositories?userId=${currentUser.id}`)
      const githubData = await githubResponse.json()
      
      if (githubData.success && githubData.repositories) {
        console.log('✅ Loaded real GitHub repositories:', githubData.repositories.length)
        setRepositories(githubData.repositories)
        // Load analysis stats (real issue counts from analyzed repos)
        loadAnalysisStats()
        return
      }
      
      // Fallback to user repositories
      console.log('📋 DASHBOARD: Loading user repositories for:', currentUser.id)
      const response = await fetch(`/api/repositories?userId=${currentUser.id}`)
      if (response.ok) {
        const repos = await response.json()
        console.log(`✅ DASHBOARD: Loaded ${repos.length} repositories for user ${currentUser.id}`)
        // Remove duplicates by fullName
        const uniqueRepos = repos.filter((repo: Repository, index: number, self: Repository[]) => 
          index === self.findIndex(r => r.fullName === repo.fullName)
        )
        setRepositories(uniqueRepos)
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
      // Load user data as final fallback
      try {
        const currentUserStr = localStorage.getItem('currentUser')
        if (currentUserStr) {
          const currentUser = JSON.parse(currentUserStr)
          const response = await fetch(`/api/repositories?userId=${currentUser.id}`)
          if (response.ok) {
            const repos = await response.json()
            // Remove duplicates by fullName
            const uniqueRepos = repos.filter((repo: Repository, index: number, self: Repository[]) => 
              index === self.findIndex(r => r.fullName === repo.fullName)
            )
            setRepositories(uniqueRepos)
          }
        }
      } catch (fallbackError) {
        console.error('Error loading fallback repositories:', fallbackError)
      }
    }
  }

  // Load profile settings from DATABASE (with localStorage fallback)
  const loadProfileSettings = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, using localStorage fallback')
        // Fallback to localStorage if no user session
        const savedIcon = localStorage.getItem('selectedIcon')
        const savedImage = localStorage.getItem('profileImage')
        const savedName = localStorage.getItem('userName')
        const savedTitle = localStorage.getItem('userTitle')
        
        if (savedIcon) setSelectedIcon(savedIcon)
        if (savedImage) setProfileImage(savedImage)
        if (savedName) setUserName(savedName)
        if (savedTitle) setUserTitle(savedTitle)
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔄 DASHBOARD: Loading profile for user:', currentUser.id)
      
      const response = await fetch(`/api/profile?userId=${currentUser.id}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.profile) {
          console.log('✅ DASHBOARD: Loaded from DATABASE:', data.profile)
          const profile = data.profile
          
          setUserName(profile.name || 'R.K.')
          setUserTitle(profile.userTitle || 'Developer')
          setSelectedIcon(profile.selectedIcon || '👤')
          setGithubConnected(profile.githubConnected || false)
          setGithubUsername(profile.githubUsername || null)
          if (profile.profileImage) {
            setProfileImage(profile.profileImage)
          }
          return // Success - exit early
        }
      }
      
      // Fallback to localStorage only if database fails
      console.log('⚠️ Database failed, using localStorage fallback')
      const savedIcon = localStorage.getItem('selectedIcon')
      const savedImage = localStorage.getItem('profileImage')
      const savedName = localStorage.getItem('userName')
      const savedTitle = localStorage.getItem('userTitle')
      
      if (savedIcon) setSelectedIcon(savedIcon)
      if (savedImage) setProfileImage(savedImage)
      if (savedName) setUserName(savedName)
      if (savedTitle) setUserTitle(savedTitle)
      
    } catch (error) {
      console.error('❌ Profile loading error:', error)
    }
  }

  // Save profile settings to DATABASE (with localStorage backup)
  const saveProfileSettings = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, saving to localStorage only')
        // Fallback to localStorage only
        localStorage.setItem('selectedIcon', selectedIcon)
        localStorage.setItem('userName', userName)
        localStorage.setItem('userTitle', userTitle)
        if (profileImage) {
          localStorage.setItem('profileImage', profileImage)
        }
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('💾 DASHBOARD: Saving profile for user:', currentUser.id)
      
      const profileData = {
        userId: currentUser.id,
        name: userName,
        profileImage: profileImage,
        selectedIcon: selectedIcon,
        userTitle: userTitle
      }
      
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      
      if (response.ok) {
        console.log('✅ Saved to DATABASE successfully!')
        
        // Also save to localStorage as backup
        localStorage.setItem('selectedIcon', selectedIcon)
        localStorage.setItem('userName', userName)
        localStorage.setItem('userTitle', userTitle)
        if (profileImage) {
          localStorage.setItem('profileImage', profileImage)
        } else {
          localStorage.removeItem('profileImage')
        }
        return true
      } else {
        console.error('❌ Database save failed, saving to localStorage only')
        localStorage.setItem('selectedIcon', selectedIcon)
        localStorage.setItem('userName', userName)
        localStorage.setItem('userTitle', userTitle)
        if (profileImage) {
          localStorage.setItem('profileImage', profileImage)
        }
        return false
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error)
      return false
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadProfileSettings()
    loadRepositories()
    // Always load real analysis stats from analyzed repositories
    loadAnalysisStats()
  }, [])

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      type: 'ai' as const,
      content: "Hello! I'm your AI code assistant. I have full context of your codebase. Ask me anything about your code, architecture, or specific functions.",
      timestamp: new Date(),
      citations: []
    }
  ])

  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFullScreenChatOpen, setIsFullScreenChatOpen] = useState(false)


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

    const userMessage: ChatMessage = {
      id: messages.length + 1,
      type: 'user' as const,
      content: inputMessage.trim(),
      timestamp: new Date(),
      citations: []
    }

    setMessages(prev => [...prev, userMessage as ChatMessage])
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

      // Handle response with better error checking like Quick Analysis
      let data;
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('❌ JSON parsing failed:', jsonError)
        throw new Error(`API returned invalid JSON (Status: ${response.status})`)
      }

      if (response.ok) {
        // Handle different response formats like Quick Analysis
        let content = '';
        let citations = [];
        
        if (selectedRepo) {
          // Repository-specific chat
          if (data.answer) {
            content = data.answer;
            citations = data.citations || [];
          } else if (typeof data === 'string') {
            content = data;
          } else if (data.content) {
            content = data.content;
            citations = data.citations || [];
          } else {
            content = JSON.stringify(data);
          }
        } else {
          // General AI chat
          if (data.response) {
            content = data.response;
          } else if (typeof data === 'string') {
            content = data;
          } else if (data.content) {
            content = data.content;
          } else {
            content = JSON.stringify(data);
          }
        }
        
        const aiResponse: ChatMessage = {
          id: messages.length + 2,
          type: 'ai',
          content: content || 'Sorry, I encountered an error processing your request.',
          timestamp: new Date(),
          citations: citations
        }
        
        setMessages(prev => [...prev, aiResponse as ChatMessage])
      } else {
        // Handle API errors more gracefully
        const errorMessage = data.error || `API Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error calling AI API:', error)
      
      // More detailed error messages like Quick Analysis
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('504') || error.message.includes('timeout')) {
          errorContent = 'The request timed out. The repository might be large or the API is temporarily unavailable. Please try again.';
        } else if (error.message.includes('503')) {
          errorContent = 'The service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('429')) {
          errorContent = 'Too many requests. Please wait a moment before trying again.';
        } else if (error.message.includes('JSON')) {
          errorContent = 'Received an invalid response from the API. Please try again.';
        } else if (selectedRepo && error.message.includes('Failed to fetch')) {
          errorContent = 'Failed to connect to the repository chat service. Please check your connection and try again.';
        }
      }
      
      const errorResponse: ChatMessage = {
        id: messages.length + 2,
        type: 'ai',
        content: errorContent,
        timestamp: new Date(),
        citations: []
      }
      setMessages(prev => [...prev, errorResponse as ChatMessage])
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
      <DashboardHeader currentPage="dashboard" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {userName.split(' ')[0]}!</h1>
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
                <p className="text-sm font-medium text-gray-600">Reviews Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : (realStats?.reviewsCompleted || (githubConnected ? Math.floor(repositories.length * 0.3) : repositories.length))}
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
                  {loadingStats ? '...' : (realStats?.issuesFound || realStats?.totalIssues || 
                    repositories.reduce((total, repo) => total + (repo.bugs || 0), 0)
                  )}
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
                  {loadingStats ? '...' : (realStats?.timeSaved || realStats?.timesSaved || 
                    repositories.filter(repo => repo.bugs > 0).length * 45
                  )}m
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
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? '...' : (realStats?.activeRepos || repositories.length)}
                </p>
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
              <div className="space-y-4 max-h-80 overflow-y-auto">
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
                  <button
                    onClick={() => setIsFullScreenChatOpen(true)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Expand to full screen"
                  >
                    <ArrowsPointingOutIcon className="w-5 h-5" />
                  </button>
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
                      <MarkdownRenderer 
                        content={message.content} 
                        className={`text-sm ${message.type === 'user' ? 'text-white' : 'text-gray-900'}`} 
                        isUserMessage={message.type === 'user'}
                      />
                      
                      {/* Citations for AI messages */}
                      {message.type === 'ai' && message.citations && message.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">📎 Sources:</p>
                          {message.citations.map((citation: any, idx: number) => (
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
                    </div>
                    {message.type === 'user' && (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center text-sm">
                        {profileImage ? (
                          <img src={profileImage} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span>{selectedIcon}</span>
                        )}
                      </div>
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

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Update Profile Picture</h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Icon Selection */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Choose an Icon</h4>
              <div className="grid grid-cols-6 gap-2">
                {['👤', '👨‍💻', '👩‍💻', '🧑‍💼', '👨‍🎨', '👩‍🎨', '🧑‍🔬', '👨‍🚀', '👩‍🚀', '🤖', '👨‍🏫', '👩‍🏫'].map((icon) => (
                  <button
                    key={icon}
                    onClick={() => {
                      setSelectedIcon(icon)
                      setProfileImage(null)
                    }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-colors ${
                      selectedIcon === icon && !profileImage
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Info */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Profile Information</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., Software Developer, Product Manager"
                  />
                </div>
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Upload Your Photo</h4>
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (e) => {
                        setProfileImage(e.target?.result as string)
                        setSelectedIcon('👤') // Reset icon selection
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                  className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {profileImage && (
                  <button
                    onClick={() => setProfileImage(null)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                  {profileImage ? (
                    <img src={profileImage} alt="Preview" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <span>{selectedIcon}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{userName}</p>
                  <p className="text-sm text-gray-500">{userTitle}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const success = await saveProfileSettings()
                  if (success) {
                    setShowProfileModal(false)
                    // Show success feedback
                    console.log('Profile saved successfully!')
                  } else {
                    alert('Failed to save profile settings. Please try again.')
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Full Screen Chat Modal */}
      <FullScreenChat
        isOpen={isFullScreenChatOpen}
        onClose={() => setIsFullScreenChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        loading={isLoading}
        repoName={selectedRepo ? selectedRepo.fullName : 'General AI'}
      />
    </div>
  )
} 