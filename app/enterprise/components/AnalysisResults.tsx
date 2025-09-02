interface AnalysisResultsProps {
  results: any[]
  status: string
}

export function AnalysisResults({ results, status }: AnalysisResultsProps) {
  // Only show results when complete
  if (status !== 'completed' || !results.length) {
    return null
  }

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Analysis Results</h2>
      
      {Object.entries(groupedResults).map(([type, typeResults]) => (
        <div key={type} className="mb-8">
          <h3 className="text-xl font-semibold mb-4 capitalize">
            {type} ({typeResults.length})
          </h3>
          
          <div className="space-y-4">
            {typeResults.map((result, index) => (
              <div 
                key={index}
                className="p-4 bg-white rounded-lg shadow"
              >
                <div className="font-mono text-sm mb-2">
                  {result.match}
                </div>
                <div className="text-sm text-gray-500">
                  Pattern: {result.pattern}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
