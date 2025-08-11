import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

interface AnalysisResult {
  file: string
  bugs: Array<{
    line: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    type: string
    description: string
    suggestion: string
  }>
  codeSmells: Array<{
    line: number
    type: string
    description: string
    suggestion: string
  }>
  securityIssues: Array<{
    line: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    type: string
    description: string
    suggestion: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, owner, repo } = await request.json()
    
    console.log(`Starting analysis for ${owner}/${repo}`)
    
    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        totalBugs: 0,
        results: []
      })
    }

    // Get repository file tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!treeResponse.ok) {
      throw new Error('Failed to fetch repository tree')
    }

    const treeData = await treeResponse.json()
    
    // Filter for code files (common extensions)
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rust', '.swift', '.kt']
    const codeFiles = treeData.tree.filter((item: any) => 
      item.type === 'blob' && 
      codeExtensions.some(ext => item.path.endsWith(ext)) &&
      !item.path.includes('node_modules') &&
      !item.path.includes('.git') &&
      !item.path.includes('dist') &&
      !item.path.includes('build')
    ).slice(0, 10) // Limit to first 10 files for performance

    console.log(`Found ${codeFiles.length} code files to analyze`)

    const analysisResults: AnalysisResult[] = []
    let totalBugs = 0
    let totalSecurityIssues = 0
    let totalCodeSmells = 0

    // Analyze each code file
    for (const file of codeFiles) {
      try {
        console.log(`Analyzing file: ${file.path}`)
        
        // Get file content
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Greptile-Clone'
          }
        })

        if (!fileResponse.ok) continue

        const fileData = await fileResponse.json()
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        
        // Skip very large files
        if (content.length > 10000) continue

        // Analyze with OpenAI
        const analysis = await analyzeCodeWithAI(file.path, content)
        
        if (analysis) {
          analysisResults.push(analysis)
          totalBugs += analysis.bugs.length
          totalSecurityIssues += analysis.securityIssues.length
          totalCodeSmells += analysis.codeSmells.length
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`Error analyzing file ${file.path}:`, error)
        continue
      }
    }

    console.log(`Analysis complete: ${totalBugs} bugs, ${totalSecurityIssues} security issues, ${totalCodeSmells} code smells`)

    return NextResponse.json({
      success: true,
      repository: `${owner}/${repo}`,
      filesAnalyzed: analysisResults.length,
      totalBugs,
      totalSecurityIssues,
      totalCodeSmells,
      results: analysisResults,
      summary: {
        criticalIssues: analysisResults.reduce((acc, result) => 
          acc + result.bugs.filter(b => b.severity === 'critical').length + 
          result.securityIssues.filter(s => s.severity === 'critical').length, 0),
        highIssues: analysisResults.reduce((acc, result) => 
          acc + result.bugs.filter(b => b.severity === 'high').length + 
          result.securityIssues.filter(s => s.severity === 'high').length, 0),
        mediumIssues: analysisResults.reduce((acc, result) => 
          acc + result.bugs.filter(b => b.severity === 'medium').length + 
          result.securityIssues.filter(s => s.severity === 'medium').length, 0),
        lowIssues: analysisResults.reduce((acc, result) => 
          acc + result.bugs.filter(b => b.severity === 'low').length + 
          result.securityIssues.filter(s => s.severity === 'low').length, 0)
      }
    })

  } catch (error) {
    console.error('Repository analysis error:', error)
    return NextResponse.json({
      error: 'Failed to analyze repository',
      details: error instanceof Error ? error.message : 'Unknown error',
      totalBugs: 0,
      results: []
    }, { status: 500 })
  }
}

async function analyzeCodeWithAI(filePath: string, code: string): Promise<AnalysisResult | null> {
  if (!openai) return null

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert code reviewer. Analyze the provided code for:
1. BUGS: Logic errors, null pointer exceptions, infinite loops, type errors
2. SECURITY ISSUES: SQL injection, XSS, insecure data handling, authentication issues
3. CODE SMELLS: Poor naming, duplicated code, complex functions, performance issues

Respond ONLY with valid JSON in this exact format:
{
  "bugs": [{"line": 1, "severity": "high", "type": "Logic Error", "description": "...", "suggestion": "..."}],
  "securityIssues": [{"line": 1, "severity": "critical", "type": "SQL Injection", "description": "...", "suggestion": "..."}],
  "codeSmells": [{"line": 1, "type": "Complex Function", "description": "...", "suggestion": "..."}]
}

Severity levels: critical, high, medium, low`
        },
        {
          role: "user",
          content: `Analyze this ${filePath} file:\n\n${code}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const response = completion.choices[0].message.content
    if (!response) return null

    // Parse JSON response
    const analysis = JSON.parse(response)
    
    return {
      file: filePath,
      bugs: analysis.bugs || [],
      securityIssues: analysis.securityIssues || [],
      codeSmells: analysis.codeSmells || []
    }

  } catch (error) {
    console.error(`AI analysis error for ${filePath}:`, error)
    return null
  }
} 