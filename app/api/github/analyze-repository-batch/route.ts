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
  // 🚀 ENTERPRISE TIMEOUT HANDLING: Multiple timeout layers
  const TOTAL_TIMEOUT_MS = 25000 // 25 seconds total request timeout
  const PER_FILE_TIMEOUT_MS = 8000 // 8 seconds per individual file
  const BATCH_TIMEOUT_MS = 20000 // 20 seconds per micro-batch
  
  // Initialize variables at function scope for catch block access
  let analysisResults: AnalysisResult[] = []
  let totalBugs = 0
  let totalSecurityIssues = 0
  let totalCodeSmells = 0
  let filesProcessed = 0
  let startIndex = 0
  let endIndex = 0
  let batchIndex = 0
  let owner = ''
  let repo = ''
  
  try {
    const requestData = await request.json()
    const requestBody = { repoUrl: '', owner: '', repo: '', batchIndex: 0, batchSize: 4, ...requestData }
    const { repoUrl, batchSize } = requestBody
    owner = requestBody.owner
    repo = requestBody.repo
    batchIndex = requestBody.batchIndex
    
    console.log(`🚀 BATCH ${batchIndex + 1} - Analyzing ${owner}/${repo}`)
    console.log(`📦 Request data:`, { 
      owner, 
      repo, 
      batchIndex, 
      requestedBatchSize: requestData.batchSize, 
      actualBatchSize: batchSize 
    })
    console.log('🔑 Environment check:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openaiInstance: !!openai,
      keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
    })
    
    if (!openai) {
      console.error('❌ OpenAI API key not configured')
      console.error('❌ Environment variables:', Object.keys(process.env).filter(key => key.includes('OPENAI')))
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables.',
        totalBugs: 0,
        results: []
      }, { status: 500 })
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
    
    // Filter for code files - EXPANDED to catch more files like NodeGoat analysis
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
      '.py', '.pyx', '.pyi', 
      '.java', '.scala', '.kt', '.groovy',
      '.cpp', '.cc', '.c', '.h', '.hpp', '.cxx',
      '.cs', '.vb', '.fs',
      '.php', '.phtml', '.php3', '.php4', '.php5',
      '.rb', '.rbw', '.rake', '.gemspec',
      '.go', '.mod', '.sum',
      '.rust', '.rs', '.toml',
      '.swift', '.m', '.mm',
      '.html', '.htm', '.xhtml', '.jsp', '.asp', '.aspx',
      '.css', '.scss', '.sass', '.less', '.stylus',
      '.vue', '.svelte', '.angular', '.jsx', '.tsx',
      '.sql', '.mysql', '.pgsql', '.sqlite',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
      '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
      '.json', '.json5', '.jsonc',
      '.xml', '.xsd', '.xsl', '.xslt',
      '.md', '.markdown', '.rst', '.txt',
      '.dockerfile', '.makefile', '.gradle', '.maven',
      '.r', '.R', '.rmd', '.ipynb'
    ]
    
    // LESS restrictive exclude paths - only exclude obvious non-code directories
    const excludePaths = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'out', 'target', 'bin', 'obj',
      '__pycache__', '.pytest_cache', '.mypy_cache',
      'vendor', 'deps', 'packages',
      '.next', '.nuxt', '.cache', '.tmp', 'tmp',
      'coverage', '.nyc_output',
      'logs', 'log'
    ]
    
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
    
    // Sort files for optimal processing - ANALYZE ALL FILES like NodeGoat
    const sortedFiles = codeFiles.sort((a: any, b: any) => {
      // Prioritize root level files first (they're usually more important)
      const aDepth = a.path.split('/').length
      const bDepth = b.path.split('/').length
      if (aDepth !== bDepth) return aDepth - bDepth
      
      // Then prioritize important file types
      const importantFiles = ['.js', '.ts', '.py', '.java', '.php', '.rb', '.go', '.cpp', '.c']
      const aImportant = importantFiles.some(ext => a.path.toLowerCase().endsWith(ext))
      const bImportant = importantFiles.some(ext => b.path.toLowerCase().endsWith(ext))
      if (aImportant && !bImportant) return -1
      if (!aImportant && bImportant) return 1
      
      // Finally by size (smaller files first for speed, but don't exclude large files)
      const sizeA = a.size || 0
      const sizeB = b.size || 0
      return sizeA - sizeB
    })

    // 📊 DETAILED FILE ANALYSIS LOGGING
    console.log(`📁 REPOSITORY FILE ANALYSIS for ${owner}/${repo}:`)
    console.log(`   Total files in repo: ${treeData.tree.length}`)
    console.log(`   Code files found: ${codeFiles.length}`)
    console.log(`   Files after sorting: ${sortedFiles.length}`)
    console.log(`   Batch size: ${batchSize}`)
    console.log(`   Total batches needed: ${batchSize > 0 ? Math.ceil(sortedFiles.length / batchSize) : 0}`)
    
    // Log file types breakdown
    const fileTypes: { [key: string]: number } = {}
    codeFiles.forEach((file: any) => {
      const ext = file.path.split('.').pop()?.toLowerCase() || 'no-ext'
      fileTypes[ext] = (fileTypes[ext] || 0) + 1
    })
    console.log(`   File types found:`, fileTypes)
    
    // 🔍 DEBUG: Show first few files found
    console.log(`📝 First 10 code files found:`)
    codeFiles.slice(0, 10).forEach((file: any, index: number) => {
      console.log(`   ${index + 1}. ${file.path} (${file.size || 0} bytes, type: ${file.type})`)
    })
    
    if (codeFiles.length === 0) {
      console.log(`❌ NO CODE FILES FOUND! Check file extensions and exclude paths.`)
      console.log(`📄 All files in repo:`)
      treeData.tree.slice(0, 20).forEach((file: any, index: number) => {
        console.log(`   ${index + 1}. ${file.path} (${file.size || 0} bytes, type: ${file.type})`)
      })
    }



    // 🎯 HYBRID APPROACH: Process files in batches, chunk large files on-demand
    // This avoids memory issues from pre-processing ALL files at once
    
    // Calculate batch boundaries by FILES (not chunks)
    startIndex = batchIndex * batchSize
    endIndex = Math.min(startIndex + batchSize, sortedFiles.length)
    const filesToAnalyze = sortedFiles.slice(startIndex, endIndex)
    
    console.log(`📊 BATCH ${batchIndex + 1}: Processing files ${startIndex + 1}-${endIndex} of ${sortedFiles.length}`)
    console.log(`📋 Files in this batch:`)
    filesToAnalyze.forEach((file: any, index: number) => {
      console.log(`   ${index + 1}. ${file.path} (${file.size || 0} bytes)`)
    })

    // 🚀 PARALLEL MICRO-BATCHING: Process files in parallel micro-batches
    console.log(`🔥 ENTERPRISE PROCESSING: Starting parallel micro-batching for ${filesToAnalyze.length} files`)
    
    // Create micro-batches of 2 files each for parallel processing
    const MICRO_BATCH_SIZE = 2
    const microBatches: any[][] = []
    
    for (let i = 0; i < filesToAnalyze.length; i += MICRO_BATCH_SIZE) {
      microBatches.push(filesToAnalyze.slice(i, i + MICRO_BATCH_SIZE))
    }
    
    console.log(`📦 Created ${microBatches.length} micro-batches of ${MICRO_BATCH_SIZE} files each`)
    
    // Process micro-batches in parallel with timeout protection
    const processMicroBatch = async (microBatch: any[], microBatchIndex: number): Promise<AnalysisResult[]> => {
      const microBatchStartTime = Date.now()
      const microBatchResults: AnalysisResult[] = []
      
      console.log(`⚡ Processing micro-batch ${microBatchIndex + 1}/${microBatches.length}:`, microBatch.map(f => f.path))
      
      for (const file of microBatch) {
        // Multi-layer timeout protection
        if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
          console.log(`⏰ TOTAL timeout reached - stopping all processing`)
          break
        }
        
        if (Date.now() - microBatchStartTime > BATCH_TIMEOUT_MS) {
          console.log(`⏰ Micro-batch timeout reached for batch ${microBatchIndex + 1}`)
          break
        }
        
        try {
          // File processing with individual timeout
          const fileResult = await Promise.race([
            processFileWithTimeout(file, owner, repo),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('File timeout')), PER_FILE_TIMEOUT_MS)
            )
          ])
          
          if (fileResult) {
            microBatchResults.push(fileResult)
            console.log(`✅ Micro-batch ${microBatchIndex + 1}: ${file.path} completed`)
          }
          
        } catch (error) {
          console.error(`❌ Micro-batch ${microBatchIndex + 1}: Failed ${file.path}:`, error instanceof Error ? error.message : 'Unknown error')
          continue
        }
      }
      
      const microBatchTime = Date.now() - microBatchStartTime
      console.log(`🎉 Micro-batch ${microBatchIndex + 1} completed in ${microBatchTime}ms with ${microBatchResults.length} results`)
      
      return microBatchResults
    }
    
    // Execute all micro-batches in parallel
    const allMicroBatchPromises = microBatches.map((microBatch, index) => 
      processMicroBatch(microBatch, index)
    )
    
    // Wait for all micro-batches with timeout protection
    const allMicroBatchResults = await Promise.allSettled(allMicroBatchPromises)
    
    // Collect results from all micro-batches
    allMicroBatchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        analysisResults.push(...result.value)
        result.value.forEach(analysis => {
          totalBugs += analysis.bugs.length
          totalSecurityIssues += analysis.securityIssues.length
          totalCodeSmells += analysis.codeSmells.length
        })
        console.log(`📊 Micro-batch ${index + 1} contributed ${result.value.length} analysis results`)
      } else {
        console.error(`❌ Micro-batch ${index + 1} failed:`, result.reason)
      }
    })
    
    filesProcessed = analysisResults.length

    const hasMoreBatches = endIndex < sortedFiles.length
    const nextBatchIndex = hasMoreBatches ? batchIndex + 1 : null

    // 📈 DETAILED BATCH COMPLETION STATS
    console.log(`🎉 BATCH ${batchIndex + 1} COMPLETE:`)
    console.log(`   Files scheduled for batch: ${filesToAnalyze.length}`)
    console.log(`   Files actually processed: ${filesProcessed}`)
    console.log(`   Files with analysis results: ${analysisResults.length}`)
    console.log(`   Issues found: ${totalBugs} bugs, ${totalSecurityIssues} security issues, ${totalCodeSmells} code smells`)
    console.log(`   Processing efficiency: ${filesToAnalyze.length > 0 ? Math.round((filesProcessed / filesToAnalyze.length) * 100) : 0}%`)
    console.log(`   Overall progress: ${endIndex}/${sortedFiles.length} files (${sortedFiles.length > 0 ? Math.round((endIndex / sortedFiles.length) * 100) : 0}%)`)
    if (hasMoreBatches && nextBatchIndex !== null) {
      console.log(`   Next batch: ${nextBatchIndex + 1} (will process files ${endIndex + 1}-${Math.min(endIndex + batchSize, sortedFiles.length)})`)
    } else {
      console.log(`   ✅ All batches complete! Repository analysis finished.`)
    }

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
        percentage: sortedFiles.length > 0 ? Math.round((endIndex / sortedFiles.length) * 100) : 0
      }
    })

  } catch (error: any) {
    console.error('🚨 Batch analysis error:', error)
    console.error('🚨 Error details:', {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      name: error.name,
      code: error.code
    })
    
    // Return partial results if we processed some files successfully
    const hasPartialResults = analysisResults && analysisResults.length > 0
    
    return NextResponse.json({ 
      success: hasPartialResults, // Mark as success if we have some results
      error: hasPartialResults ? `Partial analysis completed. Error: ${error.message}` : error.message || 'Unknown error during batch analysis',
      batchIndex: batchIndex || 0,
      repository: `${owner}/${repo}`,
      totalFilesInRepo: 0,
      batchStartIndex: startIndex || 0,
      batchEndIndex: endIndex || 0,
      filesProcessedInBatch: analysisResults?.length || 0,
      totalBugs: totalBugs || 0,
      totalSecurityIssues: totalSecurityIssues || 0,
      totalCodeSmells: totalCodeSmells || 0,
      results: analysisResults || [],
      hasMoreBatches: false, // Stop processing on error
      nextBatchIndex: null,
      progress: {
        filesProcessed: endIndex || 0,
        totalFiles: 0,
        percentage: 0
      }
    }, { status: hasPartialResults ? 200 : 500 })
  }
}

