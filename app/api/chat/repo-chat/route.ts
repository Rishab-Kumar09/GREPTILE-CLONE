import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { message, tempDir, repository, analysisResults } = await request.json()
    
    if (!message || !tempDir || !repository || !analysisResults) {
      return NextResponse.json({ error: 'message, tempDir, repository and analysisResults are required' }, { status: 400 })
    }
    
    console.log(`🤖 Chat request for ${repository} using files in ${tempDir}`)
    
    // Check if directory exists
    if (!fs.existsSync(tempDir)) {
      return NextResponse.json({ 
        error: 'Repository files not found. Please run analysis first.',
        contextAvailable: false
      }, { status: 404 })
    }
    
    // Build context from files and analysis results
    const context = {
      ...(await buildRepoContext(tempDir)),
      analysisResults
    }
    console.log(`📊 Built context from ${context.files.length} files and ${context.analysisResults.totalIssues} issues`)
    
    // Generate response
    const response = await generateResponse(message, context)
    
    return NextResponse.json({ 
      success: true,
      response: response.content,
      citations: response.citations
    })
    
  } catch (error) {
    console.error('❌ Chat error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

async function buildRepoContext(dir: string) {
  const files: Array<{path: string, content: string}> = []
  
  // Recursively read all files
  function readFilesRecursively(currentPath: string) {
    const items = fs.readdirSync(currentPath)
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        // Skip node_modules and .git
        if (item !== 'node_modules' && item !== '.git') {
          readFilesRecursively(fullPath)
        }
      } else {
        // Only include code files
        const ext = path.extname(item).toLowerCase()
        if (['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.java', '.go', '.rs', '.php'].includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf8')
          const relativePath = path.relative(dir, fullPath)
          files.push({
            path: relativePath,
            content: content
          })
        }
      }
    }
  }
  
  readFilesRecursively(dir)
  return { files }
}

async function generateResponse(message: string, context: { 
  files: Array<{path: string, content: string}>,
  analysisResults: {
    totalIssues: number,
    criticalIssues: number,
    categories: string[],
    issues: Array<{
      severity?: string,
      type: string,
      file: string,
      line: number,
      description: string
    }>
  }
}) {
  // Build system prompt
  const systemPrompt = `You are an expert code analyst with complete knowledge of the repository.
You have access to all files in the repository AND the analysis results. 

ANALYSIS RESULTS:
- Total Issues: ${context.analysisResults.totalIssues}
- Critical Issues: ${context.analysisResults.criticalIssues}
- Categories: ${context.analysisResults.categories.join(', ')}

DETECTED ISSUES:
${context.analysisResults.issues.map(issue => 
  `- ${issue.severity?.toUpperCase() || 'INFO'}: ${issue.type} in ${issue.file}:${issue.line}\n  ${issue.description}`
).join('\\n')}

You can provide expert, contextual responses about:
- Code architecture and patterns
- Function implementations and usage
- File relationships and dependencies
- Potential improvements and suggestions
- Bug analysis and solutions
- Feature implementation guidance

Always cite specific files and code sections when relevant. Be precise and actionable.
When discussing issues, reference the specific line numbers and files from the analysis.

Available files:
${context.files.map(f => f.path).join('\\n')}

File contents are provided below for your reference.`

  // Add file contents (but keep total size reasonable)
  const fileContents = context.files.map(f => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: fileContents },
    { role: 'user', content: message }
  ]

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages as any,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 'No response generated'
    
    // Extract citations
    const citations = extractCitations(response, context.files)
    
    return {
      content: response,
      citations
    }
    
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to generate response')
  }
}

function extractCitations(response: string, files: Array<{path: string, content: string}>) {
  const citations = []
  
  for (const file of files) {
    if (response.includes(file.path)) {
      citations.push({
        file: file.path,
        // Try to find relevant line numbers by looking for "line X" mentions
        line: findLineNumber(response, file.path)
      })
    }
  }
  
  return citations
}

function findLineNumber(text: string, filePath: string): number | undefined {
  // Look for patterns like "line 123" near file mentions
  const match = text.match(new RegExp(`${filePath}.*?line\\s+(\\d+)`, 'i'))
  return match ? parseInt(match[1]) : undefined
}
