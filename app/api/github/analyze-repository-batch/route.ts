import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

interface AnalysisResult {
  file: string
  bugs?: Array<{
    line: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  codeSmells?: Array<{
    line: number
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  securityIssues?: Array<{
    line: number
    severity: 'low' | 'medium' | 'high' | 'critical'
    type: string
    description: string
    suggestion: string
    codeSnippet?: string
  }>
  // New structured format
  issues?: Array<{
    file: string
    start_line: number
    end_line: number
    code: string
    error_type: 'Syntax' | 'Runtime' | 'Security' | 'Performance' | 'BestPractice' | 'Style'
    issue: string
    suggested_fix: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  // 🚀 ULTRA-FAST TIMEOUT HANDLING: Aggressive timeouts for large repos
  const TOTAL_TIMEOUT_MS = 20000 // 20 seconds total request timeout
  const PER_FILE_TIMEOUT_MS = 5000 // 5 seconds per individual file
  const BATCH_TIMEOUT_MS = 15000 // 15 seconds per micro-batch
  
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
    // 🚀 ANALYZE ALL BRANCHES - Find the branch with most code files
    console.log(`\n🌿 ANALYZING ALL BRANCHES for ${owner}/${repo}:`)
    
    // Get all branches
    const branchesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })
    
    if (!branchesResponse.ok) {
      throw new Error(`Failed to fetch branches: ${branchesResponse.status}`)
    }
    
    const branches = await branchesResponse.json()
    console.log(`   Found ${branches.length} branches:`, branches.map((b: any) => b.name))
    
    // Test each branch to find the one with most Python/code files
    let bestBranch = repoInfo.default_branch || 'main'
    let maxCodeFiles = 0
    let bestTreeData: any = null
    
    for (const branch of branches) {
      try {
        console.log(`   🔍 Testing branch: ${branch.name}`)
        
        const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch.name}?recursive=1`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Greptile-Clone'
          }
        })
        
        if (treeResponse.ok) {
          const treeData = await treeResponse.json()
          const pythonFiles = treeData.tree.filter((item: any) => 
            item.type === 'blob' && item.path.toLowerCase().endsWith('.py')
          ).length
          
          const allCodeFiles = treeData.tree.filter((item: any) => {
            if (item.type !== 'blob') return false
            const ext = item.path.split('.').pop()?.toLowerCase() || ''
            return ['py', 'js', 'ts', 'jsx', 'tsx', 'java', 'go', 'rs', 'php', 'rb', 'c', 'cpp', 'h', 'cs'].includes(ext)
          }).length
          
          console.log(`     📊 ${branch.name}: ${treeData.tree.length} total files, ${pythonFiles} Python files, ${allCodeFiles} code files`)
          
          if (allCodeFiles > maxCodeFiles) {
            maxCodeFiles = allCodeFiles
            bestBranch = branch.name
            bestTreeData = treeData
            console.log(`     ✅ New best branch: ${branch.name} (${allCodeFiles} code files)`)
          }
        } else {
          console.log(`     ❌ Failed to fetch ${branch.name}: ${treeResponse.status}`)
        }
      } catch (error) {
        console.log(`     ❌ Error testing branch ${branch.name}:`, error)
      }
    }
    
    console.log(`\n🎯 SELECTED BRANCH: ${bestBranch} (${maxCodeFiles} code files)`)
    
    // Use the best branch data
    const treeData = bestTreeData
    
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
      if (!hasCodeExtension) {
        return false
      }
      
      const isExcluded = excludePaths.some(excludePath => 
        item.path.toLowerCase().includes(excludePath.toLowerCase())
      )
      if (isExcluded) {
        return false
      }
      
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
    
    // 🔍 STEP 1: COMPLETE FILE INVENTORY - Show ALL files from GitHub API
    console.log(`\n📋 COMPLETE FILE INVENTORY for ${owner}/${repo}:`)
    console.log(`📊 Total files found by GitHub API: ${treeData.tree.length}`)
    
    // 🐍 PYTHON FILE ANALYSIS FOR ALL REPOS
    const pythonFilesInTree = treeData.tree.filter((item: any) => 
      item.type === 'blob' && item.path.toLowerCase().endsWith('.py')
    )
    if (pythonFilesInTree.length > 0) {
      console.log(`   🐍 Python files found: ${pythonFilesInTree.length}`)
      pythonFilesInTree.slice(0, 10).forEach((pyFile: any, index: number) => {
        const sizeKB = Math.round((pyFile.size || 0) / 1000)
        console.log(`     ${index + 1}. ${pyFile.path} (${sizeKB}KB)`)
      })
    }
    
    // Group and analyze all files
    const filesByExtension: { [key: string]: any[] } = {}
    let pythonFiles = 0
    let jsFiles = 0
    let totalCodeFiles = 0
    
    treeData.tree.forEach((file: any, index: number) => {
      if (file.type !== 'blob') return // Skip directories
      
      const ext = file.path.split('.').pop()?.toLowerCase() || 'no-ext'
      const isPython = ext === 'py'
      const isJavaScript = ['js', 'ts', 'jsx', 'tsx'].includes(ext)
      const isCode = [
        'py', 'js', 'ts', 'jsx', 'tsx', 'java', 'go', 'rs', 'php', 'rb', 
        'c', 'cpp', 'h', 'cs', 'swift', 'kt', 'scala', 'sh'
      ].includes(ext)
      
      if (!filesByExtension[ext]) filesByExtension[ext] = []
      filesByExtension[ext].push(file)
      
      if (isPython) pythonFiles++
      if (isJavaScript) jsFiles++
      if (isCode) totalCodeFiles++
      
      const prefix = isPython ? '🐍 PYTHON:' : 
                    isJavaScript ? '⚡ JS/TS:' : 
                    isCode ? '💻 CODE:' : 
                    '📄 OTHER:'
      
      console.log(`   ${index + 1}. ${prefix} ${file.path} (${file.size || 0} bytes)`)
    })
    
    // Show critical statistics
    console.log(`\n📊 CRITICAL FILE ANALYSIS:`)
    console.log(`   🐍 Python files found: ${pythonFiles}`)
    console.log(`   ⚡ JavaScript/TypeScript files: ${jsFiles}`)
    console.log(`   💻 Total code files: ${totalCodeFiles}`)
    console.log(`   📄 Other files: ${treeData.tree.length - totalCodeFiles}`)
    
    // Show file type breakdown
    console.log(`\n📊 FILE TYPE BREAKDOWN:`)
    Object.keys(filesByExtension).sort().forEach(ext => {
      const count = filesByExtension[ext].length
      const totalSize = filesByExtension[ext].reduce((sum, f) => sum + (f.size || 0), 0)
      const avgSize = count > 0 ? Math.round(totalSize / count) : 0
      console.log(`   .${ext}: ${count} files (${Math.round(totalSize/1000)}KB total, ${avgSize} bytes avg)`)
    })
    
    // Log file types breakdown
    const fileTypes: { [key: string]: number } = {}
    const fileSizes: { [key: string]: number[] } = {}
    treeData.tree.forEach((file: any) => {
      const ext = file.path.split('.').pop()?.toLowerCase() || 'no-ext'
      fileTypes[ext] = (fileTypes[ext] || 0) + 1
      if (!fileSizes[ext]) fileSizes[ext] = []
      fileSizes[ext].push(file.size || 0)
    })
    console.log(`   File types found:`, fileTypes)
    console.log(`   Python files specifically:`, fileTypes['py'] || 0)
    if (fileSizes['py']) {
      console.log(`   Python file sizes:`, fileSizes['py'].map(size => `${Math.round(size/1000)}KB`))
    }
    
    // 🔍 DEBUG: Show filtering process
    console.log(`📝 Code files that passed filtering:`)
    codeFiles.slice(0, 10).forEach((file: any, index: number) => {
      console.log(`   ${index + 1}. ${file.path} (${file.size || 0} bytes, type: ${file.type})`)
    })
    
    // 🔍 DEBUG: Show files that were filtered OUT
    const filteredOut = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false
      const hasCodeExtension = codeExtensions.some(ext => item.path.toLowerCase().endsWith(ext))
      if (!hasCodeExtension) return false
      const isExcluded = excludePaths.some(excludePath => 
        item.path.toLowerCase().includes(excludePath.toLowerCase())
      )
      return isExcluded // Return files that were excluded
    })
    
    if (filteredOut.length > 0) {
      console.log(`❌ FILES FILTERED OUT (${filteredOut.length}):`)
      filteredOut.forEach((file: any, index: number) => {
        console.log(`   ${index + 1}. ${file.path} (${file.size || 0} bytes) - EXCLUDED`)
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
    const MICRO_BATCH_SIZE = 1 // Ultra-small batches for large repos
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
          totalBugs += analysis.bugs?.length || 0
          totalSecurityIssues += analysis.securityIssues?.length || 0
          totalCodeSmells += analysis.codeSmells?.length || 0
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
      hasMoreBatches: true, // Continue processing despite errors
      nextBatchIndex: (batchIndex || 0) + 1,
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

    // 🚀 SMART FILE HANDLING: Skip extremely large files, chunk moderate ones
    const lines = content.split('\n')
    
    // Skip files that are too large to process efficiently
    if (lines.length > 1000) {
      console.log(`⚠️ Skipping very large file: ${file.path} (${lines.length} lines - too large for analysis)`)
      return null
    }
    
    const shouldChunk = lines.length > 200
    
    const analysis = await analyzeCodeWithAI(file.path, content, shouldChunk)
    
    if (analysis) {
      const bugCount = analysis.bugs?.length || 0
      const securityCount = analysis.securityIssues?.length || 0
      const smellCount = analysis.codeSmells?.length || 0
      console.log(`✅ ${file.path}: ${bugCount} bugs, ${securityCount} security, ${smellCount} smells`)
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

  // 🚀 ENTERPRISE CHUNKING: 150-200 line chunks with line number annotations
  if (needsChunking) {
    const lines = code.split('\n')
    console.log(`🔄 Chunking large file: ${filePath} (${lines.length} lines)`)
    
    const LINES_PER_CHUNK = 175 // Sweet spot: 150-200 lines
    const chunks: Array<{content: string, startLine: number, endLine: number}> = []
    
    for (let i = 0; i < lines.length; i += LINES_PER_CHUNK) {
      const chunkLines = lines.slice(i, i + LINES_PER_CHUNK)
      const startLine = i + 1
      const endLine = Math.min(i + LINES_PER_CHUNK, lines.length)
      
      // Add line number annotations for GPT context
      const annotatedContent = `# [Lines ${startLine}–${endLine}]\n` + chunkLines.join('\n')
      
      chunks.push({
        content: annotatedContent,
        startLine,
        endLine
      })
    }
    
    console.log(`📊 Created ${chunks.length} chunks of ~${LINES_PER_CHUNK} lines each`)
    
    const allIssues: any[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`🔍 Analyzing chunk ${i + 1}/${chunks.length}: lines ${chunk.startLine}-${chunk.endLine}`)
      
      const chunkResult = await analyzeSingleChunk(filePath, chunk.content, i + 1, chunks.length, chunk.startLine)
      if (chunkResult && chunkResult.issues) {
        allIssues.push(...chunkResult.issues)
      }
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    
    // Convert new format back to old format for compatibility
    const bugs = allIssues.filter(issue => ['Runtime', 'Syntax'].includes(issue.error_type))
    const securityIssues = allIssues.filter(issue => issue.error_type === 'Security')
    const codeSmells = allIssues.filter(issue => ['Performance', 'BestPractice', 'Style'].includes(issue.error_type))
    
    return {
      file: filePath,
      bugs: bugs.map(issue => ({
        line: issue.start_line,
        severity: issue.severity,
        type: issue.error_type,
        description: issue.issue,
        suggestion: issue.suggested_fix,
        codeSnippet: issue.code
      })),
      securityIssues: securityIssues.map(issue => ({
        line: issue.start_line,
        severity: issue.severity,
        type: issue.error_type,
        description: issue.issue,
        suggestion: issue.suggested_fix,
        codeSnippet: issue.code
      })),
      codeSmells: codeSmells.map(issue => ({
        line: issue.start_line,
        type: issue.error_type,
        description: issue.issue,
        suggestion: issue.suggested_fix,
        codeSnippet: issue.code
      }))
    }
  }

