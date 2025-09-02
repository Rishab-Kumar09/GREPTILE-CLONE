interface LiveProgressProps {
  status: string
  progress: number
  currentFile: string
}

export function LiveProgress({ status, progress, currentFile }: LiveProgressProps) {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">🔍 Analysis Progress</h2>
      
      {/* Simple progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status message - NO COUNTS! */}
      <p className="text-sm text-gray-600">
        {progress === 100 ? '✅ Analysis complete!' : '🔍 Analysis in progress...'}
      </p>
    </div>
  )
}
