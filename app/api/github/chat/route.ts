import { NextRequest, NextResponse } from 'next/server'

const GITHUB_API = 'https://api.github.com'

// Lazy import to avoid build issues if key missing at build time
let openai: any = null
try {
  // @ts-ignore
  const OpenAI = (await import('openai')).default
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
} catch {}

// Simple extension allowlist
const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.html', '.css', '.vue', '.svelte', '.sql', '.sh', '.yml', '.yaml', '.json', '.md']
const EXCLUDE_PATHS = ['node_modules', '.git', 'dist', 'build', 'vendor', 'deps', 'target', 'bin', 'obj', 'out', 'coverage', 'test', 'tests', '__pycache__', '.next', '.nuxt', 'public', 'static', 'assets', 'images', 'fonts']

export async function POST(req: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const { repoFullName, question, batchLimit = 8, maxFileBytes = 40_000, analysisResults } = await req.json()
    if (!repoFullName || !question) {
      return NextResponse.json({ error: 'repoFullName and question are required' }, { status: 400 })
    }

    const [owner, repo] = String(repoFullName).split('/')
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Invalid repoFullName. Use owner/repo' }, { status: 400 })
    }

    // Helper function for GitHub API calls with retry logic
    const fetchWithRetry = async (url: string, maxRetries = 3, timeoutMs = 12000) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔍 Attempt ${attempt}/${maxRetries}: ${url}`)
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Greptile-Clone',
              'Accept': 'application/vnd.github.v3+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          })
          
          clearTimeout(timeoutId)
          
          // If rate limited, wait and retry
          if (response.status === 403) {
            const rateLimitReset = response.headers.get('X-RateLimit-Reset')
            if (rateLimitReset && attempt < maxRetries) {
              const resetTime = parseInt(rateLimitReset) * 1000
              const waitTime = Math.min(resetTime - Date.now(), 60000) // Max 1 minute wait
              if (waitTime > 0) {
                console.log(`⏳ Rate limited. Waiting ${Math.round(waitTime/1000)}s before retry...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
                continue
              }
            }
          }
          
          return response
          
        } catch (error: any) {
          console.warn(`⚠️ Attempt ${attempt} failed:`, error.message)
          
          if (attempt === maxRetries) {
            throw error
          }
          
          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          const jitter = Math.random() * 1000
          const delay = baseDelay + jitter
          
          console.log(`⏱️ Waiting ${Math.round(delay)}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      throw new Error('Max retries exceeded')
    }

    // Fetch repo metadata with retry logic
    console.log(`🔍 Fetching repo metadata for ${owner}/${repo}`)
    let repoRes, treeRes, defaultBranch;
    try {
      repoRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}`)
      
      if (!repoRes.ok) {
        const text = await repoRes.text()
        console.error(`❌ GitHub API error for repo ${owner}/${repo}: ${repoRes.status} ${text}`)
        
        // Provide user-friendly error messages
        if (repoRes.status === 404) {
          return NextResponse.json({ error: 'Repository not found or is private' }, { status: 404 })
        } else if (repoRes.status === 403) {
          return NextResponse.json({ error: 'GitHub API rate limit exceeded. Please try again in a few minutes.' }, { status: 429 })
        } else {
          return NextResponse.json({ error: `GitHub API error: ${text}` }, { status: repoRes.status })
        }
      }
      
      console.log(`✅ Successfully fetched repo metadata for ${owner}/${repo}`)
      const repoMeta = await repoRes.json()
      defaultBranch = repoMeta.default_branch || 'main'

      // Fetch git tree with retry logic  
      console.log(`🔍 Fetching git tree for ${owner}/${repo} on branch ${defaultBranch}`)
      treeRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, 2, 20000)
      
      if (!treeRes.ok) {
        const text = await treeRes.text()
        console.error(`❌ GitHub tree API error: ${treeRes.status} ${text}`)
        
        if (treeRes.status === 404) {
          return NextResponse.json({ error: `Branch '${defaultBranch}' not found` }, { status: 404 })
        } else if (treeRes.status === 403) {
          return NextResponse.json({ error: 'GitHub API rate limit exceeded. Please try again in a few minutes.' }, { status: 429 })
        } else {
          return NextResponse.json({ error: `Failed to fetch repository files: ${text}` }, { status: treeRes.status })
        }
      }
      
      console.log(`✅ Successfully fetched git tree for ${owner}/${repo}`)
      
    } catch (error: any) {
      console.error(`❌ GitHub API error: ${error.message}`)
      
      if (error.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Request timed out. This repository might be too large or GitHub API is slow. Please try again.' 
        }, { status: 504 })
      }
      
      return NextResponse.json({ 
        error: 'Unable to connect to GitHub API. Please check your internet connection and try again.' 
      }, { status: 503 })
    }
    const treeData = await treeRes.json()

    // Filter candidate files
    const candidates: any[] = (treeData.tree || []).filter((item: any) => {
      if (item.type !== 'blob') return false
      const pathLower = String(item.path).toLowerCase()
      const hasExt = CODE_EXTENSIONS.some(ext => pathLower.endsWith(ext))
      if (!hasExt) return false
      const excluded = EXCLUDE_PATHS.some(ex => pathLower.includes(ex))
      if (excluded) return false
      return true
    })

    // Heuristic ranking by path match first
    const q = String(question).toLowerCase()
    const pathRanked = candidates.map((f: any) => {
      const p = String(f.path).toLowerCase()
      let score = 0
      // simple keyword scoring
      q.split(/[^a-z0-9_]+/).filter(Boolean).forEach(tok => {
        if (p.includes(tok)) score += 3
      })
      // prioritize shallower paths and smaller files
      const depth = p.split('/').length
      const size = f.size || 0
      score += Math.max(0, 4 - depth)
      score += size > 50_000 ? -2 : 1
      return { ...f, score }
    }).sort((a, b) => b.score - a.score)

    // Pull top N contents and refine ranking by content keyword hits
    const topPaths = pathRanked.slice(0, Math.min(batchLimit * 3, 120))

    const filesWithContent: { path: string; content: string; score: number }[] = []
    let fetchedCount = 0
    let failedCount = 0
    
    for (const item of topPaths) {
      try {
        console.log(`📄 Fetching content for: ${item.path}`)
        const blobRes = await fetchWithRetry(
          `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(item.path)}?ref=${defaultBranch}`,
          2, // Max 2 retries for individual files
          8000 // 8 second timeout per file
        )
        
        if (!blobRes.ok) {
          failedCount++
          console.warn(`⚠️ Failed to fetch ${item.path}: ${blobRes.status}`)
          continue
        }
        
        const blob = await blobRes.json()
        if (!blob.content) {
          console.warn(`⚠️ No content in ${item.path}`)
          continue
        }
        
        const buff = Buffer.from(blob.content, 'base64')
        let content = buff.toString('utf-8')
        if (content.length > maxFileBytes) {
          content = content.slice(0, maxFileBytes)
        }
        
        let cScore = 0
        const lower = content.toLowerCase()
        q.split(/[^a-z0-9_]+/).filter(Boolean).forEach(tok => {
          if (lower.includes(tok)) cScore += 5
        })
        
        filesWithContent.push({ path: item.path, content, score: item.score + cScore })
        fetchedCount++
        console.log(`✅ Successfully fetched ${item.path} (${fetchedCount}/${topPaths.length})`)
        
        // Stop if we have enough files
        if (fetchedCount >= batchLimit) break
        
      } catch (error: any) {
        failedCount++
        console.warn(`⚠️ Error fetching ${item.path}:`, error.message)
      }
      
      // Small delay to be nice to GitHub API
      await new Promise(r => setTimeout(r, 50))
    }
    
    console.log(`📊 File fetch summary: ${fetchedCount} successful, ${failedCount} failed`)
    
    // If we couldn't fetch any files, return an error
    if (filesWithContent.length === 0) {
      return NextResponse.json({ 
        error: 'Unable to fetch any repository files. The repository might be too large or have access restrictions.' 
      }, { status: 503 })
    }

    const ranked = filesWithContent.sort((a, b) => b.score - a.score).slice(0, batchLimit)

    // Build context with file headers; include line numbers via code fences style markers
    const contextBlocks = ranked.map(({ path, content }) => {
      return `FILE: ${path}\n-----\n${content}\n\n`
    }).join('\n')

    // Build analysis context if available
    let analysisContext = ''
    if (analysisResults && analysisResults.totalIssues > 0) {
      analysisContext = `

ANALYSIS RESULTS:
- Total Issues: ${analysisResults.totalIssues}
- Critical Issues: ${analysisResults.criticalIssues || 0}
- High Priority Issues: ${analysisResults.highIssues || 0}
- Medium Priority Issues: ${analysisResults.mediumIssues || 0}
- Issue Categories: ${analysisResults.categories?.join(', ') || 'None'}

SPECIFIC ISSUES FOUND:
${analysisResults.issues?.slice(0, 10).map((issue: any, index: number) => 
  `${index + 1}. ${issue.file}:${issue.line} - ${issue.severity.toUpperCase()}: ${issue.type}
     Problem: ${issue.message}
     Suggestion: ${issue.suggestion || 'No suggestion provided'}`
).join('\n') || 'No specific issues listed'}${analysisResults.issues?.length > 10 ? `\n... and ${analysisResults.issues.length - 10} more issues` : ''}
`
    }

    const systemPrompt = `You are an expert codebase assistant with COMPLETE knowledge of this repository's code AND its security analysis results. 

${analysisContext}

Answer the user's question using the provided files and analysis results. When discussing issues:
- Reference specific files, line numbers, and code snippets
- Explain the security/quality implications
- Provide actionable recommendations
- Cite the exact analysis findings when relevant

IMPORTANT: You must return ONLY valid JSON in this exact format:
{
  "answer": "Your detailed answer here with analysis insights",
  "citations": [{"file": "filename.js", "lines": [1, 5], "snippet": "code snippet"}]
}

Do not include any text before or after the JSON. Do not use markdown code blocks.`

    const userPrompt = `Question: ${question}\n\nRelevant repository files:\n${contextBlocks}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content || ''
    let parsed: any = null
    
    try { 
      parsed = JSON.parse(raw) 
      console.log('✅ Successfully parsed JSON:', parsed)
    } catch (parseError) { 
      console.log('❌ JSON parsing failed, raw content:', raw)
      parsed = { answer: raw, citations: [] } 
    }

    const finalAnswer = parsed.answer || parsed.response || raw
    console.log('🎯 Final answer being returned:', finalAnswer)

    return NextResponse.json({
      repoFullName,
      defaultBranch,
      filesUsed: ranked.map(f => f.path),
      answer: finalAnswer,
      citations: parsed.citations || [],
      analysisUsed: analysisResults ? {
        totalIssues: analysisResults.totalIssues,
        criticalIssues: analysisResults.criticalIssues || 0,
        categories: analysisResults.categories || []
      } : null
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
} 