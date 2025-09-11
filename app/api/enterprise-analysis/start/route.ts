import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'

// 🤖 AI POST-ANALYSIS FILTER - Remove false positives after Lambda analysis
async function performAIResultsFilter(originalResults: any[], transformedResults: any[]) {
  if (!process.env.OPENAI_API_KEY) {
    return transformedResults
  }
  
  // Group transformed results back by file for better AI context
  const fileGroups = new Map<string, any[]>()
  transformedResults.forEach(result => {
    if (!fileGroups.has(result.file)) {
      fileGroups.set(result.file, [])
    }
    fileGroups.get(result.file)!.push(result)
  })
  
  // Process files in batches of 3 for efficiency
  const batchSize = 3
  const fileNames = Array.from(fileGroups.keys())
  let filteredResults: any[] = []
  
  for (let i = 0; i < fileNames.length; i += batchSize) {
    const batch = fileNames.slice(i, i + batchSize)
    const batchResults = await processBatchAIFilter(batch, fileGroups, originalResults)
    filteredResults = filteredResults.concat(batchResults)
  }
  
  return filteredResults
}

// Process a batch of files with AI filtering
async function processBatchAIFilter(fileNames: string[], fileGroups: Map<string, any[]>, originalResults: any[]) {
  const totalIssues = fileNames.reduce((sum, fileName) => sum + fileGroups.get(fileName)!.length, 0)
  
  if (totalIssues === 0) {
    return []
  }
  
  // Create AI prompt for batch analysis
  const batchPrompt = `You are an expert code reviewer. Analyze these ${totalIssues} potential code issues across ${fileNames.length} files and identify which are REAL actionable problems vs false positives.

${fileNames.map((fileName, fileIndex) => {
  const issues = fileGroups.get(fileName)!
  return `FILE ${fileIndex}: ${fileName}
${issues.map((issue, issueIndex) => 
`[${fileIndex}.${issueIndex}] ${issue.severity.toUpperCase()}: ${issue.name}
Line ${issue.line}: ${issue.code}
Type: ${issue.type}
`).join('')}`
}).join('\n')}

For each issue, determine if it's:
- REAL: Actual problem that needs developer attention  
- FALSE_POSITIVE: Static analysis mistake (test files, mock data, comments, legitimate patterns)
- IGNORE: Too minor/context-dependent to be actionable

Consider:
1. Is this a genuine security/performance/logic issue?
2. Is the code pattern actually problematic in this context?
3. Would a developer realistically need to fix this?
4. Are there obvious false positives (test files, mock data, generated code)?
5. Is this issue in a test file, config file, or documentation?
6. **CRITICAL**: Is this a type definition, interface, or declare statement? (These should ALWAYS be ignored)
7. **CRITICAL**: Is this in flow-typed/ directory? (Pure type definitions - always ignore)
8. Is this just a function declaration being misclassified as a memory leak?
9. Is this a comment or documentation being analyzed as code?

Return ONLY a JSON object with file indices and issue indices to KEEP (real issues only):
{
  "0": [0, 2, 5],
  "1": [1, 3],
  "2": []
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: batchPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      })
    })
    
    if (!response.ok) {
      console.error(`❌ AI filter API error: ${response.status}`)
      return fileNames.flatMap(fileName => fileGroups.get(fileName)!)
    }
    
    const data = await response.json()
    const aiResponse = data.choices[0].message.content.trim()
    
    // Parse AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const keepMap = JSON.parse(jsonMatch[0])
      
      // Filter issues based on AI recommendations
      let filteredBatch: any[] = []
      
      fileNames.forEach((fileName, fileIndex) => {
        const issues = fileGroups.get(fileName)!
        const indicesToKeep = keepMap[fileIndex.toString()] || []
        const filteredIssues = issues.filter((_, issueIndex) => 
          indicesToKeep.includes(issueIndex)
        )
        filteredBatch = filteredBatch.concat(filteredIssues)
      })
      
      return filteredBatch
      
    } else {
      console.warn('⚠️ Could not parse AI batch response, keeping all issues')
      return fileNames.flatMap(fileName => fileGroups.get(fileName)!)
    }
    
  } catch (error) {
    console.error(`❌ AI batch processing failed:`, error)
    return fileNames.flatMap(fileName => fileGroups.get(fileName)!)
  }
}

export async function POST(request: NextRequest) {
  console.log('🎯 ENTERPRISE ROUTE CALLED!')
  
  try {
    const body = await request.json()
    const { owner, repo, batchNumber, fullRepoAnalysis, regexOnly } = body
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo are required' },
        { status: 400 }
      )
    }
    
    console.log(`📋 Starting ${batchNumber ? `FILE BATCH ${batchNumber}` : 'FULL'} analysis for ${owner}/${repo}`)
    
    // Generate unique analysis ID
    const analysisId = uuid()
    
    // Call Lambda function with file-based batching support
    const lambdaUrl = 'https://zhs2iniuc3.execute-api.us-east-2.amazonaws.com/default/enterprise-code-analyzer'
    const repoUrl = `https://github.com/${owner}/${repo}.git`
    
    console.log('🚀 Calling Lambda with file batching:', lambdaUrl)
    console.log('📦 Payload:', { repoUrl, analysisId, batchNumber, fullRepoAnalysis, regexOnly })
    
    try {
      const response = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, analysisId, batchNumber, fullRepoAnalysis, regexOnly })
      })
      
      console.log(`📡 Lambda response status: ${response.status}`)
      
      if (!response.ok) {
        throw new Error(`Lambda returned ${response.status}: ${response.statusText}`)
      }
      
      const responseText = await response.text()
      console.log('📄 Lambda raw response:', responseText.substring(0, 500) + '...')
      
      let data
      try {
        data = JSON.parse(responseText)
        console.log('✅ Lambda JSON response:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse Lambda response:', parseError)
        return NextResponse.json({
          success: false,
          error: 'Lambda returned invalid JSON',
          analysisId,
          rawResponse: responseText.substring(0, 200)
        })
      }
      
      // Return Lambda results DIRECTLY
      if (data.success && data.results) {
        console.log(`🎉 SUCCESS! Lambda returned ${data.results.length} files with issues`)
        

        
        // Transform Lambda results to frontend format
        const transformedResults: any[] = []
        data.results.forEach((fileResult: any) => {
          fileResult.issues.forEach((issue: any) => {
            transformedResults.push({
              type: issue.type,
              name: issue.message,
              file: fileResult.file,
              line: issue.line,
              code: issue.code,
              severity: issue.severity, // ✅ Pass through severity for proper frontend categorization
              description: `${issue.severity.toUpperCase()}: ${issue.message}`
            })
          })
        })
        
        console.log(`🔄 Transformed to ${transformedResults.length} individual results`)
        
        // 🤖 AI POST-ANALYSIS FILTERING - Remove false positives just before displaying
        let finalResults = transformedResults
        let aiFilterStats = { enabled: false, removed: 0 }
        
        if (process.env.OPENAI_API_KEY && transformedResults.length > 0) {
          console.log(`🤖 Running AI post-analysis filter on ${transformedResults.length} issues...`)
          
          try {
            const aiFilteredResults = await performAIResultsFilter(data.results, transformedResults)
            aiFilterStats = {
              enabled: true,
              removed: transformedResults.length - aiFilteredResults.length
            }
            finalResults = aiFilteredResults
            
            console.log(`✅ AI filter complete: ${transformedResults.length} → ${finalResults.length} issues (removed ${aiFilterStats.removed} false positives)`)
          } catch (aiError) {
            console.error('❌ AI filtering failed:', aiError)
            console.log('⚠️ Returning original results without AI filtering')
          }
        } else {
          console.log('⚠️ Skipping AI filter: No API key or no results')
        }
        
        return NextResponse.json({
          success: true,
          analysisId,
          results: finalResults,
          message: `✅ Real Lambda analysis: ${finalResults.length} issues found in ${data.results.length} files${aiFilterStats.enabled ? ` (AI filtered)` : ''}`,
          status: 'completed',
          isLastBatch: data.isLastBatch, // CRITICAL: Pass isLastBatch from Lambda
          aiFilter: aiFilterStats
        })
      } else {
        console.log('⚠️ Lambda response missing success/results:', data)
        return NextResponse.json({
          success: false,
          error: 'Lambda returned no results',
          analysisId,
          lambdaResponse: data,
          isLastBatch: data.isLastBatch // Pass isLastBatch even on failure
        })
      }
      
    } catch (lambdaError) {
      console.error('❌ Lambda call failed:', lambdaError)
      return NextResponse.json({
        success: false,
        error: `Lambda error: ${lambdaError instanceof Error ? lambdaError.message : 'Unknown error'}`,
        analysisId,
        isLastBatch: false // Assume not last batch on error
      })
    }
    
  } catch (error) {
    console.error('❌ Analysis error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLastBatch: false
      },
      { status: 500 }
    )
  }
}