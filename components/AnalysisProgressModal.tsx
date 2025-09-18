'use client'

import React, { useEffect } from 'react'

interface AnalysisProgressModalProps {
  isOpen: boolean
  onClose: () => void
  repositoryName: string
  repoUrl?: string // Full repository URL for prevention redirect
  progress: {
    percentage: number
    stage?: 'initializing' | 'downloading' | 'extracting' | 'analyzing' | 'complete'
    message?: string
    downloadSpeed?: string
    eta?: string
    downloadedBytes?: number
    totalBytes?: number
    extractedFiles?: number
    totalFiles?: number
  }
  isComplete: boolean
  hasError: boolean
  skippedCount?: number
  isPrevention?: boolean // New prop to distinguish prevention from failure
}

export default function AnalysisProgressModal({
  isOpen,
  onClose,
  repositoryName,
  repoUrl,
  progress,
  isComplete,
  hasError,
  skippedCount = 0,
  isPrevention = false
}: AnalysisProgressModalProps) {
  // Auto-close when analysis is complete (but not for prevention)
  useEffect(() => {
    if (isComplete && !hasError && !isPrevention) {
      const timer = setTimeout(() => {
        onClose()
      }, 1500) // Show success state for 1.5 seconds
      return () => clearTimeout(timer)
    }
  }, [isComplete, hasError, isPrevention, onClose])

  if (!isOpen) return null

  // Determine progress bar color - Green throughout like big companies!
  const getProgressBarColor = () => {
    if (hasError) return 'bg-red-500'
    return 'bg-green-500' // Green throughout the process, just like YouTube, Netflix, etc.
  }

  // Determine status text based on stage
  const getStatusText = () => {
    if (hasError && isPrevention) return 'Repository too large for analysis'
    if (hasError) return 'Repository analysis failed'
    if (isComplete) {
      if (skippedCount > 0) {
        return `Analysis complete (${skippedCount} files skipped)`
      }
      return 'Analysis complete!'
    }
    
    // Show stage-specific status
    switch (progress.stage) {
      case 'initializing':
        return 'Preparing analysis...'
      case 'downloading':
        return 'Downloading repository...'
      case 'extracting':
        return 'Extracting files...'
      case 'analyzing':
        return 'Analyzing code...'
      default:
        return 'Processing repository...'
    }
  }

  // Get stage icon
  const getStageIcon = () => {
    switch (progress.stage) {
      case 'initializing':
        return '🚀'
      case 'downloading':
        return '📥'
      case 'extracting':
        return '📂'
      case 'analyzing':
        return '🔍'
      case 'complete':
        return '✅'
      default:
        return '⚡'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl ${isPrevention ? 'max-w-md' : 'max-w-sm'} w-full mx-4 overflow-hidden relative`}>
        {/* Header */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getStageIcon()}</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {getStatusText()}
              </h3>
              <p className="text-gray-500 text-sm mt-1 truncate">{repositoryName}</p>
            </div>
            {/* Close button - show for prevention or when analysis is complete */}
            {(isPrevention || isComplete) && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

          {/* Progress Content */}
        <div className="px-6 pb-6">
          {/* Progress Percentage */}
          <div className="text-center mb-4">
            <span className="text-2xl font-bold text-gray-900">
              {progress.percentage}%
            </span>
            {/* Stage-specific details */}
            {progress.message && (
              <p className="text-sm text-gray-600 mt-1">{progress.message}</p>
            )}
            {progress.downloadSpeed && progress.eta && (
              <p className="text-xs text-gray-500 mt-1">
                {progress.downloadSpeed} • ETA: {progress.eta}
              </p>
            )}
            
            {/* Big repo prevention/error message */}
            {hasError && isPrevention && (
              <div className="mt-3 p-4 bg-orange-50 border border-orange-200 rounded-lg text-left">
                <p className="text-sm text-orange-800 font-medium mb-3">
                  🛡️ Analysis prevented to save GitHub tokens
                </p>
                <p className="text-xs text-orange-700 mb-4">
                  This repository is too large (&gt;50MB) for efficient analysis. To save your GitHub API tokens:
                </p>
                <div className="text-center">
                  <p className="text-sm text-orange-800 font-bold mb-3">
                    Use the Quick Analysis page instead
                  </p>
                  <button
                    onClick={() => {
                      const targetUrl = repoUrl || `https://github.com/${repositoryName}`
                      window.location.href = `/dashboard/enterprise-analysis?repo=${encodeURIComponent(targetUrl)}`
                    }}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🚀</span>
                    Go to Quick Analysis
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
            
            {hasError && !isPrevention && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  💡 Repository too large or complex?
                </p>
                <p className="text-xs text-blue-700 mb-2">
                  This repo might be too big or have analysis issues. For better results:
                </p>
                <p className="text-xs text-blue-600">
                  <strong>Use the Quick Analysis page</strong> to analyze critical issues and learn more about the repo.
                </p>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressBarColor()}`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
