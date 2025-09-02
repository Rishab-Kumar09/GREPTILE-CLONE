interface AnalysisProgressProps {
  status: string
  progress: number
}

export function AnalysisProgress({ status, progress }: AnalysisProgressProps) {
  // Simple status messages without file counts
  const getMessage = (status: string) => {
    switch (status) {
      case 'analyzing':
        return '🔍 Analyzing repository...'
      case 'completed':
        return '✅ Analysis complete!'
      case 'failed':
        return '❌ Analysis failed'
      default:
        return '⏳ Starting analysis...'
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium">
          {getMessage(status)}
        </h3>
      </div>
      
      {/* Simple progress bar using div */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Show percentage */}
      <p className="text-sm text-gray-500 mt-2">
        {Math.round(progress)}% complete
      </p>
    </div>
  )
}