  // Handle single chunk (no chunking needed)
  const result = await analyzeSingleChunk(filePath, code, 1, 1, 1)
  
  if (result && result.issues) {
    // Convert new format to old format for compatibility
    const bugs = result.issues.filter((issue: any) => ['Runtime', 'Syntax'].includes(issue.error_type))
    const securityIssues = result.issues.filter((issue: any) => issue.error_type === 'Security')
    const codeSmells = result.issues.filter((issue: any) => ['Performance', 'BestPractice', 'Style'].includes(issue.error_type))
    
    return {
      file: filePath,
      bugs: bugs.map((issue: any) => ({
        line: issue.start_line,
        severity: issue.severity,
        type: issue.error_type,
        description: issue.issue,
        suggestion: issue.suggested_fix,
        codeSnippet: issue.code
      })),
      securityIssues: securityIssues.map((issue: any) => ({
        line: issue.start_line,
        severity: issue.severity,
        type: issue.error_type,
        description: issue.issue,
        suggestion: issue.suggested_fix,
        codeSnippet: issue.code
      })),
      codeSmells: codeSmells.map((issue: any) => ({
        line: issue.start_line,
        type: issue.error_type,
        description: issue.issue,
        suggestion: issue.suggested_fix,
        codeSnippet: issue.code
      }))
    }
  }
  
