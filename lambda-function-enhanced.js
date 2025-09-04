import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// AI-powered analysis
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Lambda environment variable
console.log('🔑 OpenAI API Key status:', OPENAI_API_KEY ? 'FOUND' : 'MISSING');

// Smart file profiling for AI analysis
function createFileProfile(filePath, content) {
  const fileName = path.basename(filePath);
  const fileType = path.extname(filePath).toLowerCase();
  
  return {
    fileName,
    fileType,
    size: content.length,
    lines: content.split('\n').length,
    
    // Content analysis for smart AI targeting
    hasAuth: /auth|login|password|token|jwt|session/i.test(content),
    hasDatabase: /SELECT|INSERT|UPDATE|DELETE|query|sql|database|db\./i.test(content),
    hasAPI: /fetch|axios|request|endpoint|api|http/i.test(content),
    hasCrypto: /crypto|hash|encrypt|decrypt|bcrypt|md5|sha/i.test(content),
    hasFileOps: /fs\.|readFile|writeFile|createReadStream/i.test(content),
    hasValidation: /validate|sanitize|escape|clean/i.test(content),
    
    // Code structure
    functions: (content.match(/function|=>/g) || []).length,
    imports: (content.match(/import|require/g) || []).length,
    classes: (content.match(/class\s+\w+/g) || []).length,
    
    // Security indicators
    hasUserInput: /req\.body|req\.params|req\.query|input|form/i.test(content),
    hasNetworking: /fetch|axios|http|request|socket/i.test(content),
    
    // Preview for AI (first 800 chars)
    preview: content.substring(0, 800) + (content.length > 800 ? '...' : '')
  };
}

// GPT-4o powered analysis strategy
async function getAIAnalysisStrategy(profile) {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI API key - falling back to basic analysis');
    return null;
  }

  const prompt = `You are a senior code reviewer analyzing this file for REAL security vulnerabilities, performance issues, and code quality problems.

FILE PROFILE:
- File: ${profile.fileName}
- Type: ${profile.fileType}
- Size: ${profile.size} characters (${profile.lines} lines)
- Functions: ${profile.functions}, Classes: ${profile.classes}
- Has Auth: ${profile.hasAuth}
- Has Database: ${profile.hasDatabase}
- Has API: ${profile.hasAPI}
- Has Crypto: ${profile.hasCrypto}
- Has User Input: ${profile.hasUserInput}
- Has Networking: ${profile.hasNetworking}

CODE PREVIEW:
\`\`\`
${profile.preview}
\`\`\`

TASK: Based on this file's content and purpose, what specific security/performance/quality issues should I check for?
Be SELECTIVE - only recommend checks that are relevant to THIS specific file. Don't recommend everything.

Respond with a JSON array of specific analysis tasks (max 5 tasks):
[
  {
    "type": "security",
    "check": "hardcoded_secrets", 
    "reason": "File contains authentication code with potential secrets",
    "priority": "critical"
  }
]

Available checks: hardcoded_secrets, sql_injection, xss_vulnerability, insecure_http, empty_catch_blocks, sync_in_async, input_validation, crypto_issues

Focus ONLY on issues this specific file could realistically have. Skip irrelevant checks.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // 5x faster than GPT-4o, still excellent for code analysis
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      console.error('❌ OpenAI API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse JSON response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    console.warn('⚠️ Could not parse AI response, falling back to basic analysis');
    return null;

  } catch (error) {
    console.error('❌ AI analysis failed:', error.message);
    return null;
  }
}

// Targeted analysis functions based on AI recommendations
function performTargetedAnalysis(content, aiStrategy, filePath) {
  const issues = [];
  const lines = content.split('\n');

  if (!aiStrategy) {
    // Fallback to basic analysis if AI is unavailable
    return performBasicAnalysis(content, filePath);
  }

  console.log(`🤖 AI recommended ${aiStrategy.length} checks for ${filePath}`);

  for (const task of aiStrategy) {
    console.log(`🔍 Checking: ${task.check} (${task.priority})`);
    
    switch (task.check) {
      case 'hardcoded_secrets':
        issues.push(...findHardcodedSecrets(content, lines));
        break;
      case 'sql_injection':
        issues.push(...findSQLInjection(content, lines));
        break;
      case 'xss_vulnerability':
        issues.push(...findXSSVulnerabilities(content, lines));
        break;
      case 'insecure_http':
        issues.push(...findInsecureHTTP(content, lines));
        break;
      case 'empty_catch_blocks':
        issues.push(...findEmptyCatchBlocks(content, lines));
        break;
      case 'sync_in_async':
        issues.push(...findSyncInAsync(content, lines));
        break;
      case 'input_validation':
        issues.push(...findInputValidationIssues(content, lines));
        break;
      case 'crypto_issues':
        issues.push(...findCryptoIssues(content, lines));
        break;
    }
  }

  console.log(`✅ Found ${issues.length} issues using AI-guided analysis`);
  return issues;
}

// Specific analysis functions
function findHardcodedSecrets(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/(password|secret|token|apikey|api_key|auth_token|private_key)\s*[=:]\s*["'`][^"'`\s]{8,}["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded secret detected - use environment variables',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
  });
  return issues;
}

