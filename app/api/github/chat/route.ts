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

    const { repoFullName, question, batchLimit = 12, maxFileBytes = 60_000 } = await req.json()
    if (!repoFullName || !question) {
      return NextResponse.json({ error: 'repoFullName and question are required' }, { status: 400 })
    }

    const [owner, repo] = String(repoFullName).split('/')
    if (!owner || !repo) {
      return NextResponse.json({ error: 'Invalid repoFullName. Use owner/repo' }, { status: 400 })
    }

    // Detect default branch
    const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`)
    if (!repoRes.ok) {
      const text = await repoRes.text()
      return NextResponse.json({ error: `Failed to fetch repo: ${repoRes.status} ${text}` }, { status: repoRes.status })
    }
    const repoMeta = await repoRes.json()
    const defaultBranch = repoMeta.default_branch || 'main'

    // Fetch tree
    const treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`)
    if (!treeRes.ok) {
      const text = await treeRes.text()
      return NextResponse.json({ error: `Failed to fetch tree: ${treeRes.status} ${text}` }, { status: treeRes.status })
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
    for (const item of topPaths) {
      try {
        const blobRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(item.path)}?ref=${defaultBranch}`)
        if (!blobRes.ok) continue
        const blob = await blobRes.json()
        if (!blob.content) continue
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
      } catch {}
      // tiny delay to be nice to GitHub API
      await new Promise(r => setTimeout(r, 10))
    }

    const ranked = filesWithContent.sort((a, b) => b.score - a.score).slice(0, batchLimit)

    // Build context with file headers; include line numbers via code fences style markers
    const contextBlocks = ranked.map(({ path, content }) => {
      return `FILE: ${path}\n-----\n${content}\n\n`
    }).join('\n')

    const systemPrompt = `You are an expert codebase assistant. Answer the user's question using ONLY the provided files. 
When you cite code, include the exact line(s) and a short snippet in your answer. 
Return JSON with: { "answer": string, "citations": [{"file": string, "lines": [start, end], "snippet": string}] }.`

    const userPrompt = `Question: ${question}\n\nRelevant repository files:\n${contextBlocks}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content || ''
    let parsed: any = null
    try { parsed = JSON.parse(raw) } catch { parsed = { answer: raw, citations: [] } }

    return NextResponse.json({
      repoFullName,
      defaultBranch,
      filesUsed: ranked.map(f => f.path),
      answer: parsed.answer || raw,
      citations: parsed.citations || [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
} 