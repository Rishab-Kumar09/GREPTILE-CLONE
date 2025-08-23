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
  securityIssues: Array<{
    line: number
    severity: string
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
    const { message, repository, analysisResults } = await request.json()
    
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
    
    if (analysisResults && analysisResults.allResults) {
      codeContext = 'Available code analysis:\n\n'
      
      analysisResults.allResults.forEach((result: AnalysisResult) => {
        availableFiles.push(result.file)
        codeContext += `File: ${result.file}\n`
        
        // Add bugs with code snippets
        if (result.bugs && result.bugs.length > 0) {
          codeContext += `Bugs found:\n`
          result.bugs.forEach(bug => {
            codeContext += `- Line ${bug.line}: ${bug.type} - ${bug.description}\n`
            if (bug.codeSnippet) {
              codeContext += `  Code: ${bug.codeSnippet}\n`
            }
          })
        }
        
        // Add security issues with code snippets
        if (result.securityIssues && result.securityIssues.length > 0) {
          codeContext += `Security Issues:\n`
          result.securityIssues.forEach(issue => {
            codeContext += `- Line ${issue.line}: ${issue.type} - ${issue.description}\n`
            if (issue.codeSnippet) {
              codeContext += `  Code: ${issue.codeSnippet}\n`
            }
          })
        }
        
        // Add code smells with code snippets
        if (result.codeSmells && result.codeSmells.length > 0) {
          codeContext += `Code Smells:\n`
          result.codeSmells.forEach(smell => {
            codeContext += `- Line ${smell.line}: ${smell.type} - ${smell.description}\n`
            if (smell.codeSnippet) {
              codeContext += `  Code: ${smell.codeSnippet}\n`
            }
          })
        }
        
        codeContext += '\n'
      })
    }

    // Create AI prompt with context
    const systemPrompt = `You are a SENIOR CODE REVIEWER and EXPERT DEVELOPER for the repository "${repository}". 

You have COMPLETE ACCESS to the actual code analysis results with specific bugs, security issues, and code smells found in this repository.

🎯 YOUR ROLE:
- Provide SPECIFIC, ACTIONABLE solutions based on the ACTUAL analysis results above
- Give EXACT code fixes with line-by-line replacements
- Reference the SPECIFIC issues found in the analysis
- DO NOT give general advice - be repository-specific and issue-specific

📋 ANALYSIS RESULTS AVAILABLE:
${codeContext}

🔧 RESPONSE FORMAT:
1. Always cite EXACT files and line numbers: [filename.ext:line_number]
2. Show the PROBLEMATIC code in the current analysis
3. Provide EXACT replacement code
4. Explain WHY this fix solves the specific issue found

❌ DO NOT:
- Give general programming tips
- Suggest things not related to the actual analysis results
- Provide vague advice

✅ DO:
- Reference specific bugs/issues from the analysis above
- Provide exact code replacements for the problematic lines
- Explain how your solution fixes the specific issue found
- Use the actual file names and line numbers from the analysis

Available files with issues: ${availableFiles.join(', ')}

Be a SENIOR DEVELOPER who provides EXACT SOLUTIONS to the SPECIFIC PROBLEMS found in this repository's analysis.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    const aiResponse = completion.choices[0].message.content || 'Sorry, I could not generate a response.'

    // Extract citations from the response
    const citations: Array<{file: string, line?: number, snippet?: string}> = []
    
    // Look for file references [filename.ext] or [filename.ext:line]
    const citationRegex = /\[([^\]]+\.[a-zA-Z]+)(?::(\d+))?\]/g
    let match
    
    while ((match = citationRegex.exec(aiResponse)) !== null) {
      const file = match[1]
      const line = match[2] ? parseInt(match[2]) : undefined
      
      // Find the code snippet if line number is provided
      let snippet = undefined
      if (line && analysisResults?.allResults) {
        const fileResult = analysisResults.allResults.find((r: AnalysisResult) => r.file === file)
        if (fileResult) {
          // Look for code snippet in bugs, security issues, or code smells
          const allIssues = [
            ...(fileResult.bugs || []),
            ...(fileResult.securityIssues || []),
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

    // Remove duplicates
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
    console.error('Chat API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process chat message'
    }, { status: 500 })
  }
} 