  return result
}

async function analyzeSingleChunk(filePath: string, code: string, chunkNum: number, totalChunks: number, startLineOffset: number = 1): Promise<AnalysisResult | null> {
  if (!openai) return null

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a static code analysis engine. Your task is to detect and classify errors and issues in the provided code.

### Rules:
1. Always return results in valid JSON.
2. Do not skip any issues.
3. Include:
   - file: filename
   - start_line: starting line number
   - end_line: ending line number (can be same as start_line for single-line issues)
   - code: the problematic code snippet
   - error_type: one of [Syntax, Runtime, Security, Performance, BestPractice, Style]
   - issue: explanation of what is wrong
   - suggested_fix: how to fix it
   - severity: one of [critical, high, medium, low]

### Output format (JSON only):
{
  "issues": [
    {
      "file": "filename.py",
      "start_line": 47,
      "end_line": 47,
      "code": "except:",
      "error_type": "BestPractice",
      "issue": "Bare exception catch hides real errors.",
      "suggested_fix": "Use 'except Exception as e:' and handle properly.",
      "severity": "medium"
    }
  ]
}

Detect all types of issues:
- Syntax: Parse errors, invalid syntax
- Runtime: Null pointer exceptions, infinite loops, type errors, race conditions
- Security: SQL injection, XSS, CSRF, authentication bypasses, data exposure, path traversal
- Performance: Inefficient algorithms, memory leaks, blocking operations
- BestPractice: Code smells, poor naming, duplicated code, complex functions
- Style: Formatting issues, naming conventions, documentation`
        },
        {
          role: "user",
          content: `### Input:
File: ${filePath}
Code chunk${totalChunks > 1 ? ` (lines ${startLineOffset}–${startLineOffset + code.split('\n').length - 1})` : ''}:

${code}

### Task:
Analyze the above code chunk and return ALL issues found in the specified JSON format. Include the exact problematic code in the "code" field.`
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const response = completion.choices[0].message.content
    if (!response) return null

    const analysis = JSON.parse(response)
    
    // Handle new structured format
    if (analysis.issues) {
      return {
        file: filePath,
        issues: analysis.issues
      }
    }
    
    // Fallback to old format for compatibility
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