'use client'

import Link from 'next/link'

export default function TriggerSetup() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Greptile Clone</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">GitHub</span>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-green-600">Connect GitHub</span>
            </div>
            <div className="flex-1 h-0.5 mx-4 bg-green-600"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-green-600">Select Repositories</span>
            </div>
            <div className="flex-1 h-0.5 mx-4 bg-green-600"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-green-600">Configure PR Summary</span>
            </div>
            <div className="flex-1 h-0.5 mx-4 bg-gray-200"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Control Review Behavior</span>
            </div>
            <div className="flex-1 h-0.5 mx-4 bg-gray-200"></div>
            
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
                5
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Add Filtering</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <span className="text-4xl">@</span>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Need a Fresh Review? Just Comment @greptile.
          </h1>
          
          <p className="text-lg text-gray-600 mb-12">
            Comment @greptile in any PR comment to instantly retrigger a review.
          </p>

          {/* Greptile Logo Pattern */}
          <div className="space-y-4 mb-12">
            <div className="text-6xl font-bold text-green-500 opacity-80">@greptile</div>
            <div className="text-6xl font-bold text-green-400 opacity-60">@greptile</div>
            <div className="text-6xl font-bold text-green-300 opacity-40">@greptile</div>
            <div className="text-6xl font-bold text-green-200 opacity-20">@greptile</div>
          </div>

          <div className="flex space-x-4">
            <Link 
              href="/setup"
              className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Back
            </Link>
            <Link 
              href="/setup/behavior"
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Got It!
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 