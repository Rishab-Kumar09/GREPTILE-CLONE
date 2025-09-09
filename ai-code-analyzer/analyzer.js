const OpenAI = require('openai');
const fs = require('fs-extra');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const analysisLogger = require('./analysis-logger');

// EXACTLY like main app
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log('🔑 OpenAI API Key status:', OPENAI_API_KEY ? 'FOUND' : 'MISSING');

// Initialize OpenAI (EXACTLY like main app)
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

class SingleFileAnalyzer {
  constructor() {
    this.results = [];
  }

  // 🎯 CRITICAL BUG DETECTION PROMPT
  createAnalysisPrompt(fileName, fileContent, chunkInfo = { isChunk: false, index: 0, total: 1 }) {
    const ext = path.extname(fileName).toLowerCase();
    const fileType = ext.substring(1); // Remove the dot

    return `You are a senior software engineer specializing in ${fileType.toUpperCase()} development and security. Your task is to find EVERY possible issue in this code, including:

1. SECURITY ISSUES:
   - Authentication/Authorization bypass
   - Injection vulnerabilities (SQL, Command, etc.)
   - Information disclosure
   - TRULY Hardcoded secrets (e.g. "api_key='1234'")
   - NOT false positives like os.getenv() or process.env
   - Unsafe data handling
   - Missing input validation
   - Insecure configurations

CRITICAL - READ CAREFULLY:

1. SECURE CREDENTIAL HANDLING - DO NOT FLAG THESE:
   - os.getenv('ANY_KEY_NAME')      // ✅ GOOD: from env var
   - process.env.ANY_KEY_NAME       // ✅ GOOD: from env var
   - config.get('any-key-name')     // ✅ GOOD: from config
   - secrets.get('any-key-name')    // ✅ GOOD: from secret manager
   Even if you see these patterns multiple times, they are SECURE practices!

2. ACTUAL HARDCODED CREDENTIALS - FLAG THESE:
   - api_key = 'sk-1234'           // ❌ BAD: actual key in code
   - API_KEY = '5678'              // ❌ BAD: actual key in code
   - DEFAULT_KEY = 'abcd'          // ❌ BAD: actual key in code

3. ABOUT FILE CONTENTS:
   - A Python file can contain HTML/JS/CSS in strings
   - Don't assume file type mismatch just from content
   - Look for actual syntax/logic issues instead

2. CODE QUALITY ISSUES:
   - Memory leaks
   - Resource exhaustion
   - Race conditions
   - Deadlock potential
   - Infinite loops
   - Null pointer issues
   - Type conversion errors

3. LOGIC ISSUES:
   - Business logic flaws
   - Incorrect error handling
   - Edge cases not handled
   - Assumptions about data
   - Missing validations
   - Incorrect calculations

4. PERFORMANCE ISSUES:
   - Inefficient algorithms
   - Unnecessary operations
   - Memory/CPU bottlenecks
   - Resource waste
   - Scaling problems

IMPORTANT CHUNK INFORMATION:
${chunkInfo.isChunk ? `This is PART ${chunkInfo.index + 1} OF ${chunkInfo.total} of the file.
- Focus on finding issues in THIS CHUNK only
- If you see part of a potential issue that might continue in other chunks, mark it as "POTENTIAL ISSUE - NEEDS CONTEXT"
- If you see a reference to something defined in another chunk, note it as "CROSS-CHUNK REFERENCE"` 
: 'This is the complete file to analyze.'}

Your task is to find EVERY possible issue in this code section, but stay focused on your assigned chunk.

YOUR RESPONSE MUST BE IN THIS EXACT FORMAT:

PART 1 - CRITICAL ISSUES:
=== CRITICAL ISSUES START ===
For each issue found:
ISSUE #:
- SEVERITY: (Critical/High/Medium/Low)
- CATEGORY: (Security/Code Quality/Logic/Performance)
- TYPE: Specific issue type from the categories above
- CHUNK_CONTEXT: (Complete issue in this chunk/Needs more context/Cross-chunk reference)
- LOCATION: Exact line numbers and function/class names
- DESCRIPTION: Detailed explanation of the issue
- IMPACT: What could go wrong and how bad it would be
- PROOF: The exact code snippet showing the issue
- REPRODUCTION: Steps to trigger/demonstrate the issue
- FIX: Exact code changes needed to fix it
- ALTERNATIVES: Other possible ways to fix it
- PREVENTION: How to prevent similar issues
- RELATED_CHUNKS: Note any other chunks that might be relevant to this issue
=== CRITICAL ISSUES END ===

OR if no issues found:
=== NO CRITICAL ISSUES START ===
(Explain why the code is safe)
=== NO CRITICAL ISSUES END ===

PART 2 - ANALYSIS:
=== ANALYSIS START ===
1. What you checked for:
   - Security vulnerabilities (SQL injection, XSS, CSRF, etc.)
   - Critical logic errors that could cause data loss/corruption
   - Authentication/authorization bypass risks
   - Input validation issues
   - Unsafe data handling
   - Memory leaks and resource exhaustion
   - Race conditions
   - Code that could crash the application

2. For SQL/Database code:
   - SQL injection through string concatenation
   - Missing input validation
   - Unsafe escaping methods
   - Direct user input in queries
   - Improper parameter binding
=== ANALYSIS END ===

STOP! Before ANY other output, you MUST start with EXACTLY ONE of these two blocks:

If you find ANY issues, start with:
=== CRITICAL ISSUES START ===
ISSUE 1:
- SEVERITY: (Critical/High/Medium/Low)
- CATEGORY: (Security/Code Quality/Logic/Performance)
- TYPE: Specific issue type from the categories above
- CHUNK_CONTEXT: (Complete issue in this chunk/Needs more context/Cross-chunk reference)
- LOCATION: Exact line numbers and function/class names
- DESCRIPTION: Detailed explanation of the issue
- IMPACT: What could go wrong and how bad it would be
- PROOF: The exact code snippet showing the issue
- REPRODUCTION: Steps to trigger/demonstrate the issue
- FIX: Exact code changes needed to fix it
- ALTERNATIVES: Other possible ways to fix it
- PREVENTION: How to prevent similar issues
- RELATED_CHUNKS: Note any other chunks that might be relevant to this issue

ISSUE 2: (if more issues found)
... (repeat same format)
=== CRITICAL ISSUES END ===

OR if you find NO issues, start with:
=== NO CRITICAL ISSUES START ===
(Explain in detail why the code is safe)
=== NO CRITICAL ISSUES END ===

YOU MUST START WITH ONE OF THESE TWO BLOCKS!

🎯 IMPORTANT: YOU MUST FIRST LIST ALL ISSUES IN THE ABOVE FORMAT, THEN EXPLAIN YOUR ANALYSIS PROCESS!

First write "ANALYSIS METHODOLOGY:" and explain:
1. What functions/patterns you looked at and why
2. How you analyzed each part of the code
3. What specific checks you performed
4. How you validated potential issues
5. What criteria you used to determine severity

Then write "DETAILED FINDINGS:" and explain what you found, including:
1. Any patterns or issues discovered
2. Why they are or aren't critical
3. Your confidence level in each finding
4. Specific code examples

After that, write "FINAL RESULTS:" and provide your conclusion.

Finally, and most importantly, write "REPLICATION GUIDE:" and explain:
1. How would you replicate this exact analysis WITHOUT using AI?
2. What specific regex patterns, AST traversals, or code checks would you implement?
3. Provide a step-by-step algorithm or pseudo-code for each type of check
4. Include a logic diagram or flowchart showing how the checks should be connected
5. List any edge cases that automated checks should handle

Then write "OPTIMIZATION GUIDE:" and explain:
1. How to avoid over-analysis and false positives when checking this type of file
2. What patterns are safe to ignore vs what needs deep inspection
3. How to handle files with no context about the rest of the repo
4. What confidence thresholds to use for different types of issues
5. How to prioritize which files to analyze first in a large repo
6. What specific checks to skip if we're optimizing for speed AND accuracy

📁 FILE: ${fileName}
📝 CODE:
\`\`\`
${fileContent}
\`\`\`

IMPORTANT CHUNK HANDLING:
1. If this is part of a larger file (indicated above), focus ONLY on this part
2. Do NOT make assumptions about other parts of the file
3. If you find issues, report them in the CRITICAL ISSUES section
4. In the FINAL RESULTS section, only talk about what you found in THIS part

Remember: FIRST list any issues found, THEN methodology, findings, results, replication guide, and optimization guide.`;
  }

