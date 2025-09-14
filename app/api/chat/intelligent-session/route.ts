import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Type definitions
interface FileIntelligence {
  language: string;
  functions: Array<{ name: string; line: number; async: boolean }>;
  imports: string[];
  exports: number[];
  classes: Array<{ name: string; line: number }>;
  variables: Array<{ name: string; type: string; line: number }>;
  dependencies: string[];
  patterns: string[];
  complexity: {
    lines: number;
    functions: number;
    classes: number;
    imports: number;
    exports: number;
    comments: number;
  };
}

interface FileContent {
  name: string;
  path: string;
  content: string;
  lines?: number;
  type?: string;
  intelligence?: FileIntelligence;
}

interface RepoStructure {
  mainFiles: string[];
  testFiles: string[];
  configFiles: string[];
  documentation: string[];
  services: string[];
  components: string[];
  utils: string[];
}

interface Context {
  repository: string;
  analysisResults: any;
  files: { [key: string]: FileContent };
  functions: { [key: string]: any };
  structure: {
    mainFiles: string[];
    testFiles: string[];
    configFiles: string[];
    documentation: string[];
    services: string[];
    components: string[];
    utils: string[];
  };
}

// Global type declaration for session contexts and cloned repos
declare global {
  var sessionContexts: Map<string, any>;
  var clonedRepos: Map<string, { path: string, lastAccessed: number }>;
}

// Initialize global maps
if (!global.sessionContexts) {
  global.sessionContexts = new Map();
}
if (!global.clonedRepos) {
  global.clonedRepos = new Map();
}

// Initialize global maps
if (!global.clonedRepos) {
  global.clonedRepos = new Map();
}

