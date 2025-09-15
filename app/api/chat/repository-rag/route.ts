import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface FileContent {
  path: string;
  content: string;
  size: number;
  type: string;
}

interface AnalysisIssue {
  file: string;
  line: number;
  type: string;
  severity: string;
  message: string;
  suggestion: string;
}

interface AnalysisResults {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  categories: string[];
  issues: AnalysisIssue[];
}

export async function POST(request: NextRequest) {
  try {
    const { analysisId, repository, question, analysisResults } = await request.json();
    
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }
    
    // Get repository files from the cache that Lambda already populated
    console.log(`🔍 RAG: Getting files from repository cache for analysisId=${analysisId}`);
    
    const repoResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://master.d3dp89x98knsw0.amplifyapp.com'}/api/chat/repository-files?analysisId=${analysisId}&repository=${encodeURIComponent(repository)}`);
    
    if (!repoResponse.ok) {
      console.log(`❌ Repository files not found in cache (${repoResponse.status})`);
      return NextResponse.json({ error: 'Repository files not found in persistent storage' }, { status: 404 });
    }
    
    const repoData = await repoResponse.json();
    console.log(`✅ Retrieved ${repoData.filesCount} files from repository cache`);
    
    // Use the files from the repository cache
    const files: FileContent[] = repoData.files;
    console.log(`✅ Found ${files.length} code files in repository`);
    
    // Filter and rank files based on question relevance
    const questionLower = question.toLowerCase();
    
    // Simple relevance scoring
    const rankedFiles = files.map(file => {
      let score = 0;
      const pathLower = file.path.toLowerCase();
      const contentLower = file.content.toLowerCase();
      
      // Path relevance
      questionLower.split(/\s+/).forEach((word: string) => {
        if (pathLower.includes(word)) score += 3;
        if (contentLower.includes(word)) score += 1;
      });
      
      // File type relevance
      if (file.type === 'py' && questionLower.includes('python')) score += 2;
      if (file.type === 'js' && questionLower.includes('javascript')) score += 2;
      if (file.type === 'ts' && questionLower.includes('typescript')) score += 2;
      
      // Size penalty for very large files
      if (file.size > 50000) score -= 1;
      
      return { ...file, score };
    }).sort((a, b) => b.score - a.score);
    
    // Take top 8 most relevant files
    const topFiles = rankedFiles.slice(0, 8);
    
    // Build context with file contents
    const fileContext = topFiles.map(file => {
      // Truncate very large files
      const content = file.content.length > 20000 
        ? file.content.substring(0, 20000) + '\n... (truncated)'
        : file.content;
        
      return `FILE: ${file.path}\n-----\n${content}\n\n`;
    }).join('');
    
    // Build analysis context
    let analysisContext = '';
    if (analysisResults && analysisResults.totalIssues > 0) {
      analysisContext = `
SECURITY & QUALITY ANALYSIS:
- Total Issues: ${analysisResults.totalIssues}
- Critical Issues: ${analysisResults.criticalIssues}
- High Priority: ${analysisResults.highIssues}
- Medium Priority: ${analysisResults.mediumIssues}
- Categories: ${analysisResults.categories.join(', ')}

SPECIFIC ISSUES FOUND:
${analysisResults.issues.map((issue: AnalysisIssue, index: number) => 
  `${index + 1}. ${issue.file}:${issue.line} - ${issue.severity.toUpperCase()}: ${issue.type}
     Problem: ${issue.message}
     Fix: ${issue.suggestion}`
).join('\n')}
`;
    }
    
    const systemPrompt = `You are an expert code analyst with COMPLETE access to the repository "${repository}". 
You have the full source code and comprehensive security analysis results.

${analysisContext}

REPOSITORY FILES:
${fileContext}

You have COMPLETE knowledge of this codebase. Answer questions about:
- Code structure and architecture
- Security vulnerabilities and fixes
- Function implementations and usage
- File relationships and dependencies
- Performance optimizations
- Best practices and improvements

Always cite specific files, line numbers, and code snippets when relevant.
Provide actionable, detailed responses based on the actual code and analysis results.

IMPORTANT: Provide a clear, detailed answer in plain text. Include specific file names and line numbers when referencing code.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    });

    const answer = completion.choices?.[0]?.message?.content || '';
    
    // Extract citations from the answer text (look for file mentions)
    const citations: Array<{file: string, lines?: number[], snippet?: string}> = [];
    topFiles.forEach(file => {
      if (answer.toLowerCase().includes(file.path.toLowerCase())) {
        citations.push({
          file: file.path,
          snippet: file.content.substring(0, 200) + '...'
        });
      }
    });

    return NextResponse.json({
      success: true,
      answer: answer,
      citations: citations,
      filesUsed: topFiles.map(f => f.path),
      analysisUsed: analysisResults ? {
        totalIssues: analysisResults.totalIssues,
        criticalIssues: analysisResults.criticalIssues,
        categories: analysisResults.categories
      } : null,
      source: 'persistent-repository'
    });
    
  } catch (error) {
    console.error('❌ RAG chat error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}