// 🚀 ENTERPRISE FILE PROCESSING: Individual file processing with timeout protection
async function processFileWithTimeout(file: any, owner: string, repo: string): Promise<AnalysisResult | null> {
  try {
    // Get file content with timeout protection
    const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!fileResponse.ok) {
      console.log(`❌ Failed to fetch ${file.path}: ${fileResponse.status}`)
      return null
    }

    const fileData = await fileResponse.json()
    
    if (!fileData.content) {
      console.log(`⚠️ No content for ${file.path}`)
      return null
    }

    const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
    console.log(`📄 Processing ${file.path} (${content.length} chars, ${content.split('\n').length} lines)`)

    // Smart chunking for large files
    const shouldChunk = content.length > 10000
    
    const analysis = await analyzeCodeWithAI(file.path, content, shouldChunk)
    
    if (analysis) {
      console.log(`✅ ${file.path}: ${analysis.bugs.length} bugs, ${analysis.securityIssues.length} security, ${analysis.codeSmells.length} smells`)
      return analysis
    }
    
    return null
    
  } catch (error) {
    console.error(`❌ Error processing ${file.path}:`, error)
    return null
  }
}

// Same AI analysis functions as before
async function analyzeCodeWithAI(filePath: string, code: string, needsChunking: boolean = false): Promise<AnalysisResult | null> {
  if (!openai) return null

  // 🎯 ORIGINAL WORKING CHUNKING: Simple character-based chunking for massive files
  if (needsChunking && code.length > 10000) {
    console.log(`🔄 Chunking large file: ${filePath} (${code.length} chars)`)
    
    const chunkSize = 8000 // Original working chunk size
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
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    
    return {
      file: filePath,
      bugs: allBugs,
      securityIssues: allSecurityIssues,
      codeSmells: allCodeSmells
    }
  }

  return await analyzeSingleChunk(filePath, code, 1, 1, 1)
}

async function analyzeSingleChunk(filePath: string, code: string, chunkNum: number, totalChunks: number, startLineOffset: number = 1): Promise<AnalysisResult | null> {
  if (!openai) return null

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a professional senior code reviewer with 10+ years of experience in software security and code quality. Your expertise includes identifying critical vulnerabilities, performance bottlenecks, and maintainability issues across multiple programming languages.

Analyze the provided code with the precision of a professional security audit for:

1. BUGS: Logic errors, null pointer exceptions, infinite loops, type errors, race conditions
2. SECURITY ISSUES: SQL injection, XSS, CSRF, authentication bypasses, data exposure, path traversal
3. CODE SMELLS: Poor naming, duplicated code, complex functions, performance issues, architectural problems

As a professional reviewer, provide accurate line numbers and actionable recommendations.

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
          content: `Analyze this ${filePath} file${totalChunks > 1 ? ` (chunk ${chunkNum}/${totalChunks})` : ''}:

${code}`
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