// Cleanup old repos every hour
setInterval(() => {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  
  Array.from(global.clonedRepos.entries()).forEach(([repo, info]) => {
    if (now - info.lastAccessed > ONE_HOUR) {
      try {
        execSync(`rm -rf "${info.path}"`, { stdio: 'ignore' });
        global.clonedRepos.delete(repo);
        console.log(`🧹 Cleaned up old repo clone: ${repo}`);
      } catch (err) {
        console.warn(`Failed to cleanup repo ${repo}:`, err);
      }
    }
  });
}, 60 * 60 * 1000); // Run every hour

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Clone repository and analyze its contents
async function cloneAndAnalyzeRepo(repository: string) {
  try {
    // Check if we already have this repo cloned
    const existingClone = global.clonedRepos.get(repository);
    if (existingClone) {
      existingClone.lastAccessed = Date.now();
      console.log('📦 Using existing repo clone:', existingClone.path);
      return existingClone.path;
    }

    // Create temp directory
    const tempDir = path.join(os.tmpdir(), `chat-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    console.log('📥 Cloning repository for chat...');
    execSync(
      `git clone --depth 1 --single-branch --no-tags "https://github.com/${repository}.git" "${tempDir}"`,
      { stdio: 'ignore' }
    );

    // Store in global map
    global.clonedRepos.set(repository, {
      path: tempDir,
      lastAccessed: Date.now()
    });

    console.log('✅ Repository cloned successfully:', tempDir);
    return tempDir;

  } catch (error) {
    console.error('❌ Failed to clone repository:', error);
    return null;
  }
}

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
    
    // Using the global Context interface

    // Get context from session storage
    const key = sessionId || `repo:${repository}`;
    console.log('🔍 Looking for context with key:', key);
    
    if (!global.sessionContexts) {
      global.sessionContexts = new Map();
      console.log('⚠️ Initializing new sessionContexts Map');
    }

    const sessionContext = global.sessionContexts.get(key);
    console.log('📊 Session context found:', sessionContext ? 'yes' : 'no');
    console.log('🗝️ Available session keys:', Array.from(global.sessionContexts.keys()));
    console.log('📦 Session context details:', sessionContext ? Object.keys(sessionContext) : 'null');

    if (!sessionContext) {
      console.warn(`⚠️ No session context found for ${repository}`);
      return NextResponse.json({ error: 'Session context not found - please run analysis first' }, { status: 404 });
    }

    // Before building context
    if (sessionContext) {
      console.log('📊 Session files:', Object.keys(sessionContext.files));
      console.log('📊 Session structure:', sessionContext.structure);
    }

    // Build context from session
    const context: Context = {
      repository,
      analysisResults,
      files: sessionContext.files || {},
      functions: sessionContext.functions || {},
      structure: {
        mainFiles: sessionContext.structure?.mainFiles || [],
        testFiles: sessionContext.structure?.testFiles || [],
        configFiles: sessionContext.structure?.configFiles || [],
        documentation: sessionContext.structure?.documentation || [],
        services: sessionContext.structure?.services || [],
        components: sessionContext.structure?.components || [],
        utils: sessionContext.structure?.utils || []
      }
    }

    // Log context stats
    console.log('📊 Context stats:', {
      filesCount: Object.keys(context.files).length,
      functionsCount: Object.keys(context.functions).length,
      mainFiles: context.structure.mainFiles.length,
      analysisIssues: context.analysisResults?.totalIssues
    });

    // Log context stats
    console.log(`📊 Using context: ${Object.keys(context.files).length} files from session storage`);
    if (!Object.keys(context.files).length) {
      console.warn('⚠️ No files found in session context - chat may have limited functionality');
    }
    
    console.log(`📊 Using context: ${Object.keys(context.files).length} files from GitHub`)
    console.log(`📊 Analysis results: ${analysisResults.totalIssues} issues (${analysisResults.criticalIssues} critical)`)
    
    // Build enhanced context for AI
    const enhancedContext = {
      repository,
      files: context.files,
      functions: context.functions || {},
      structure: context.structure,
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
async function generateIntelligentResponse(userMessage: string, context: Context, chatHistory: any[] = []) {
  const systemPrompt = `You are an expert code analyst with complete knowledge of the repository "${context.repository}". 

REPOSITORY INTELLIGENCE:
Files & Structure:
- Total Files: ${Object.keys(context.files).length} files analyzed
- Total Lines: ${Object.values(context.files).reduce((sum, file: any) => sum + file.lines, 0)} lines of code
- Languages: ${Array.from(new Set(Object.values(context.files).map((f: any) => f.type))).join(', ')}

Code Organization:
- Main Files: ${context.structure?.mainFiles?.length || 0}
- Services: ${context.structure?.services?.length || 0}
- Components: ${context.structure?.components?.length || 0}
- Utils: ${context.structure?.utils?.length || 0}
- Tests: ${context.structure?.testFiles?.length || 0}
- Config: ${context.structure?.configFiles?.length || 0}
- Docs: ${context.structure?.documentation?.length || 0}

Code Intelligence:
- Functions: ${Object.values(context.files).reduce((sum, file: any) => sum + (file.intelligence?.complexity?.functions || 0), 0)}
- Classes: ${Object.values(context.files).reduce((sum, file: any) => sum + (file.intelligence?.complexity?.classes || 0), 0)}
- Imports: ${Object.values(context.files).reduce((sum, file: any) => sum + (file.intelligence?.complexity?.imports || 0), 0)}
- Exports: ${Object.values(context.files).reduce((sum, file: any) => sum + (file.intelligence?.complexity?.exports || 0), 0)}
- Comments: ${Object.values(context.files).reduce((sum, file: any) => sum + (file.intelligence?.complexity?.comments || 0), 0)}

Common Patterns:
${Array.from(new Set(Object.values(context.files).flatMap((f: any) => f.intelligence?.patterns || []))).map(pattern => `- ${pattern}`).join('\n')}

Analysis Results:
- Total Issues: ${context.analysisResults?.totalIssues || 0}
- Critical Issues: ${context.analysisResults?.criticalIssues || 0}
- Categories: ${context.analysisResults?.categories?.join(', ') || 'None'}

FILE CONTENTS:
${Object.entries(context.files).map(([path, file]: [string, FileContent]) => `
${path}:
${file.content}`).join('\n')}

You have COMPLETE access to all file contents above. When describing the repository:
1. DO NOT say there are no files if files exist in the context
2. Always check the actual file contents before making statements about the code
3. Be specific about what you find in the files
4. Cite specific code examples when relevant
5. If you see security issues, explain them clearly with the actual code context

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
    console.error('Context used:', {
      filesCount: Object.keys(context.files).length,
      messageLength: userMessage.length,
      promptLength: systemPrompt.length
    })
    throw new Error('Failed to generate intelligent response')
  }
}

// Extract detailed file intelligence
function extractFileIntelligence(content: string, filePath: string): FileIntelligence {
  const lines = content.split('\n');
  const intelligence: FileIntelligence = {
    language: path.extname(filePath).slice(1),
    functions: [],
    imports: [],
    exports: [],
    classes: [],
    variables: [],
    dependencies: [],
    patterns: [],
    complexity: {
      lines: lines.length,
      functions: 0,
      classes: 0,
      imports: 0,
      exports: 0,
      comments: 0
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Count comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      intelligence.complexity.comments++;
    }
    
    // Detect imports
    if (trimmed.match(/^(import|require|from|using)\s/)) {
      intelligence.complexity.imports++;
      const importMatch = trimmed.match(/['"](.*?)['"]/);
      if (importMatch) {
        intelligence.imports.push(importMatch[1]);
        intelligence.dependencies.push(importMatch[1]);
      }
    }
    
    // Detect exports
    if (trimmed.match(/^(export|module\.exports)/)) {
      intelligence.complexity.exports++;
      intelligence.exports.push(index + 1);
    }
    
    // Detect functions
    if (trimmed.match(/^(function|const|let|var|async)\s+\w+\s*\(/)) {
      intelligence.complexity.functions++;
      const funcMatch = trimmed.match(/\s+(\w+)\s*\(/);
      if (funcMatch) {
        intelligence.functions.push({
          name: funcMatch[1],
          line: index + 1,
          async: trimmed.startsWith('async')
        });
      }
    }
    
    // Detect classes
    if (trimmed.match(/^class\s+\w+/)) {
      intelligence.complexity.classes++;
      const classMatch = trimmed.match(/class\s+(\w+)/);
      if (classMatch) {
        intelligence.classes.push({
          name: classMatch[1],
          line: index + 1
        });
      }
    }
    
    // Detect variables
    if (trimmed.match(/^(const|let|var)\s+\w+\s*=/)) {
      const varMatch = trimmed.match(/(const|let|var)\s+(\w+)\s*=/);
      if (varMatch) {
        intelligence.variables.push({
          name: varMatch[2],
          type: varMatch[1],
          line: index + 1
        });
      }
    }
    
    // Detect common patterns
    if (trimmed.match(/new\s+(Promise|Set|Map|WeakMap|WeakSet)/)) {
      if (!intelligence.patterns.includes('Built-in Objects')) {
        intelligence.patterns.push('Built-in Objects');
      }
    }
    if (trimmed.match(/\.(map|filter|reduce|forEach)\(/)) {
      if (!intelligence.patterns.includes('Functional Programming')) {
        intelligence.patterns.push('Functional Programming');
      }
    }
    if (trimmed.match(/try\s*{/)) {
      if (!intelligence.patterns.includes('Error Handling')) {
        intelligence.patterns.push('Error Handling');
      }
    }
    if (trimmed.match(/async|await|\.then\(/)) {
      if (!intelligence.patterns.includes('Async Programming')) {
        intelligence.patterns.push('Async Programming');
      }
    }
  });

  return {
    ...intelligence,
    patterns: Array.from(intelligence.patterns)
  };
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
