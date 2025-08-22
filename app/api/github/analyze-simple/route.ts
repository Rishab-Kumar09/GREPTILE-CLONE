import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, owner, repo } = await request.json()
    
    if (!openai) {
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API key not configured',
        totalBugs: 0,
        results: []
      }, { status: 500 })
    }

    // Get repository info
    const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!repoInfoResponse.ok) {
      throw new Error('Failed to fetch repository info')
    }

    const repoInfo = await repoInfoResponse.json()
    const defaultBranch = repoInfo.default_branch || 'main'

    // Get repository file tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!treeResponse.ok) {
      throw new Error('Failed to fetch repository tree')
    }

    const treeData = await treeResponse.json()
    
    // Filter for code files
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs']
    const codeFiles = treeData.tree.filter((item: any) => 
      item.type === 'blob' && 
      codeExtensions.some(ext => item.path.endsWith(ext)) &&
      !item.path.includes('node_modules') &&
      !item.path.includes('.git') &&
      item.size < 50000 // Skip very large files
    ).slice(0, 5) // Limit to 5 files for faster processing

    const analysisResults = []
    let totalBugs = 0

    // Analyze each file
    for (const file of codeFiles) {
      try {
        // Get file content
        const fileResponse = await fetch(file.url, {
          headers: {
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'Greptile-Clone'
          }
        })

        if (!fileResponse.ok) continue

        const content = await fileResponse.text()
        if (!content || content.length < 50) continue

        // Analyze with OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Analyze code for bugs, security issues, and code smells. Respond with valid JSON:
{
  "bugs": [{"line": 1, "severity": "high", "type": "Logic Error", "description": "...", "suggestion": "..."}],
  "securityIssues": [{"line": 1, "severity": "critical", "type": "Security Issue", "description": "...", "suggestion": "..."}],
  "codeSmells": [{"line": 1, "type": "Code Smell", "description": "...", "suggestion": "..."}]
}`
            },
            {
              role: "user",
              content: `Analyze this ${file.path} file:\n\n${content.slice(0, 3000)}`
            }
          ],
          temperature: 0.1,
          max_tokens: 1000,
        })

        const response = completion.choices[0].message.content
        if (!response) continue

        const analysis = JSON.parse(response)
        const bugs = analysis.bugs || []
        const securityIssues = analysis.securityIssues || []
        const codeSmells = analysis.codeSmells || []

        totalBugs += bugs.length + securityIssues.length + codeSmells.length

        analysisResults.push({
          file: file.path,
          bugs,
          securityIssues,
          codeSmells
        })

      } catch (error) {
        continue // Skip files that fail
      }
    }

    return NextResponse.json({
      success: true,
      repository: `${owner}/${repo}`,
      totalFilesFound: codeFiles.length,
      filesAnalyzed: analysisResults.length,
      totalBugs,
      totalSecurityIssues: analysisResults.reduce((acc, result) => acc + result.securityIssues.length, 0),
      totalCodeSmells: analysisResults.reduce((acc, result) => acc + result.codeSmells.length, 0),
      results: analysisResults
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to analyze repository',
      details: error instanceof Error ? error.message : 'Unknown error',
      totalBugs: 0,
      results: []
    }, { status: 500 })
  }
} 