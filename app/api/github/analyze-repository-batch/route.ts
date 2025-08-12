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
  const startTime = Date.now()
  const TIMEOUT_MS = 20000 // 20 seconds per batch
  
  try {
    const { repoUrl, owner, repo, batchIndex = 0, batchSize = 30 } = await request.json()
    
    console.log(`🚀 BATCH ${batchIndex + 1} - Analyzing ${owner}/${repo}`)
    
    if (!openai) {
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API key not configured',
        totalBugs: 0,
        results: []
      })
    }

    // Get repository info first to find default branch
    const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!repoInfoResponse.ok) {
      throw new Error(`Failed to fetch repository info: ${repoInfoResponse.status}`)
    }

    const repoInfo = await repoInfoResponse.json()
    const defaultBranch = repoInfo.default_branch || 'main'
    
    console.log(`Using branch: ${defaultBranch}`)

    // Get repository file tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`)
    }

    const treeData = await treeResponse.json()
    
    // Filter for code files
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rust', '.swift', '.kt', '.html', '.css', '.vue', '.svelte', '.sql', '.sh', '.yml', '.yaml', '.json']
    const excludePaths = ['node_modules', '.git', 'dist', 'build', 'vendor', 'deps', 'target', 'bin', 'obj', 'out', 'coverage', 'test', 'tests', '__pycache__', '.next', '.nuxt', 'public', 'static', 'assets', 'images', 'fonts']
    
    const codeFiles = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false
      
      const hasCodeExtension = codeExtensions.some(ext => item.path.toLowerCase().endsWith(ext))
      if (!hasCodeExtension) return false
      
      const isExcluded = excludePaths.some(excludePath => 
        item.path.toLowerCase().includes(excludePath.toLowerCase())
      )
      if (isExcluded) return false
      
      return true
    })
    
    // Sort files for optimal processing
    const sortedFiles = codeFiles.sort((a: any, b: any) => {
      const aDepth = a.path.split('/').length
      const bDepth = b.path.split('/').length
      if (aDepth !== bDepth) return aDepth - bDepth
      return (a.size || 0) - (b.size || 0)
    })

    // Calculate batch boundaries
    const startIndex = batchIndex * batchSize
    const endIndex = Math.min(startIndex + batchSize, sortedFiles.length)
    const filesToAnalyze = sortedFiles.slice(startIndex, endIndex)
    
    console.log(`📊 BATCH ${batchIndex + 1}: Processing files ${startIndex + 1}-${endIndex} of ${sortedFiles.length}`)

    const analysisResults: AnalysisResult[] = []
    let totalBugs = 0
    let totalSecurityIssues = 0
    let totalCodeSmells = 0
    let filesProcessed = 0

    // Analyze each file in this batch
    for (const file of filesToAnalyze) {
      // Check timeout for this batch
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.log(`⏰ Batch timeout reached, processed ${filesProcessed}/${filesToAnalyze.length} files in this batch`)
        break
      }
      
      filesProcessed++
      console.log(`📁 Processing ${filesProcessed}/${filesToAnalyze.length}: ${file.path}`)
      
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Greptile-Clone'
          }
        })

        if (!fileResponse.ok) {
          console.log(`❌ Failed to fetch ${file.path}: ${fileResponse.status}`)
          continue
        }

        const fileData = await fileResponse.json()
        
        if (!fileData.content) {
          console.log(`⚠️ No content for ${file.path}`)
          continue
        }

        const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
        console.log(`📄 Analyzing ${file.path} (${content.length} chars)`)

        // Analyze with OpenAI (with chunking for large files)
        const analysis = await analyzeCodeWithAI(file.path, content, content.length > 10000)
        
        if (analysis) {
          analysisResults.push(analysis)
          totalBugs += analysis.bugs.length
          totalSecurityIssues += analysis.securityIssues.length
          totalCodeSmells += analysis.codeSmells.length
          
          console.log(`✅ ${file.path}: ${analysis.bugs.length} bugs, ${analysis.securityIssues.length} security issues`)
        }

        // Minimal delay
        await new Promise(resolve => setTimeout(resolve, 50))
        
      } catch (error) {
        console.error(`❌ Error processing ${file.path}:`, error)
        continue
      }
    }

    const hasMoreBatches = endIndex < sortedFiles.length
    const nextBatchIndex = hasMoreBatches ? batchIndex + 1 : null

    console.log(`🎉 BATCH ${batchIndex + 1} COMPLETE: ${totalBugs} bugs, ${totalSecurityIssues} security issues, ${totalCodeSmells} code smells`)

    return NextResponse.json({
      success: true,
      batchIndex,
      repository: `${owner}/${repo}`,
      totalFilesInRepo: sortedFiles.length,
      batchStartIndex: startIndex,
      batchEndIndex: endIndex,
      filesProcessedInBatch: analysisResults.length,
      totalBugs,
      totalSecurityIssues,
      totalCodeSmells,
      results: analysisResults,
      hasMoreBatches,
      nextBatchIndex,
      progress: {
        filesProcessed: endIndex,
        totalFiles: sortedFiles.length,
        percentage: Math.round((endIndex / sortedFiles.length) * 100)
      }
    })

  } catch (error: any) {
    console.error('Batch analysis error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error during batch analysis',
      batchIndex: 0,
      totalBugs: 0,
      results: []
    }, { status: 500 })
  }
}

// Same AI analysis functions as before
async function analyzeCodeWithAI(filePath: string, code: string, needsChunking: boolean = false): Promise<AnalysisResult | null> {
  if (!openai) return null

  // For massive files, analyze in chunks
  if (needsChunking && code.length > 10000) {
    console.log(`🔄 Chunking large file: ${filePath} (${code.length} chars)`)
    
    const chunkSize = 8000
    const chunks = []
    for (let i = 0; i < code.length; i += chunkSize) {
      chunks.push(code.slice(i, i + chunkSize))
    }
    
    const allBugs: any[] = []
    const allSecurityIssues: any[] = []
    const allCodeSmells: any[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkResult = await analyzeSingleChunk(filePath, chunks[i], i + 1, chunks.length)
      if (chunkResult) {
        allBugs.push(...chunkResult.bugs)
        allSecurityIssues.push(...chunkResult.securityIssues)
        allCodeSmells.push(...chunkResult.codeSmells)
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    return {
      file: filePath,
      bugs: allBugs,
      securityIssues: allSecurityIssues,
      codeSmells: allCodeSmells
    }
  }

  return await analyzeSingleChunk(filePath, code, 1, 1)
}

async function analyzeSingleChunk(filePath: string, code: string, chunkNum: number, totalChunks: number): Promise<AnalysisResult | null> {
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
          content: `Analyze this ${filePath} file${totalChunks > 1 ? ` (chunk ${chunkNum}/${totalChunks})` : ''}:\n\n${code}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const response = completion.choices[0].message.content
    if (!response) return null

    const analysis = JSON.parse(response)
    return {
      file: filePath,
      bugs: analysis.bugs || [],
      securityIssues: analysis.securityIssues || [],
      codeSmells: analysis.codeSmells || []
    }

  } catch (error) {
    console.error(`Error analyzing ${filePath} chunk ${chunkNum}:`, error)
    return null
  }
} 