function findSQLInjection(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE).*\+.*["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'SQL injection risk - use parameterized queries',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
  });
  return issues;
}

function findXSSVulnerabilities(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/innerHTML\s*=\s*.*\+|dangerouslySetInnerHTML.*\+/i)) {
      issues.push({
        type: 'security',
        message: 'XSS vulnerability - sanitize user input',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
  });
  return issues;
}

function findInsecureHTTP(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/fetch\s*\(\s*["'`]http:\/\/|axios\.get\s*\(\s*["'`]http:\/\//i)) {
      issues.push({
        type: 'security',
        message: 'Insecure HTTP request - use HTTPS',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });
  return issues;
}

function findEmptyCatchBlocks(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/catch\s*\([^)]*\)\s*{\s*}$/)) {
      issues.push({
        type: 'error-handling',
        message: 'Empty catch block - handle errors properly',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
  });
  return issues;
}

function findSyncInAsync(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/await.*\.sync\(|await.*Sync\(/)) {
      issues.push({
        type: 'performance',
        message: 'Synchronous operation in async context - blocks event loop',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
  });
  return issues;
}

function findInputValidationIssues(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/req\.(body|params|query).*\[.*\]/) && !content.includes('validate')) {
      issues.push({
        type: 'security',
        message: 'Missing input validation - validate user input',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });
  return issues;
}

function findCryptoIssues(content, lines) {
  const issues = [];
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.match(/md5|sha1/i) && !trimmedLine.includes('//')) {
      issues.push({
        type: 'security',
        message: 'Weak cryptographic algorithm - use SHA-256 or better',
        line: index + 1,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });
  return issues;
}

