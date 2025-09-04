import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for batch results per repository
// In production, you'd use Redis or a database
const repositoryContexts = new Map<string, {
  batches: any[],
  summary: string,
  totalIssues: number,
  lastUpdated: Date
}>()

export async function POST(request: NextRequest) {
  try {
    const { repository, batchNumber, batchResults, isLastBatch } = await request.json()
    
    if (!repository || !batchNumber || !batchResults) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`📤 Updating chat context for ${repository} batch ${batchNumber} with ${batchResults.length} results`)

    // Get or create repository context
    let context = repositoryContexts.get(repository)
    if (!context) {
      context = {
        batches: [],
        summary: '',
        totalIssues: 0,
        lastUpdated: new Date()
      }
    }

    // Add this batch to context
    context.batches.push({
      batchNumber,
      results: batchResults,
      timestamp: new Date()
    })
    
    context.totalIssues += batchResults.length
    context.lastUpdated = new Date()

    // Create summary for chat context (limit to key insights)
    const allIssues = context.batches.flatMap(batch => batch.results)
    const highPriorityIssues = allIssues.filter(issue => 
      issue.description?.includes('HIGH:') || 
      issue.type === 'security'
    ).slice(0, 20) // Top 20 critical issues

    const mediumPriorityIssues = allIssues.filter(issue => 
      issue.description?.includes('MEDIUM:') || 
      issue.type === 'performance'
    ).slice(0, 15) // Top 15 medium issues

    context.summary = `Repository Analysis Summary for ${repository}:
- Total Issues: ${context.totalIssues}
- Batches Processed: ${context.batches.length}
- Critical Security/High Priority Issues: ${highPriorityIssues.length}
- Performance/Medium Issues: ${mediumPriorityIssues.length}

Top Critical Issues:
${highPriorityIssues.map(issue => `• ${issue.file}:${issue.line} - ${issue.type}: ${issue.name}`).join('\n')}

Top Performance Issues:
${mediumPriorityIssues.map(issue => `• ${issue.file}:${issue.line} - ${issue.type}: ${issue.name}`).join('\n')}

Analysis Status: ${isLastBatch ? 'COMPLETE' : `IN PROGRESS (batch ${batchNumber})`}`

    // Store updated context
    repositoryContexts.set(repository, context)

    console.log(`✅ Chat context updated for ${repository}: ${context.totalIssues} total issues across ${context.batches.length} batches`)

    return NextResponse.json({
      success: true,
      message: `Context updated for batch ${batchNumber}`,
      totalIssues: context.totalIssues,
      batchesProcessed: context.batches.length
    })

  } catch (error) {
    console.error('❌ Failed to update chat context:', error)
    return NextResponse.json(
      { error: 'Failed to update chat context' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve current context
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const repository = url.searchParams.get('repository')
    
    if (!repository) {
      return NextResponse.json({ error: 'Repository parameter required' }, { status: 400 })
    }

    const context = repositoryContexts.get(repository)
    
    if (!context) {
      return NextResponse.json({
        success: true,
        summary: `No analysis context found for ${repository}`,
        totalIssues: 0,
        batches: []
      })
    }

    return NextResponse.json({
      success: true,
      summary: context.summary,
      totalIssues: context.totalIssues,
      batchesProcessed: context.batches.length,
      lastUpdated: context.lastUpdated
    })

  } catch (error) {
    console.error('❌ Failed to get chat context:', error)
    return NextResponse.json(
      { error: 'Failed to get chat context' },
      { status: 500 }
    )
  }
}