  // 🧠 Analyze single file with ChatGPT
  async analyzeSingleFile(filePath) {
    try {
      console.log(`🔍 Analyzing: ${filePath}`);
      
      // Read file content (from local file or URL)
      let fileContent;
      if (filePath.startsWith('http')) {
        console.log(`🌐 Fetching from URL: ${filePath}`);
        const response = await fetch(filePath);
        fileContent = await response.text();
      } else {
        console.log(`📂 Reading local file: ${filePath}`);
        try {
          // Try reading as absolute path first
          fileContent = await fs.readFile(filePath, 'utf8');
        } catch (error) {
          // If that fails, try relative to project root
          const projectRoot = process.cwd();
          const absolutePath = path.resolve(projectRoot, '..', filePath);
          console.log(`📂 Trying project root path: ${absolutePath}`);
          fileContent = await fs.readFile(absolutePath, 'utf8');
        }
      }
      const fileName = path.basename(filePath);
      
      // Split large files into chunks
      const MAX_CHUNK_SIZE = 4000; // About 4K tokens for GPT-4
      const MIN_CHUNKS = 3; // Don't split into too many chunks
      
      let chunks = [];
      if (fileContent.length > MAX_CHUNK_SIZE * 2) { // Only split if really needed
        console.log(`📑 Large file detected (${fileContent.length} chars) - splitting into chunks...`);
        
        // Split by functions/classes if possible
        const lines = fileContent.split('\n');
        let currentChunk = [];
        let currentSize = 0;
        
        // Calculate optimal chunk size to avoid too many chunks
        const chunkSize = Math.max(
          MAX_CHUNK_SIZE,
          Math.ceil(fileContent.length / MIN_CHUNKS)
        );
        
        for (const line of lines) {
          // Start new chunk if:
          // 1. Current chunk is too big, AND
          // 2. We're at a good splitting point (empty line or function/class definition)
          if (currentSize > chunkSize && (
            line.trim() === '' ||
            line.match(/^(class|function|def|impl|pub|fn|void|int|async)/)
          )) {
            chunks.push(currentChunk.join('\n'));
            currentChunk = [];
            currentSize = 0;
          }
          
          currentChunk.push(line);
          currentSize += line.length + 1; // +1 for newline
        }
        
        // Add the last chunk
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
        }
        
        console.log(`📦 Split into ${chunks.length} chunks`);
      } else {
        chunks = [fileContent];
      }

      // Skip non-code files
      const ext = path.extname(filePath).toLowerCase();
      const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cc', '.h', '.hpp', '.php'];
      
      if (!codeExtensions.includes(ext)) {
        console.log(`⏭️ Skipping ${fileName} - not a code file`);
        return {
          fileName,
          criticalBugs: [],
          summary: { totalCriticalIssues: 0, riskLevel: 'low' },
          skipped: 'Not a code file'
        };
      }

      // EXACTLY like main app
      if (!OPENAI_API_KEY) {
        console.log('⚠️ No OpenAI API key - skipping AI analysis');
        return {
          fileName,
          criticalBugs: [],
          summary: { totalCriticalIssues: 0, riskLevel: 'low' }
        };
      }

      console.log(`🧠 Analyzing file in ${chunks.length} chunks...`);
      
      // Analyze each chunk
      let allResponses = [];
      let hasIssues = false;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkName = chunks.length > 1 ? `${fileName} (Part ${i + 1}/${chunks.length})` : fileName;
        
        console.log(`🔍 Analyzing chunk ${i + 1}/${chunks.length}...`);
        
        // Send to ChatGPT
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: this.createAnalysisPrompt(chunkName, chunk, { isChunk: chunks.length > 1, index: i, total: chunks.length })
            }
          ],
          temperature: 0.1, // Low temperature for consistent results
          max_tokens: 4000,  // GPT-4 Turbo can handle more tokens
        });

        const aiResponse = response.choices[0].message.content.trim();
        console.log(`✅ Chunk ${i + 1} analysis received`);
        
        // Check if this chunk has issues
        const chunkHasIssues = (
          aiResponse.includes('=== CRITICAL ISSUES START ===') &&
          aiResponse.includes('=== CRITICAL ISSUES END ===') &&
          !aiResponse.includes('=== NO CRITICAL ISSUES START ===')
        );
        
        if (chunkHasIssues) {
          hasIssues = true;
        }
        
        allResponses.push(aiResponse);
      }
      
      // Combine all responses
      const combinedResponse = allResponses.join('\n\n=== NEXT CHUNK ===\n\n');
      
      // Store ChatGPT's complete response
      let result = {
        fileName: fileName,
        analysis: {
          // Keep the raw response exactly as ChatGPT gave it
          rawResponse: combinedResponse,
          // Also store a cleaned version split by lines
          explanation: combinedResponse.split('\n')
            .map(line => line.trim())
            .filter(line => line),
          // Set issues flag based on any chunk having issues
          hasCriticalIssues: hasIssues
        }
      };

      console.log('📝 ChatGPT Analysis:', result.analysis.explanation);

      // Add metadata
      result.analyzedAt = new Date().toISOString();
      result.filePath = filePath;
      result.fileSize = fileContent.length;
      result.fileContent = fileContent;

      // Log the analysis for pattern study
      await analysisLogger.logAnalysis(filePath, combinedResponse, result);

      console.log(`📊 Found ${result.analysis.hasCriticalIssues ? 'potential' : 'no'} critical issues in ${fileName}`);
      
      return result;

    } catch (error) {
      console.error(`❌ Error analyzing ${filePath}:`, error.message);
      
      return {
        fileName: path.basename(filePath),
        analysis: {
          rawResponse: `Error analyzing file: ${error.message}`,
          explanation: [],
          hasCriticalIssues: false
        },
        analyzedAt: new Date().toISOString()
      };
    }
  }

  // 📊 Format results for display
  formatResults(result) {
    if (!result.analysis) {
      return {
        status: 'error',
        message: 'Analysis failed',
        fileName: result.fileName
      };
    }

    return {
      status: 'success',
      fileName: result.fileName,
      analysis: result.analysis,
      fileSize: result.fileSize,
      analyzedAt: result.analyzedAt,
      criticalBugs: result.criticalBugs || [],
      summary: result.summary || { totalCriticalIssues: 0, riskLevel: 'low' },
      riskLevel: result.summary?.riskLevel || 'low'
    };
  }
}

module.exports = SingleFileAnalyzer;
