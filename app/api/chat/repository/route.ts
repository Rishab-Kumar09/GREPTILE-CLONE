import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

interface AnalysisResult {
  file: string
  bugs: Array<{
    line: number
    severity: string
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  suggestions: Array<{
    line: number
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  codeSmells: Array<{
    line: number
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Chat API called')
    const body = await request.json()
    console.log('📋 Request body keys:', Object.keys(body))
    
    const { message, repository, chatHistory } = body
    const history = chatHistory || []
    
    console.log('📝 Message:', message)
    console.log('📂 Repository:', repository)
    console.log('💬 Chat history length:', history.length)
    
    if (!openai) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, { status: 500 })
    }

    if (!message || !repository) {
      return NextResponse.json({
        success: false,
        error: 'Message and repository are required'
      }, { status: 400 })
    }

    // Get stored analysis context from batch updates
    console.log('📤 Fetching stored analysis context...')
    let codeContext = ''
    let availableFiles: string[] = []
    
    try {
      const contextResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/chat/batch-update?repository=${encodeURIComponent(repository)}`)
      const contextData = await contextResponse.json()
      
      if (contextData.success && contextData.summary) {
        codeContext = contextData.summary
        console.log('✅ Retrieved stored analysis context:', contextData.totalIssues, 'total issues')
      } else {
        console.log('⚠️ No stored context found, using fallback')
        codeContext = `No analysis context available for ${repository}. Please run analysis first.`
      }
    } catch (contextError) {
      console.warn('⚠️ Failed to fetch stored context:', contextError)
      codeContext = `Analysis context temporarily unavailable for ${repository}.`
    }

    // Create AI prompt with context
    const systemPrompt = `You are a SENIOR CODE REVIEWER and EXPERT DEVELOPER for the repository "${repository}". 

You have COMPLETE ACCESS to the actual code analysis results with specific bugs, security issues, and code smells found in this repository.

YOUR ROLE:
- Provide SPECIFIC, ACTIONABLE solutions based on the ACTUAL analysis results below
- Give EXACT code fixes with line-by-line replacements
- Reference the SPECIFIC issues found in the analysis
- DO NOT give general advice - be repository-specific and issue-specific
- When asked about errors, list the ACTUAL bugs, security issues, and code smells from the analysis

ACTUAL ANALYSIS RESULTS FOR ${repository}:
${codeContext}

CRITICAL: The analysis results above contain the REAL issues found in this repository. Use ONLY these specific issues in your responses. Do not make up or assume other issues.

RESPONSE FORMAT:
1. Always cite EXACT files and line numbers: [filename.ext:line_number]
2. Show the PROBLEMATIC code in the current analysis
3. Provide EXACT replacement code
4. Explain WHY this fix solves the specific issue found

DO NOT:
- Give general programming tips
- Suggest things not related to the actual analysis results
- Provide vague advice

DO:
- Reference specific bugs/issues from the analysis above
- Provide exact code replacements for the problematic lines
- Explain how your solution fixes the specific issue found
- Use the actual file names and line numbers from the analysis

Be a SENIOR DEVELOPER who provides EXACT SOLUTIONS to the SPECIFIC PROBLEMS found in this repository's analysis.`

    // Build conversation history
    const conversationMessages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
      {
        role: "system" as const,
        content: systemPrompt
      }
    ]

    // Add previous chat history for context (last 25 messages)
    if (history && history.length > 0) {
      history.forEach((msg: any) => {
        conversationMessages.push({
          role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content
        })
      })
    }

    // Add current message
    conversationMessages.push({
      role: "user" as const,
      content: message
    })

    console.log('💬 Conversation with', conversationMessages.length, 'messages (including', history.length, 'history messages)')
    console.log('🔍 Code context length:', codeContext.length, 'characters')
    console.log('🔍 Available files:', availableFiles.length, 'files')

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1000,
    })
    
    console.log('✅ OpenAI response received')

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not generate a response.'

    // Extract citations from the response (simplified without code snippets for now)
    const citations: Array<{file: string, line?: number, snippet?: string}> = []
    
    const citationRegex = /\[([^\]]+\.[a-zA-Z]+)(?::(\d+))?\]/g
    let match

    while ((match = citationRegex.exec(aiResponse)) !== null) {
      const file = match[1]
      const line = match[2] ? parseInt(match[2]) : undefined
      
      citations.push({ file, line, snippet: undefined })
    }

    // Remove duplicate citations
    const uniqueCitations = citations.filter((citation, index, self) =>
      index === self.findIndex(c => c.file === citation.file && c.line === citation.line)
    )

    return NextResponse.json({
      success: true,
      response: aiResponse,
      citations: uniqueCitations,
      repository
    })

  } catch (error) {
    console.error('❌ Chat API error:', error)
    console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error')
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: `Failed to process chat message: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 })
  }
} 