// Fallback basic analysis (context-aware without AI)
function performBasicAnalysis(content, filePath) {
  console.log(`🔧 Using fallback analysis for: ${filePath}`);
  
  const issues = [];
  const lines = content.split('\n');
  const ext = path.extname(filePath).toLowerCase();
  
  // Context detection (like before)
  const hasDatabase = /SELECT|INSERT|UPDATE|DELETE|query|sql|database/i.test(content);
  const hasAuth = /auth|login|password|token|jwt|session/i.test(content);
  const hasAPI = /fetch|axios|request|endpoint|api|http/i.test(content);
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) return;
    
    // 1. Hardcoded secrets (context-aware)
    if (hasAuth && trimmedLine.match(/(password|secret|token|apikey|api_key|auth_token|private_key)\s*[=:]\s*["'`][^"'`\s]{8,}["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded secret detected - use environment variables',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
    
    // 2. SQL Injection (context-aware)
    if (hasDatabase && trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE).*\+.*["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'SQL injection risk - use parameterized queries',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
    
    // 3. XSS vulnerabilities (frontend files only)
    if (['.jsx', '.tsx', '.js'].includes(ext) && 
        trimmedLine.match(/innerHTML\s*=\s*.*\+|dangerouslySetInnerHTML.*\+/i)) {
      issues.push({
        type: 'security',
        message: 'XSS vulnerability - sanitize user input',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
    
    // 4. Empty catch blocks
    if (trimmedLine.match(/catch\s*\([^)]*\)\s*{\s*}$/)) {
      issues.push({
        type: 'error-handling',
        message: 'Empty catch block - handle errors properly',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // 5. Console.log statements (development artifacts)
    if (trimmedLine.match(/console\.log\s*\(/)) {
      issues.push({
        type: 'code-quality',
        message: 'Console.log found - remove before production',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }
    
    // 6. TODO/FIXME comments
    if (trimmedLine.match(/\/\/\s*(TODO|FIXME|HACK|BUG)/i)) {
      issues.push({
        type: 'maintainability',
        message: 'TODO/FIXME comment found - needs attention',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }
    
    // 7. Potential null pointer issues
    if (trimmedLine.match(/\.\w+\s*\(\s*\)/) && trimmedLine.includes('null')) {
      issues.push({
        type: 'reliability',
        message: 'Potential null pointer access',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });
  
  console.log(`🔧 Fallback analysis found ${issues.length} issues`);
  return issues;
}

export const handler = async (event) => {
  console.log('🤖 AI-POWERED Lambda analyzer started (v3.0 with GPT-4o analysis):', JSON.stringify(event));
  
  const { repoUrl, analysisId, batchNumber = null, fullRepoAnalysis = false } = JSON.parse(event.body || '{}');
  
  if (!repoUrl || !analysisId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'repoUrl and analysisId required' })
    };
  }
  
  const tempDir = path.join('/tmp', `analysis-${Date.now()}`);
  const results = [];
  const isFileBatched = !!batchNumber;
  
  try {
    // Step 1: ALWAYS SHALLOW CLONE FULL REPOSITORY
    console.log(`📥 Shallow cloning full repository ${isFileBatched ? `(file batch ${batchNumber})` : '(single analysis)'}...`);
    await fs.mkdir(tempDir, { recursive: true });
    
    const gitPath = '/opt/bin/git'; // From git layer
    
    // ALWAYS do shallow clone of complete repository
    console.log('🌊 Performing SHALLOW CLONE of full repository');
    const cloneCmd = `${gitPath} clone --depth 1 --single-branch --no-tags "${repoUrl}" "${tempDir}"`;
    execSync(cloneCmd, { stdio: 'pipe' });
    console.log('✅ Shallow clone successful');
    
    // Step 2: Find ALL code files from full repository
    console.log('📁 Finding ALL code files from full repository...');
    
    const allFiles = await findCodeFiles(tempDir); // Get ALL files from entire repository
              console.log(`📊 CRITICAL: Found ${allFiles.length} total code files in repository`);
          
          // 🧠 STEP 1: AI REPOSITORY OVERVIEW & SMART CATEGORIZATION
          console.log(`🧠 AI analyzing repository structure for smart categorization...`);
          const fileCategories = await analyzeRepositoryStructure(allFiles, tempDir);
          console.log(`📋 AI categorized files:`, fileCategories.summary);
    
    // Step 3: Handle file-based batching
    let filesToProcess = allFiles;
    let isLastBatch = true;
    
    if (isFileBatched) {
      // FILE-BASED BATCHING: Process files in chunks
              // HYBRID ANALYSIS: Larger batches since most files use fast analysis
        const filesPerBatch = 500; // Larger batches - only critical files use AI
        console.log(`⚡ Hybrid batch size: ${filesPerBatch} files per batch (AI for critical files only)`);
      
      const startIndex = (batchNumber - 1) * filesPerBatch;
      const endIndex = startIndex + filesPerBatch;
      
      filesToProcess = allFiles.slice(startIndex, endIndex);
      isLastBatch = endIndex >= allFiles.length || filesToProcess.length === 0;
      
      console.log(`📦 BATCH ${batchNumber} DETAILS:`);
      console.log(`   📊 Total files in repo: ${allFiles.length}`);
      console.log(`   📍 Processing range: ${startIndex + 1} to ${Math.min(endIndex, allFiles.length)}`);
      console.log(`   📁 Files in this batch: ${filesToProcess.length}`);
      console.log(`   🏁 Is last batch: ${isLastBatch}`);
      console.log(`   🔢 Math check: endIndex(${endIndex}) >= totalFiles(${allFiles.length}) = ${endIndex >= allFiles.length}`);
      
      // Early return if no files in this batch
      if (filesToProcess.length === 0) {
        console.log(`🛑 EARLY RETURN: No files in batch ${batchNumber}, marking as last batch`);
        
        const earlyReturnData = {
          success: true,
          analysisId,
          results: [],
          isFileBatched: true,
          batchNumber: batchNumber,
          isLastBatch: true, // Force last batch when no files
          stats: {
            filesProcessed: 0,
            filesWithIssues: 0,
            totalIssues: 0,
            totalFilesInRepo: allFiles.length
          },
          message: `FILE BATCH ${batchNumber} - No more files to process`
        };
        
        console.log(`📤 EARLY RETURN TO FRONTEND:`, JSON.stringify({
          success: earlyReturnData.success,
          isLastBatch: earlyReturnData.isLastBatch,
          batchNumber: earlyReturnData.batchNumber,
          totalIssues: earlyReturnData.stats.totalIssues,
          totalFilesInRepo: earlyReturnData.stats.totalFilesInRepo
        }));
        
        return {
          statusCode: 200,
          body: JSON.stringify(earlyReturnData)
        };
      }
    }
    
    console.log(`🔍 Processing ${filesToProcess.length} files in this batch`);
    
    // Step 4: Analyze files in this batch
    console.log(`🔍 Analyzing ${filesToProcess.length} files in this batch...`);
    let processedFiles = 0;
    let totalIssues = 0;
    
              // 🧠 AI RULE GENERATOR: Create minimal, focused rules for this repo
          console.log(`🧠 AI RULE GENERATOR: Creating custom analysis rules for ${filesToProcess.length} files...`);
          
          // Step 1: Build repository context
          const repoContext = await buildRepositoryContext(filesToProcess, tempDir);
          
          // Step 2: AI generates minimal rule set (5-15 rules max)
          const customRulesCode = await generateCustomRules(repoContext);
          
          if (customRulesCode) {
            console.log(`⚡ Executing AI-generated rules (LIGHTNING FAST)...`);
            
            // Step 3: Execute AI rules on all files (milliseconds per file!)
            const ruleResults = await executeCustomRules(customRulesCode, filesToProcess, tempDir);
            
            if (ruleResults && ruleResults.length > 0) {
              results.push(...ruleResults);
              totalIssues = ruleResults.reduce((sum, file) => sum + file.issues.length, 0);
              processedFiles = filesToProcess.length;
              
              console.log(`🎉 AI RULE EXECUTION complete: ${totalIssues} issues found in ${ruleResults.length} files`);
            } else {
              console.log(`⚠️ AI rules found no issues, using fallback analysis...`);
              processedFiles = filesToProcess.length; // Still processed
            }
          } else {
            console.log(`⚠️ AI rule generation failed, falling back to basic analysis...`);
            
            // Fallback to basic analysis
            for (const file of filesToProcess) {
              try {
                const content = await fs.readFile(file, 'utf-8');
                const relativePath = path.relative(tempDir, file);
                const issues = performBasicAnalysis(content, relativePath);
                
                processedFiles++;
                
                if (issues.length > 0) {
                  results.push({
                    file: relativePath,
                    issues: issues
                  });
                  totalIssues += issues.length;
                }
              } catch (err) {
                console.warn(`❌ Failed to analyze ${file}:`, err.message);
                processedFiles++;
              }
            }
          }
    
    console.log(`✅ ANALYSIS COMPLETE FOR BATCH ${batchNumber || 'N/A'}:`);
    console.log(`   📊 Files processed: ${processedFiles}`);
    console.log(`   📁 Files with issues: ${results.length}`);
    console.log(`   🚨 Total issues found: ${totalIssues}`);
    console.log(`   🏁 Will return isLastBatch: ${isLastBatch}`);
    
    // CRITICAL: Log what we're returning to frontend
    const returnData = {
      success: true,
      analysisId,
      results,
      isFileBatched: isFileBatched,
      batchNumber: batchNumber,
      isLastBatch: isLastBatch,
      stats: {
        filesProcessed: processedFiles,
        filesWithIssues: results.length,
        totalIssues: totalIssues,
        totalFilesInRepo: isFileBatched ? allFiles.length : processedFiles
      },
      message: `${isFileBatched ? `FILE BATCH ${batchNumber}` : 'FULL'} Analysis complete: ${totalIssues} ACTUAL ERRORS found in ${results.length} files`
    };
    
    console.log(`📤 RETURNING TO FRONTEND:`, JSON.stringify({
      success: returnData.success,
      isLastBatch: returnData.isLastBatch,
      batchNumber: returnData.batchNumber,
      totalIssues: returnData.stats.totalIssues,
      totalFilesInRepo: returnData.stats.totalFilesInRepo
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify(returnData)
    };
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
    
  } finally {
    // Cleanup
    try {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
    } catch (err) {
      console.warn('Cleanup failed:', err.message);
    }
  }
};

async function findCodeFiles(dir) {
  const files = [];
  
  // Priority file extensions - most important first (REMOVED problematic types)
  const highPriorityExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'];
  const mediumPriorityExts = ['.cpp', '.c', '.h', '.php', '.rb', '.swift', '.kt'];
  const lowPriorityExts = ['.css', '.scss']; // Removed .html, .json, .yaml, .yml, .md (too many false positives)
  
  const allExts = [...highPriorityExts, ...mediumPriorityExts, ...lowPriorityExts];
  
  // ALWAYS scan the entire repository (no directory filtering)
  console.log('🌍 Scanning ENTIRE repository for all code files...');
  
  try {
    await scanDirectory(dir, files, allExts, 0);
  } catch (error) {
    console.warn(`Failed to scan directory ${dir}:`, error.message);
  }
  
  // Sort by priority - NO LIMITS, return ALL files
  const prioritizedFiles = [
    ...files.filter(f => highPriorityExts.includes(path.extname(f).toLowerCase())),
    ...files.filter(f => mediumPriorityExts.includes(path.extname(f).toLowerCase())),
    ...files.filter(f => lowPriorityExts.includes(path.extname(f).toLowerCase()))
  ];
  
  // Return ALL files - no limits for comprehensive analysis
  console.log(`📊 Final file count: ${prioritizedFiles.length} files for analysis`);
  return prioritizedFiles;
}

async function scanDirectory(dir, files, extensions, depth) {
  // Prevent infinite recursion
  if (depth > 10) return;
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      // Skip common unimportant directories
      if (item.name.startsWith('.') || 
          ['node_modules', 'build', 'dist', 'coverage', '__pycache__', 'target', 'vendor'].includes(item.name)) {
        continue;
      }
      
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        await scanDirectory(fullPath, files, extensions, depth + 1);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error.message);
  }
}

// HYBRID ANALYSIS: AI for critical files, fast rules for routine files
async function analyzeFile(filePath, content, fileCategories) {
  // Handle large files more intelligently
  if (content.length > 200000) { // 200KB limit (4x larger)
    // For very large files, analyze first 100KB only
    console.log(`📄 Large file detected: ${filePath} (${content.length} chars) - analyzing first 100KB`);
    content = content.substring(0, 100000);
  }
  
  try {
    // Step 1: Create file profile
    const profile = createFileProfile(filePath, content);
    
    // Step 2: Smart decision based on AI categorization
    const needsAI = shouldUseAI(profile, filePath, fileCategories);
    
    if (needsAI) {
      console.log(`🤖 AI analyzing CRITICAL: ${filePath}`);
      const aiStrategy = await getAIAnalysisStrategy(profile);
      const issues = performTargetedAnalysis(content, aiStrategy, filePath);
      console.log(`✅ AI complete: ${filePath} → ${issues.length} issues`);
      return issues;
    } else {
      console.log(`⚡ Fast analyzing ROUTINE: ${filePath}`);
      const issues = performBasicAnalysis(content, filePath);
      console.log(`✅ Fast complete: ${filePath} → ${issues.length} issues`);
      return issues;
    }
    
  } catch (error) {
    console.error(`❌ AI failed for ${filePath}:`, error.message);
    // Fast fallback
    return performBasicAnalysis(content, filePath);
  }
}

// SMART AI DECISION: Use AI categorization from repository analysis
function shouldUseAI(profile, filePath, fileCategories) {
  if (!fileCategories) return true; // Default to AI if no categorization
  
  // Check if file matches CRITICAL patterns (needs AI)
  for (const pattern of fileCategories.criticalPatterns || []) {
    if (filePath.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  // Check if file matches ROUTINE patterns (use fast analysis)
  for (const pattern of fileCategories.routinePatterns || []) {
    if (filePath.toLowerCase().includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  // Additional smart checks
  if (profile.hasAuth && profile.hasUserInput) return true; // Auth + user input = critical
  if (profile.hasDatabase && profile.hasAPI) return true; // DB + API = SQL injection risk
  if (profile.hasCrypto && profile.size > 1000) return true; // Crypto logic = security critical
  
  // DEFAULT: Use AI for most files (be more aggressive about finding issues)
  return true;
}

// 🧠 AI REPOSITORY STRUCTURE ANALYZER
async function analyzeRepositoryStructure(allFiles, tempDir) {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ No AI key - using basic categorization');
    return basicFileCategorizaton(allFiles, tempDir);
  }

  try {
    // Sample files for AI analysis
    const sampleFiles = allFiles.slice(0, 50).map(f => path.relative(tempDir, f));
    const fileStructure = sampleFiles.join('\n');
    
    const prompt = `You are analyzing a codebase structure. Based on these file paths, categorize ALL files in the repository for security analysis priority:

SAMPLE FILE STRUCTURE:
${fileStructure}

TASK: Create a smart categorization strategy for ALL ${allFiles.length} files in this repository.

Respond with JSON:
{
  "repoType": "react/node/python/etc",
  "criticalPatterns": ["auth", "api", "security"],
  "routinePatterns": ["test", "config", "style"],
  "analysisStrategy": "description of approach",
  "summary": "brief summary"
}

Focus on SECURITY and PERFORMANCE critical files vs routine files.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return basicFileCategorizaton(allFiles, tempDir);

  } catch (error) {
    console.error('❌ AI repository analysis failed:', error.message);
    return basicFileCategorizaton(allFiles, tempDir);
  }
}

// Basic fallback categorization
function basicFileCategorizaton(allFiles, tempDir) {
  return {
    repoType: "unknown",
    criticalPatterns: ["auth", "api", "security", "login", "admin"],
    routinePatterns: ["test", "spec", "config", "style", "css"],
    analysisStrategy: "Basic pattern matching",
    summary: `${allFiles.length} files - using basic categorization`
  };
}

// 🧠 BUILD COMPLETE REPOSITORY CONTEXT (like Claude sees)
async function buildRepositoryContext(filesToProcess, tempDir) {
  console.log(`🏗️ Building repository context for ${filesToProcess.length} files...`);
  
  const repoContext = {
    totalFiles: filesToProcess.length,
    fileContents: [],
    structure: [],
    summary: ''
  };
  
  // Read all files and build context
  for (const file of filesToProcess) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(tempDir, file);
      
      // Truncate very large files
      const truncatedContent = content.length > 10000 ? 
        content.substring(0, 10000) + '\n... [truncated]' : content;
      
      repoContext.fileContents.push({
        path: relativePath,
        content: truncatedContent,
        size: content.length,
        lines: content.split('\n').length
      });
      
      repoContext.structure.push(relativePath);
      
    } catch (err) {
      console.warn(`⚠️ Failed to read ${file}:`, err.message);
    }
  }
  
  // Create summary
  repoContext.summary = `Repository batch with ${repoContext.fileContents.length} files`;
  
  console.log(`✅ Repository context built: ${repoContext.fileContents.length} files`);
  return repoContext;
}

// 🧠 AI RULE GENERATOR: Creates minimal, focused rule set for each repo
async function generateCustomRules(repoContext) {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI API key for rule generation');
    return null;
  }

  try {
    const prompt = `You are a senior code reviewer. Analyze this repository structure and create a MINIMAL set of JavaScript functions to detect ONLY the most critical issues.

REPOSITORY ANALYSIS:
- Files: ${repoContext.fileContents.length}
- Structure: ${repoContext.structure.slice(0, 20).join(', ')}...

SAMPLE FILES:
${repoContext.fileContents.slice(0, 3).map(file => `
=== ${file.path} ===
${file.content.substring(0, 1000)}...
`).join('\n')}

TASK: Generate 5-15 JavaScript functions (NO MORE!) that detect REAL issues for THIS specific repository type.

Return EXECUTABLE JavaScript code using ONLY ES5 syntax (no const/let/arrow functions):

{
  // Rule 1: Critical security issue specific to this repo type
  findCriticalSecurity: function(content, lines, filePath) {
    var issues = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.match(/hardcoded.*password|api.*key.*=|secret.*=.*["']/i)) {
        issues.push({
          type: "security",
          message: "Hardcoded secret detected",
          line: i + 1,
          code: line.trim().substring(0, 80),
          severity: "critical"
        });
      }
    }
    return issues;
  },

  // Rule 2: SQL injection patterns
  findSQLInjection: function(content, lines, filePath) {
    var issues = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.match(/(SELECT|INSERT|UPDATE|DELETE).*\+.*["']/i)) {
        issues.push({
          type: "security", 
          message: "SQL injection vulnerability",
          line: i + 1,
          code: line.trim().substring(0, 80),
          severity: "critical"
        });
      }
    }
    return issues;
  },

  // Main execution function
  executeRules: function(content, filePath) {
    var lines = content.split('\n');
    var allIssues = [];
    
    // Apply security rules to all JavaScript files
    if (filePath.match(/\.(js|jsx|ts|tsx)$/)) {
      allIssues = allIssues.concat(this.findCriticalSecurity(content, lines, filePath));
      allIssues = allIssues.concat(this.findSQLInjection(content, lines, filePath));
    }
    
    return allIssues;
  }
}

REQUIREMENTS:
- Maximum 15 rules total
- Only detect REAL, actionable issues
- No style/formatting rules
- Focus on security, bugs, performance
- Make rules specific to this repo's technology stack`;

    console.log(`🧠 Asking AI to generate custom rules for repository...`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-16k',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      console.error(`❌ OpenAI API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Extract JavaScript code from AI response
    const jsMatch = aiResponse.match(/```javascript\n([\s\S]*?)\n```/);
    if (jsMatch) {
      const generatedCode = jsMatch[1];
      console.log(`✅ AI generated ${generatedCode.length} characters of custom rules`);
      return generatedCode;
    }
    
    console.warn('⚠️ Could not extract JavaScript code from AI response');
    return null;

  } catch (error) {
    console.error('❌ Rule generation failed:', error.message);
    return null;
  }
}

// 🚀 EXECUTE AI-GENERATED RULES ON ALL FILES
async function executeCustomRules(customRulesCode, filesToProcess, tempDir) {
  try {
    console.log(`⚡ Executing AI-generated rules on ${filesToProcess.length} files...`);
    console.log(`🔍 AI generated code preview:`, customRulesCode.substring(0, 200) + '...');
    
    // SAFE EVALUATION: Use Function constructor instead of eval
    let customRules;
    try {
      // Clean the code and wrap it properly
      const cleanCode = customRulesCode
        .replace(/```javascript/g, '')
        .replace(/```/g, '')
        .trim();
      
      console.log(`🧹 Cleaned code preview:`, cleanCode.substring(0, 200) + '...');
      
      // Use Function constructor for safer evaluation
      const ruleFunction = new Function('return ' + cleanCode);
      customRules = ruleFunction();
      
      console.log(`✅ Successfully evaluated AI rules`);
      console.log(`🔍 Rules object keys:`, Object.keys(customRules || {}));
      
    } catch (evalError) {
      console.error('❌ Failed to evaluate AI-generated code:', evalError.message);
      console.log(`🔍 Problematic code:`, customRulesCode);
      return null;
    }
    
    if (!customRules || typeof customRules.executeRules !== 'function') {
      console.warn('⚠️ Invalid custom rules generated by AI');
      console.log(`🔍 customRules type:`, typeof customRules);
      console.log(`🔍 executeRules type:`, typeof customRules?.executeRules);
      return null;
    }
    
    const results = [];
    let totalIssues = 0;
    
    // Execute rules on all files (SUPER FAST!)
    for (const file of filesToProcess) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(tempDir, file);
        
        // Apply AI-generated rules
        const issues = customRules.executeRules(content, relativePath);
        
        if (issues && issues.length > 0) {
          results.push({
            file: relativePath,
            issues: issues
          });
          totalIssues += issues.length;
          
          console.log(`📝 ${relativePath} → ${issues.length} issues`);
        }
        
      } catch (err) {
        console.warn(`⚠️ Failed to analyze ${file}:`, err.message);
      }
    }
    
    console.log(`🎉 AI rules executed: ${totalIssues} issues found in ${results.length} files`);
    return results;
    
  } catch (error) {
    console.error('❌ Rule execution failed:', error.message);
    return null;
  }
}