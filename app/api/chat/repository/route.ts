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
    
    const { message, repository, analysisResults, chatHistory } = body
    const history = chatHistory || []
    
    console.log('📝 Message:', message)
    console.log('📂 Repository:', repository)
    console.log('📊 Has analysisResults:', !!analysisResults)
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

    // Build context from analysis results
    let codeContext = ''
    let availableFiles: string[] = []
    
    console.log('🔍 DEBUG: Received analysisResults:', JSON.stringify(analysisResults, null, 2))
    
    if (analysisResults && analysisResults.allResults) {
      console.log('✅ Found analysisResults.allResults with', analysisResults.allResults.length, 'files')
      codeContext = 'Available code analysis summary:\n\n'
      
      // LIMIT TO FIRST 20 FILES to avoid token limit
      const limitedResults = analysisResults.allResults.slice(0, 20)
      console.log('📊 Limited to', limitedResults.length, 'files to avoid token limit')
      
      limitedResults.forEach((result: AnalysisResult) => {
        availableFiles.push(result.file)
        codeContext += `File: ${result.file}\n`
        
        // Add only HIGH PRIORITY bugs (limit to 3 per file)
        if (result.bugs && result.bugs.length > 0) {
          codeContext += `Bugs (${result.bugs.length} total):\n`
          result.bugs.slice(0, 3).forEach(bug => {
            codeContext += `- Line ${bug.line}: ${bug.type} - ${bug.description}\n`
            // Skip code snippets to save tokens
          })
          if (result.bugs.length > 3) {
            codeContext += `... and ${result.bugs.length - 3} more bugs\n`
          }
        }
        
        // Add only top suggestions (limit to 2 per file)
        if (result.suggestions && result.suggestions.length > 0) {
          codeContext += `Suggestions (${result.suggestions.length} total):\n`
          result.suggestions.slice(0, 2).forEach(suggestion => {
            codeContext += `- Line ${suggestion.line}: ${suggestion.type}\n`
          })
          if (result.suggestions.length > 2) {
            codeContext += `... and ${result.suggestions.length - 2} more suggestions\n`
          }
        }
        
        // Add only top code smells (limit to 2 per file)
        if (result.codeSmells && result.codeSmells.length > 0) {
          codeContext += `Code Smells (${result.codeSmells.length} total):\n`
          result.codeSmells.slice(0, 2).forEach(smell => {
            codeContext += `- Line ${smell.line}: ${smell.type}\n`
          })
          if (result.codeSmells.length > 2) {
            codeContext += `... and ${result.codeSmells.length - 2} more code smells\n`
          }
        }
        
        codeContext += '\n'
      })
      
      // Add summary stats
      const totalFiles = analysisResults.allResults.length
      const totalBugs = analysisResults.allResults.reduce((sum: number, r: any) => sum + (r.bugs?.length || 0), 0)
      const totalSuggestions = analysisResults.allResults.reduce((sum: number, r: any) => sum + (r.suggestions?.length || 0), 0)
      const totalSmells = analysisResults.allResults.reduce((sum: number, r: any) => sum + (r.codeSmells?.length || 0), 0)
      
      codeContext += `\nOVERALL SUMMARY:\n`
      codeContext += `- Total files analyzed: ${totalFiles}\n`
      codeContext += `- Total bugs found: ${totalBugs}\n`
      codeContext += `- Total suggestions: ${totalSuggestions}\n`
      codeContext += `- Total code smells: ${totalSmells}\n`
      codeContext += `(Showing details for first ${limitedResults.length} files due to length constraints)\n\n`
    } else {
      console.log('❌ No analysisResults.allResults found')
      codeContext = `No analysis results available for ${repository}. Please run analysis first.`
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

Available files with issues: ${availableFiles.join(', ')}

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

    // Extract citations from the response
    const citations: Array<{file: string, line?: number, snippet?: string}> = []
    
    const citationRegex = /\[([^\]]+\.[a-zA-Z]+)(?::(\d+))?\]/g
    let match

    while ((match = citationRegex.exec(aiResponse)) !== null) {
      const file = match[1]
      const line = match[2] ? parseInt(match[2]) : undefined
      
      // Try to find the code snippet for this citation
      let snippet = undefined
      if (line && analysisResults?.allResults) {
        const fileResult = analysisResults.allResults.find((r: AnalysisResult) => r.file === file)
        if (fileResult) {
          // Look for the snippet in bugs, security issues, or code smells
          const allIssues = [
            ...(fileResult.bugs || []),
            ...(fileResult.suggestions || []),
            ...(fileResult.codeSmells || [])
          ]
          const issueWithSnippet = allIssues.find(issue => issue.line === line && issue.codeSnippet)
          if (issueWithSnippet) {
            snippet = issueWithSnippet.codeSnippet
          }
        }
      }
      
      citations.push({ file, line, snippet })
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