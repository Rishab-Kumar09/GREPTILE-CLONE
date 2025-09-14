import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Global type declaration for session contexts
declare global {
  var sessionContexts: Map<string, any> | undefined
}

interface FileContent {
  name: string;
  path: string;
  content: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Test endpoint to verify route is working
export async function GET() {
  return NextResponse.json({ 
    message: 'Intelligent session API is working!',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧠 Intelligent session API called')
    const { message, repository, sessionId, analysisResults, chatHistory } = await request.json()
    
    if (!message || !repository) {
      return NextResponse.json({ error: 'message and repository are required' }, { status: 400 })
    }
    
    console.log(`🧠 Intelligent chat request for ${repository}`)
    
    interface Context {
      repository: string;
      analysisResults: any; // We'll type this properly later
      files: { [key: string]: FileContent };
      functions: { [key: string]: any };
    }

    // Build context from analysis results AND GitHub API
    const context: Context = {
      repository,
      analysisResults,
      files: {},
      functions: {}
    }

    try {
      // Get file list from GitHub API
      const [owner, repo] = repository.split('/')
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`)
      if (response.ok) {
        const files = await response.json() as Array<{
          type: string;
          name: string;
          path: string;
          url: string;
        }>
        
        // Get content for code files
        for (const file of files) {
          if (file.type === 'file' && file.name.match(/\.(js|ts|py|java|cpp|go|rb|php|cs|rs)$/)) {
            const contentResponse = await fetch(file.url)
            if (contentResponse.ok) {
              const data = await contentResponse.json() as { content: string }
              context.files[file.path] = {
                name: file.name,
                path: file.path,
                content: Buffer.from(data.content, 'base64').toString('utf8')
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to get files from GitHub:', error)
      // Continue with just analysis results
    }
    
    console.log(`📊 Using context: ${Object.keys(context.files).length} files from GitHub`)
    console.log(`📊 Analysis results: ${analysisResults.totalIssues} issues (${analysisResults.criticalIssues} critical)`)
    
    // Build enhanced context for AI
    const enhancedContext = {
      repository,
      files: context.files,
      analysisResults: {
        totalIssues: analysisResults.totalIssues,
        criticalIssues: analysisResults.criticalIssues,
        categories: analysisResults.categories
      }
    }
    
    // Generate intelligent response
    const response = await generateIntelligentResponse(message, enhancedContext, chatHistory)
    
    return NextResponse.json({ 
      success: true, 
      response: response.content,
      citations: response.citations,
      contextUsed: {
        filesCount: Object.keys(context.files).length,
        analysisIssues: context.analysisResults.totalIssues,
        criticalIssues: context.analysisResults.criticalIssues
      }
    })
    
  } catch (error) {
    console.error('❌ Intelligent chat error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Get stored repository context
async function getStoredRepositoryContext(sessionId?: string, repository?: string) {
  if (!global.sessionContexts) {
    return null
  }
  
  // Try all possible keys in the same order as storage
  const key = sessionId || `repo:${repository}`
  console.log('🔍 Looking for context with key:', key)
  console.log('🗝️ Available keys:', Array.from(global.sessionContexts.keys()))
  const session = global.sessionContexts.get(key)
  
  if (!session) {
    return null
  }
  
  // Check if expired
  if (session.expiresAt < Date.now()) {
    global.sessionContexts.delete(key)
    return null
  }
  
  return session
}

// Build enhanced context for AI
function buildEnhancedContext(repoContext: any, analysisResults: any, userMessage: string) {
  const context = {
    repository: repoContext.repository,
    architecture: {
      frameworks: repoContext.architecture.frameworks,
      totalFiles: Object.keys(repoContext.files).length,
      languages: Array.from(new Set(Object.values(repoContext.files).map((f: any) => f.language))),
      keyFiles: getKeyFiles(repoContext.files)
    },
    codeIntelligence: {
      functions: Object.keys(repoContext.symbols.functions).length,
      relationships: repoContext.relationships.length,
      crossFileConnections: repoContext.relationships.filter((r: any) => r.from !== r.to).length
    },
    relevantCode: findRelevantCode(repoContext, userMessage),
    analysisResults: analysisResults ? {
      totalIssues: analysisResults.totalIssues || 0,
      criticalIssues: analysisResults.criticalIssues || 0,
      categories: analysisResults.categories || []
    } : null
  }
  
  return context
}

// Get key files from repository
function getKeyFiles(files: any) {
  const keyFiles = []
  
  for (const [path, file] of Object.entries(files)) {
    const f = file as any
    // Identify key files based on common patterns
    if (
      path.includes('package.json') ||
      path.includes('README') ||
      path.includes('index.') ||
      path.includes('main.') ||
      path.includes('app.') ||
      path.includes('App.') ||
      f.functions?.length > 5 || // Files with many functions
      f.lines > 200 // Large files
    ) {
      keyFiles.push({
        path,
        language: f.language,
        functions: f.functions?.length || 0,
        lines: f.lines
      })
    }
  }
  
  return keyFiles.slice(0, 10) // Top 10 key files
}

// Find relevant code based on user message
function findRelevantCode(repoContext: any, userMessage: string) {
  const relevantCode = {
    files: [] as any[],
    functions: [] as any[],
    relationships: [] as any[]
  }
  
  const messageLower = userMessage.toLowerCase()
  const keywords = extractKeywords(messageLower)
  
  // Find relevant files
  for (const [path, file] of Object.entries(repoContext.files)) {
    const f = file as any
    const pathLower = path.toLowerCase()
    
    if (keywords.some(keyword => pathLower.includes(keyword))) {
      relevantCode.files.push({
        path,
        language: f.language,
        functions: f.functions?.slice(0, 3) || [], // Top 3 functions
        reason: 'filename match'
      })
    }
  }
  
  // Find relevant functions
  for (const [funcName, locations] of Object.entries(repoContext.symbols.functions)) {
    const funcNameLower = funcName.toLowerCase()
    
    if (keywords.some(keyword => funcNameLower.includes(keyword))) {
      relevantCode.functions.push({
        name: funcName,
        locations: locations,
        reason: 'function name match'
      })
    }
  }
  
  // Find relevant relationships
  relevantCode.relationships = repoContext.relationships.filter((rel: any) => {
    return keywords.some(keyword => 
      rel.symbol?.toLowerCase().includes(keyword) ||
      rel.from?.toLowerCase().includes(keyword) ||
      rel.to?.toLowerCase().includes(keyword)
    )
  }).slice(0, 5) // Top 5 relationships
  
  return relevantCode
}

// Extract keywords from user message
function extractKeywords(message: string) {
  // Remove common words and extract meaningful terms
  const commonWords = ['the', 'is', 'at', 'which', 'on', 'how', 'what', 'where', 'when', 'why', 'can', 'could', 'should', 'would', 'do', 'does', 'did', 'will', 'have', 'has', 'had', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'for', 'to', 'of', 'as', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those']
  
  const words = message.split(/\s+/).filter(word => 
    word.length > 2 && 
    !commonWords.includes(word) &&
    /^[a-zA-Z0-9_-]+$/.test(word)
  )
  
  return words.slice(0, 10) // Top 10 keywords
}

// Generate intelligent response using OpenAI
async function generateIntelligentResponse(userMessage: string, context: { repository: string, files: { [key: string]: FileContent }, analysisResults: any }, chatHistory: any[] = []) {
  const systemPrompt = `You are an expert code analyst with complete knowledge of the repository "${context.repository}". 

REPOSITORY INTELLIGENCE:
- Files: ${Object.keys(context.files).length} files analyzed
- Analysis Results: ${context.analysisResults.totalIssues} issues found (${context.analysisResults.criticalIssues} critical)
- Categories: ${context.analysisResults.categories.join(', ')}

FILE CONTENTS:
${Object.entries(context.files).map(([path, file]: [string, FileContent]) => `- ${path} (${file.content.split('\n').length} lines)`).join('\n')}

${context.analysisResults ? `ANALYSIS RESULTS:
- Total Issues: ${context.analysisResults.totalIssues}
- Critical Issues: ${context.analysisResults.criticalIssues}
- Categories: ${context.analysisResults.categories.join(', ')}` : ''}

RELEVANT FILES:
${Object.entries(context.files)
  .filter(([path, file]: [string, FileContent]) => path.toLowerCase().includes(userMessage.toLowerCase()) || file.content.toLowerCase().includes(userMessage.toLowerCase()))
  .map(([path]) => `- ${path}`).join('\n')}

You have COMPLETE knowledge of every file, function, and relationship in this repository. Provide expert, contextual responses about:
- Code architecture and patterns
- Function implementations and usage
- File relationships and dependencies  
- Potential improvements and suggestions
- Bug analysis and solutions
- Feature implementation guidance

Always cite specific files, functions, or code sections when relevant. Be precise and actionable.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10), // Last 10 messages for context
    { role: 'user', content: userMessage }
  ]

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 'No response generated'
    
    // Extract citations from response
    const citations = extractCitations(response, context)
    
    return {
      content: response,
      citations
    }
    
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to generate intelligent response')
  }
}

// Extract citations from AI response
function extractCitations(response: string, context: any) {
  const citations = []
  
  // Look for file mentions
  for (const [path] of Object.entries(context.repository?.files || {})) {
    if (response.includes(path)) {
      citations.push({
        type: 'file',
        path,
        context: 'mentioned in response'
      })
    }
  }
  
  // Look for function mentions
  for (const [funcName] of Object.entries(context.repository?.symbols?.functions || {})) {
    if (response.includes(funcName)) {
      citations.push({
        type: 'function',
        name: funcName,
        context: 'mentioned in response'
      })
    }
  }
  
  return citations.slice(0, 5) // Top 5 citations
}
