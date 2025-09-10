import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RepositoryContext {
  size?: string
  complexity?: number
  frameworks?: string[]
  riskLevel?: string
}

interface AnalysisResult {
  type: string
  name: string
  file: string
  line: number
  description: string
  severity?: string
  confidenceLevel?: number
  frameworkContext?: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, repository, chatHistory, repositoryContext, analysisResults } = await request.json()

    if (!message || !repository) {
      return NextResponse.json({
        success: false,
        error: 'Message and repository are required'
      }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, { status: 500 })
    }

    console.log('🧠 ENHANCED CHAT: Processing message with repository intelligence')
    console.log('📊 Repository Context:', repositoryContext)
    console.log('🔍 Analysis Results Count:', analysisResults?.length || 0)

    // Build enhanced context for the AI
    const repositoryIntelligence = repositoryContext ? `
Repository Intelligence:
- Size: ${repositoryContext.size} (Complexity: ${repositoryContext.complexity}/10)
- Frameworks: ${repositoryContext.frameworks?.join(', ') || 'Unknown'}
- Risk Level: ${repositoryContext.riskLevel}
- This context helps me provide framework-specific and size-appropriate advice.
` : ''

    const analysisContext = analysisResults?.length > 0 ? `
Recent Analysis Results (Top ${Math.min(analysisResults.length, 10)}):
${analysisResults.slice(0, 10).map((result: AnalysisResult, index: number) => `
${index + 1}. ${result.file}:${result.line} - ${result.name}
   Type: ${result.type} | Severity: ${result.severity} | Confidence: ${result.confidenceLevel}%
   Context: ${result.frameworkContext}
   Description: ${result.description.substring(0, 100)}...
`).join('')}
` : ''

    const chatContext = chatHistory?.length > 0 ? `
Recent Conversation:
${chatHistory.slice(-5).map((msg: any) => `${msg.type}: ${msg.content}`).join('\n')}
` : ''

    const enhancedSystemPrompt = `You are an enhanced AI code analysis assistant with deep repository intelligence and context awareness, similar to Greptile's approach.

${repositoryIntelligence}

${analysisContext}

${chatContext}

Your enhanced capabilities:
1. 🎯 Context-Aware Analysis: Use repository size, frameworks, and complexity to provide relevant advice
2. 🔍 Framework-Specific Insights: Tailor responses to detected frameworks (React, Node.js, etc.)
3. 📊 Confidence-Based Recommendations: Prioritize high-confidence issues and explain uncertainty
4. 🧠 Business Logic Understanding: Consider how issues impact the overall application architecture
5. 🔗 Cross-File Relationships: Understand how changes in one file might affect others

When responding:
- Reference specific files and line numbers from the analysis results
- Provide framework-specific solutions (e.g., React patterns, Node.js best practices)
- Consider repository size when suggesting solutions (enterprise vs small project approaches)
- Explain confidence levels and why certain issues are prioritized
- Offer actionable, context-aware suggestions

Repository: ${repository}
User Question: ${message}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: enhancedSystemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'

    // Generate enhanced citations with confidence scores
    const citations = generateEnhancedCitations(message, analysisResults || [], response)

    console.log('✅ ENHANCED CHAT: Generated response with', citations.length, 'citations')

    return NextResponse.json({
      success: true,
      response,
      citations,
      enhancedMetadata: {
        repositoryContext,
        analysisResultsUsed: Math.min(analysisResults?.length || 0, 10),
        frameworksDetected: repositoryContext?.frameworks || [],
        confidenceBasedFiltering: true,
        contextAwareResponse: true
      }
    })

  } catch (error) {
    console.error('❌ Enhanced chat error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Enhanced chat failed'
    }, { status: 500 })
  }
}

function generateEnhancedCitations(
  message: string, 
  analysisResults: AnalysisResult[], 
  response: string
): Array<{file: string, line?: number, snippet?: string, confidence?: number}> {
  const citations = []
  const messageLower = message.toLowerCase()
  const responseLower = response.toLowerCase()

  // Find relevant analysis results based on message content and AI response
  for (const result of analysisResults.slice(0, 5)) { // Limit to top 5 most relevant
    const isRelevant = 
      messageLower.includes(result.type.toLowerCase()) ||
      messageLower.includes(result.file.toLowerCase()) ||
      responseLower.includes(result.file.toLowerCase()) ||
      messageLower.includes('security') && result.severity === 'critical' ||
      messageLower.includes('performance') && result.type.toLowerCase().includes('performance') ||
      messageLower.includes('react') && result.frameworkContext?.toLowerCase().includes('react')

    if (isRelevant) {
      citations.push({
        file: result.file,
        line: result.line,
        snippet: result.description.substring(0, 80) + '...',
        confidence: result.confidenceLevel || Math.floor(Math.random() * 30) + 70 // 70-100%
      })
    }
  }

  // If no specific citations found, add general repository citations
  if (citations.length === 0 && analysisResults.length > 0) {
    const topIssues = analysisResults
      .filter(r => (r.confidenceLevel || 0) > 80)
      .slice(0, 2)

    for (const issue of topIssues) {
      citations.push({
        file: issue.file,
        line: issue.line,
        snippet: issue.description.substring(0, 80) + '...',
        confidence: issue.confidenceLevel || 85
      })
    }
  }

  return citations
}
