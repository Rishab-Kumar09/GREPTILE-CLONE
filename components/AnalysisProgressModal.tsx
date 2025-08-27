'use client'

import React from 'react'
import { X, FileText, Bug, Shield, AlertTriangle, Clock } from 'lucide-react'

interface AnalysisProgressModalProps {
  isOpen: boolean
  onClose: () => void
  repositoryName: string
  progress: {
    percentage: number
    filesProcessed: number
    totalFiles: number
    currentBatch: number
    totalBatches: number
    estimatedTimeRemaining?: number
  }
  stats: {
    bugs: number
    security: number
    codeSmells: number
  }
  currentFile?: string
  isComplete: boolean
}

export default function AnalysisProgressModal({
  isOpen,
  onClose,
  repositoryName,
  progress,
  stats,
  currentFile,
  isComplete
}: AnalysisProgressModalProps) {
  if (!isOpen) return null

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors"
            disabled={!isComplete}
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold pr-8">
            {isComplete ? '✅ Analysis Complete!' : '🔍 Analyzing Repository'}
          </h3>
          <p className="text-blue-100 text-sm mt-1 truncate">{repositoryName}</p>
        </div>

        {/* Progress Content */}
        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Progress: {progress.percentage}%
              </span>
              <span className="text-sm text-gray-500">
                {progress.filesProcessed}/{progress.totalFiles} files
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${progress.percentage}%` }}
              >
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Batch Progress */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              Batch {progress.currentBatch}/{progress.totalBatches}
            </span>
            {progress.estimatedTimeRemaining && !isComplete && (
              <span className="text-gray-500 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                ~{formatTime(progress.estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>

          {/* Current File */}
          {currentFile && !isComplete && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">Analyzing:</span>
              </div>
              <p className="text-xs text-gray-700 mt-1 font-mono truncate">
                {currentFile}
              </p>
            </div>
          )}

          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <Bug className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-red-600">{stats.bugs}</div>
              <div className="text-xs text-red-500">Bugs</div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <Shield className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-orange-600">{stats.security}</div>
              <div className="text-xs text-orange-500">Security</div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <div className="text-lg font-bold text-yellow-600">{stats.codeSmells}</div>
              <div className="text-xs text-yellow-500">Code Smells</div>
            </div>
          </div>

          {/* Status Messages */}
          <div className="text-center">
            {isComplete ? (
              <div className="space-y-2">
                <div className="text-green-600 font-medium">
                  🎉 Analysis completed successfully!
                </div>
                <div className="text-sm text-gray-500">
                  Found {stats.bugs + stats.security + stats.codeSmells} total issues
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-blue-600 font-medium">
                  🔍 Deep code analysis in progress...
                </div>
                <div className="text-sm text-gray-500">
                  Using AI to detect bugs, security issues, and code smells
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          {isComplete && (
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
