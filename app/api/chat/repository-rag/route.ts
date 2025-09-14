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
    
    // Get repository files from persistent storage
    const repoResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/chat/repository-files?analysisId=${analysisId}&repository=${encodeURIComponent(repository)}`);
    
    if (!repoResponse.ok) {
      console.log('❌ Repository files not found, returning 404');
      return NextResponse.json({ error: 'Repository files not found in persistent storage' }, { status: 404 });
    }
    
    const repoData = await repoResponse.json();
    console.log(`✅ Retrieved ${repoData.filesCount} files from persistent storage`);
    
    // Filter and rank files based on question relevance
    const files: FileContent[] = repoData.files;
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
${analysisResults.issues.map((issue, index) => 
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

IMPORTANT: Return ONLY valid JSON in this format:
{
  "answer": "Your detailed answer with code insights and security analysis",
  "citations": [{"file": "filename.py", "lines": [1, 5], "snippet": "code snippet"}]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    });

    const rawResponse = completion.choices?.[0]?.message?.content || '';
    
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawResponse);
    } catch (parseError) {
      console.warn('❌ JSON parsing failed, using raw response');
      parsed = { answer: rawResponse, citations: [] };
    }

    return NextResponse.json({
      success: true,
      answer: parsed.answer || parsed.response || rawResponse,
      citations: parsed.citations || [],
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
