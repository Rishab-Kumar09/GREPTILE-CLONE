'use client'

import React, { useEffect } from 'react'

interface AnalysisProgressModalProps {
  isOpen: boolean
  onClose: () => void
  repositoryName: string
  progress: {
    percentage: number
  }
  isComplete: boolean
  hasError: boolean
}

export default function AnalysisProgressModal({
  isOpen,
  onClose,
  repositoryName,
  progress,
  isComplete,
  hasError
}: AnalysisProgressModalProps) {
  // Auto-close when analysis is complete
  useEffect(() => {
    if (isComplete && !hasError) {
      const timer = setTimeout(() => {
        onClose()
      }, 1500) // Show success state for 1.5 seconds
      return () => clearTimeout(timer)
    }
  }, [isComplete, hasError, onClose])

  if (!isOpen) return null

  // Determine progress bar color - Green throughout like big companies!
  const getProgressBarColor = () => {
    if (hasError) return 'bg-red-500'
    return 'bg-green-500' // Green throughout the process, just like YouTube, Netflix, etc.
  }

  // Determine status text
  const getStatusText = () => {
    if (hasError) return 'Analysis failed'
    if (isComplete) return 'Analysis complete!'
    return 'Analyzing repository...'
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {getStatusText()}
          </h3>
          <p className="text-gray-500 text-sm mt-1 truncate">{repositoryName}</p>
        </div>

        {/* Progress Content */}
        <div className="px-6 pb-6">
          {/* Progress Percentage */}
          <div className="text-center mb-4">
            <span className="text-2xl font-bold text-gray-900">
              {progress.percentage}%
            </span>
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
