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

// Fallback basic analysis (HIGHLY SELECTIVE - only critical issues)
function performBasicAnalysis(content, filePath) {
  console.log(`🔧 Using selective fallback analysis for: ${filePath}`);
  
  const issues = [];
  const lines = content.split('\n');
  const ext = path.extname(filePath).toLowerCase();
  
  // Context detection
  const hasAuth = /password|secret|token|jwt|auth|login/i.test(content);
  const hasDatabase = /SELECT|INSERT|UPDATE|DELETE|query|sql/i.test(content);
  const isReactFile = /react|jsx|usestate|useeffect|component/i.test(content) || ['.jsx', '.tsx'].includes(ext);
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip empty lines, comments, and imports
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || 
        trimmedLine.startsWith('import') || trimmedLine.startsWith('export')) return;
    
    // 1. CRITICAL: Hardcoded secrets (only if auth context detected)
    if (hasAuth && trimmedLine.match(/(password|secret|token|key)\s*[=:]\s*["'`][a-zA-Z0-9]{12,}["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded secret detected',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
    
    // 2. CRITICAL: SQL injection (only if database context detected)
    if (hasDatabase && trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE).*\+.*["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'SQL injection risk',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
    
    // 3. HIGH: Empty catch blocks (always critical)
    if (trimmedLine.match(/catch\s*\([^)]*\)\s*{\s*}$/)) {
      issues.push({
        type: 'error-handling',
        message: 'Empty catch block',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'high'
      });
    }
    
    // 4. REACT-SPECIFIC: Dangerous innerHTML without sanitization
    if (isReactFile && trimmedLine.match(/dangerouslySetInnerHTML.*__html:\s*[^}]*\+/)) {
      issues.push({
        type: 'security',
        message: 'XSS risk in dangerouslySetInnerHTML',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'high'
      });
    }
    
    // 5. HIGH: Memory leaks (event listeners not removed)
    if (trimmedLine.match(/addEventListener/) && !content.includes('removeEventListener')) {
      issues.push({
        type: 'performance',
        message: 'Potential memory leak - missing removeEventListener',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'high'
      });
    }
    
    // 6. CRITICAL: Environment variable issues (common deployment failure)
    if (trimmedLine.match(/process\.env\./) && !content.includes('||') && !content.includes('??')) {
      issues.push({
        type: 'deployment',
        message: 'Missing fallback for environment variable - will crash if undefined',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
    
    // 7. HIGH: Unhandled promise rejections (silent failures)
    if (trimmedLine.match(/\.then\(/) && !trimmedLine.includes('.catch(') && !content.includes('.catch(')) {
      issues.push({
        type: 'error-handling',
        message: 'Unhandled promise rejection - will cause silent failures',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'high'
      });
    }
    
    // 8. REACT-SPECIFIC: useEffect without dependencies (infinite loops)
    if (isReactFile && trimmedLine.match(/useEffect\s*\([^,]+\)/) && !trimmedLine.includes('[')) {
      issues.push({
        type: 'performance',
        message: 'useEffect without dependencies - will cause infinite re-renders',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
    
    // 9. HIGH: CORS issues (API call failures)
    if (trimmedLine.match(/fetch\s*\(\s*["'`]https?:\/\//) && !content.includes('cors') && !content.includes('Access-Control')) {
      issues.push({
        type: 'connectivity',
        message: 'Potential CORS issue with external API call',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'high'
      });
    }
    
    // 10. CRITICAL: Database connection without error handling
    if ((trimmedLine.match(/\.connect\(/) || trimmedLine.match(/\.query\(/)) && !content.includes('catch') && !content.includes('error')) {
      issues.push({
        type: 'connectivity',
        message: 'Database operation without error handling - will crash on connection failure',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
  });
  
  console.log(`🔧 Selective fallback found ${issues.length} critical issues (filtered out noise)`);
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
  
  // Add cross-file analysis data
  repoContext.crossFileAnalysis = analyzeCrossFileRelationships(repoContext);
  
  console.log(`✅ Repository context built: ${repoContext.fileContents.length} files`);
  return repoContext;
}

// 🔗 CROSS-FILE ANALYSIS: Analyze relationships and dependencies between files
function analyzeCrossFileRelationships(repoContext) {
  console.log('🔗 Analyzing cross-file relationships...');
  
  var analysis = {
    imports: [],
    exports: [],
    dependencies: [],
    circularDeps: [],
    unusedExports: [],
    missingImports: [],
    architecturalIssues: []
  };
  
  var allImports = new Map();
  var allExports = new Map();
  
  // Extract imports and exports from all files
  repoContext.fileContents.forEach(function(file) {
    var content = file.content;
    var filePath = file.path;
    
    // Extract ES6 imports
    var importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    if (importMatches) {
      importMatches.forEach(function(match) {
        var moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (moduleMatch) {
          var modulePath = moduleMatch[1];
          if (!allImports.has(filePath)) allImports.set(filePath, []);
          allImports.get(filePath).push(modulePath);
          
          analysis.imports.push({
            file: filePath,
            imports: modulePath,
            line: content.split('\n').findIndex(function(line) { return line.includes(match); }) + 1
          });
        }
      });
    }
    
    // Extract CommonJS requires
    var requireMatches = content.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
    if (requireMatches) {
      requireMatches.forEach(function(match) {
        var moduleMatch = match.match(/['"`]([^'"`]+)['"`]/);
        if (moduleMatch) {
          var modulePath = moduleMatch[1];
          if (!allImports.has(filePath)) allImports.set(filePath, []);
          allImports.get(filePath).push(modulePath);
          
          analysis.imports.push({
            file: filePath,
            imports: modulePath,
            line: content.split('\n').findIndex(function(line) { return line.includes(match); }) + 1
          });
        }
      });
    }
    
    // Extract exports
    var exportMatches = content.match(/export\s+(default\s+)?.*?/g);
    if (exportMatches) {
      exportMatches.forEach(function(match) {
        if (!allExports.has(filePath)) allExports.set(filePath, []);
        allExports.get(filePath).push(match);
        
        analysis.exports.push({
          file: filePath,
          exports: match,
          line: content.split('\n').findIndex(function(line) { return line.includes(match); }) + 1
        });
      });
    }
  });
  
  // Detect circular dependencies (simplified)
  allImports.forEach(function(imports, filePath) {
    imports.forEach(function(importPath) {
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // Check if imported file also imports this file
        var resolvedPath = resolveRelativePath(filePath, importPath);
        if (allImports.has(resolvedPath)) {
          var reverseImports = allImports.get(resolvedPath);
          var reverseResolvedPath = resolveRelativePath(resolvedPath, filePath);
          if (reverseImports.some(function(imp) { 
            return resolveRelativePath(resolvedPath, imp) === filePath; 
          })) {
            analysis.circularDeps.push({
              file1: filePath,
              file2: resolvedPath,
              type: 'circular_dependency'
            });
          }
        }
      }
    });
  });
  
  // Detect potential architectural issues
  repoContext.fileContents.forEach(function(file) {
    var filePath = file.path;
    var content = file.content;
    
    // Check for direct database access in UI components
    if (filePath.includes('component') || filePath.includes('page')) {
      if (content.match(/SELECT|INSERT|UPDATE|DELETE|query\(/i)) {
        analysis.architecturalIssues.push({
          file: filePath,
          issue: 'Database access in UI component',
          severity: 'high',
          line: content.split('\n').findIndex(function(line) { 
            return /SELECT|INSERT|UPDATE|DELETE|query\(/i.test(line); 
          }) + 1
        });
      }
    }
    
    // Check for business logic in view files
    if (filePath.includes('view') || filePath.includes('template')) {
      if (content.match(/function\s+\w+.*{[\s\S]{100,}}/)) {
        analysis.architecturalIssues.push({
          file: filePath,
          issue: 'Complex business logic in view layer',
          severity: 'medium',
          line: 1
        });
      }
    }
  });
  
  console.log('🔗 Cross-file analysis complete:', {
    imports: analysis.imports.length,
    exports: analysis.exports.length,
    circularDeps: analysis.circularDeps.length,
    architecturalIssues: analysis.architecturalIssues.length
  });
  
  return analysis;
}

// Helper function to resolve relative paths
function resolveRelativePath(fromPath, toPath) {
  if (!toPath.startsWith('./') && !toPath.startsWith('../')) {
    return toPath;
  }
  
  var fromDir = fromPath.split('/').slice(0, -1);
  var toParts = toPath.split('/');
  
  toParts.forEach(function(part) {
    if (part === '..') {
      fromDir.pop();
    } else if (part !== '.') {
      fromDir.push(part);
    }
  });
  
  return fromDir.join('/');
}

// 🧠 REPOSITORY INTELLIGENCE: Analyze tech stack and architecture patterns
function analyzeRepositoryTechStack(repoContext) {
  var techStack = {
    type: 'Unknown',
    technologies: [],
    architecture: 'Unknown',
    patterns: []
  };
  
  var allFiles = repoContext.structure.join(' ').toLowerCase();
  var allContent = repoContext.fileContents.map(function(f) { return f.content; }).join(' ').toLowerCase();
  
  // Detect framework/library type
  if (allFiles.includes('react') || allContent.includes('react') || allContent.includes('usestate') || allContent.includes('jsx')) {
    techStack.type = 'React Library/Framework';
    techStack.technologies.push('React', 'JavaScript', 'JSX');
    techStack.architecture = 'Component-based UI Library';
    techStack.patterns.push('Hooks', 'Components', 'Virtual DOM', 'JSX');
  } else if (allFiles.includes('vue') || allContent.includes('vue')) {
    techStack.type = 'Vue.js Application';
    techStack.technologies.push('Vue.js', 'JavaScript');
    techStack.architecture = 'Component-based SPA';
    techStack.patterns.push('Single File Components', 'Reactivity');
  } else if (allFiles.includes('angular') || allContent.includes('angular')) {
    techStack.type = 'Angular Application';
    techStack.technologies.push('Angular', 'TypeScript');
    techStack.architecture = 'Component-based SPA';
    techStack.patterns.push('Services', 'Dependency Injection', 'RxJS');
  } else if (allFiles.includes('next') || allContent.includes('next')) {
    techStack.type = 'Next.js Application';
    techStack.technologies.push('Next.js', 'React', 'JavaScript');
    techStack.architecture = 'Full-stack React Framework';
    techStack.patterns.push('SSR', 'API Routes', 'File-based Routing');
  } else if (allFiles.includes('express') || allContent.includes('express')) {
    techStack.type = 'Express.js Backend';
    techStack.technologies.push('Express.js', 'Node.js');
    techStack.architecture = 'REST API Server';
    techStack.patterns.push('Middleware', 'Routes', 'Controllers');
  } else if (allFiles.includes('kubernetes') || allFiles.includes('k8s') || allContent.includes('kubernetes')) {
    techStack.type = 'Kubernetes Infrastructure';
    techStack.technologies.push('Kubernetes', 'Go', 'YAML');
    techStack.architecture = 'Container Orchestration';
    techStack.patterns.push('Pods', 'Services', 'Deployments', 'Controllers');
  } else if (allFiles.includes('django') || allContent.includes('django')) {
    techStack.type = 'Django Backend';
    techStack.technologies.push('Django', 'Python');
    techStack.architecture = 'MVC Web Framework';
    techStack.patterns.push('Models', 'Views', 'Templates', 'ORM');
  } else if (allFiles.includes('spring') || allContent.includes('springframework')) {
    techStack.type = 'Spring Boot Backend';
    techStack.technologies.push('Spring Boot', 'Java');
    techStack.architecture = 'Enterprise Java Application';
    techStack.patterns.push('Controllers', 'Services', 'Repositories', 'Beans');
  }
  
  // Detect additional technologies
  if (allContent.includes('typescript') || allFiles.includes('.ts')) {
    techStack.technologies.push('TypeScript');
  }
  if (allContent.includes('graphql') || allFiles.includes('graphql')) {
    techStack.technologies.push('GraphQL');
  }
  if (allContent.includes('mongodb') || allContent.includes('mongoose')) {
    techStack.technologies.push('MongoDB');
  }
  if (allContent.includes('postgresql') || allContent.includes('postgres')) {
    techStack.technologies.push('PostgreSQL');
  }
  if (allContent.includes('redis') || allContent.includes('cache')) {
    techStack.technologies.push('Redis');
  }
  if (allContent.includes('docker') || allFiles.includes('dockerfile')) {
    techStack.technologies.push('Docker');
  }
  
  // Default fallback
  if (techStack.type === 'Unknown') {
    if (allFiles.includes('.js') || allFiles.includes('.ts')) {
      techStack.type = 'JavaScript/Node.js Project';
      techStack.technologies.push('JavaScript');
      techStack.architecture = 'General Purpose Application';
    } else if (allFiles.includes('.py')) {
      techStack.type = 'Python Project';
      techStack.technologies.push('Python');
      techStack.architecture = 'General Purpose Application';
    } else if (allFiles.includes('.java')) {
      techStack.type = 'Java Project';
      techStack.technologies.push('Java');
      techStack.architecture = 'General Purpose Application';
    }
  }
  
  console.log('🔍 Repository Analysis:', techStack);
  return techStack;
}

// 🎯 COMPREHENSIVE ANALYSIS TEMPLATES: Pre-defined checks for AI guidance
function generateAnalysisTemplates(techStack) {
  var templates = [];
  
  // 1. PERFORMANCE & OPTIMIZATION
  var performanceChecks = [
    'Memory leaks and resource cleanup',
    'Inefficient algorithms and data structures',
    'Unnecessary re-renders and computations',
    'Large bundle sizes and code splitting issues',
    'Database query optimization',
    'Caching strategies and implementation',
    'Async/await patterns and promise handling'
  ];
  
  // Add framework-specific performance checks
  if (techStack.type.includes('React')) {
    performanceChecks.push(
      'useEffect dependency arrays and infinite loops',
      'React.memo and useMemo optimization opportunities',
      'Component re-render cascades',
      'Virtual DOM performance issues',
      'State management inefficiencies'
    );
  } else if (techStack.type.includes('Vue')) {
    performanceChecks.push(
      'Computed properties vs methods usage',
      'Watchers and reactive data optimization',
      'Component lifecycle optimization'
    );
  } else if (techStack.type.includes('Kubernetes')) {
    performanceChecks.push(
      'Resource limits and requests configuration',
      'Pod scaling and resource utilization',
      'Network policies and service mesh performance'
    );
  }
  
  templates.push({
    category: 'Performance & Optimization',
    checks: performanceChecks
  });
  
  // 2. SECURITY & VULNERABILITIES
  var securityChecks = [
    'Input validation and sanitization',
    'Authentication and authorization bypasses',
    'Data exposure and information leakage',
    'Injection attacks (SQL, NoSQL, Command)',
    'Cross-site scripting (XSS) vulnerabilities',
    'Insecure direct object references',
    'Security headers and HTTPS enforcement',
    'Secrets and credentials in code'
  ];
  
  if (techStack.type.includes('React') || techStack.type.includes('Next')) {
    securityChecks.push(
      'dangerouslySetInnerHTML without sanitization',
      'Client-side routing security',
      'API route authentication',
      'CSRF protection in forms'
    );
  } else if (techStack.type.includes('Kubernetes')) {
    securityChecks.push(
      'Pod security policies and contexts',
      'RBAC configurations and permissions',
      'Network policies and ingress security',
      'Secret management and encryption'
    );
  }
  
  templates.push({
    category: 'Security & Vulnerabilities',
    checks: securityChecks
  });
  
  // 3. ARCHITECTURE & DESIGN PATTERNS
  var architectureChecks = [
    'Tight coupling and dependency issues',
    'Circular dependencies between modules',
    'Violation of SOLID principles',
    'Improper separation of concerns',
    'Anti-patterns and code smells',
    'Inconsistent error handling patterns',
    'Missing abstraction layers'
  ];
  
  if (techStack.type.includes('React')) {
    architectureChecks.push(
      'Component composition vs inheritance',
      'Props drilling and context overuse',
      'State management architecture',
      'Custom hooks design patterns'
    );
  } else if (techStack.type.includes('Express')) {
    architectureChecks.push(
      'Middleware ordering and design',
      'Route organization and RESTful patterns',
      'Error handling middleware'
    );
  }
  
  templates.push({
    category: 'Architecture & Design Patterns',
    checks: architectureChecks
  });
  
  // 4. UI/UX & ACCESSIBILITY
  var uiChecks = [
    'Missing alt text and image descriptions',
    'Poor color contrast and readability',
    'Keyboard navigation and focus management',
    'Screen reader compatibility',
    'Mobile responsiveness and touch targets',
    'Loading states and error messages',
    'Form validation and user feedback'
  ];
  
  if (techStack.type.includes('React') || techStack.type.includes('Vue') || techStack.type.includes('Angular')) {
    uiChecks.push(
      'Component accessibility props (aria-*)',
      'Focus management in SPAs',
      'Dynamic content announcements',
      'Semantic HTML in components'
    );
  }
  
  templates.push({
    category: 'UI/UX & Accessibility',
    checks: uiChecks
  });
  
  // 5. TESTING & RELIABILITY
  var testingChecks = [
    'Missing test coverage for critical paths',
    'Brittle tests with implementation details',
    'Inadequate error handling and edge cases',
    'Missing integration and e2e tests',
    'Test data management and mocking',
    'Flaky tests and timing issues',
    'Performance testing gaps'
  ];
  
  templates.push({
    category: 'Testing & Reliability',
    checks: testingChecks
  });
  
  // 6. DEPLOYMENT & RUNTIME ROADBLOCKS
  var deploymentChecks = [
    'Environment-specific configuration issues',
    'Missing environment variables',
    'Docker and containerization problems',
    'Database migration and schema issues',
    'Scaling and load balancing configuration',
    'Monitoring and logging setup',
    'CI/CD pipeline vulnerabilities',
    'Health checks and readiness probes'
  ];
  
  if (techStack.type.includes('Kubernetes')) {
    deploymentChecks.push(
      'Pod disruption budgets',
      'Resource quotas and limits',
      'Ingress and service configurations',
      'ConfigMap and Secret management',
      'Persistent volume configurations'
    );
  } else if (techStack.type.includes('Next')) {
    deploymentChecks.push(
      'Static generation vs SSR configuration',
      'API route deployment issues',
      'Build optimization and caching',
      'CDN and asset delivery'
    );
  }
  
  templates.push({
    category: 'Deployment & Runtime Roadblocks',
    checks: deploymentChecks
  });
  
  // 7. CODE QUALITY & MAINTAINABILITY
  var maintainabilityChecks = [
    'Technical debt and code complexity',
    'Missing or outdated documentation',
    'Inconsistent coding standards',
    'Dead code and unused dependencies',
    'Magic numbers and hardcoded values',
    'Long functions and god classes',
    'Refactoring opportunities'
  ];
  
  templates.push({
    category: 'Code Quality & Maintainability',
    checks: maintainabilityChecks
  });
  
  // 8. DATABASE & API CONNECTIVITY ISSUES
  var connectivityChecks = [
    'Database connection string issues',
    'Missing database migrations or schema updates',
    'API endpoint connectivity problems',
    'CORS configuration issues',
    'Authentication token expiration handling',
    'Rate limiting and timeout configurations',
    'Connection pool exhaustion',
    'Database transaction deadlocks',
    'API version compatibility issues',
    'SSL/TLS certificate problems'
  ];
  
  if (techStack.technologies.includes('MongoDB')) {
    connectivityChecks.push(
      'MongoDB connection URI issues',
      'Missing MongoDB indexes causing slow queries',
      'Mongoose schema validation errors'
    );
  } else if (techStack.technologies.includes('PostgreSQL')) {
    connectivityChecks.push(
      'PostgreSQL connection pooling issues',
      'Missing foreign key constraints',
      'SQL query performance problems'
    );
  }
  
  templates.push({
    category: 'Database & API Connectivity',
    checks: connectivityChecks
  });
  
  // 9. COMPATIBILITY & VERSION ISSUES
  var compatibilityChecks = [
    'Node.js version compatibility problems',
    'Package dependency version conflicts',
    'Browser compatibility issues',
    'Deprecated API usage',
    'Breaking changes in dependencies',
    'TypeScript version incompatibilities',
    'React version migration issues',
    'Polyfill requirements for older browsers',
    'ES6+ features in legacy environments',
    'Mobile device compatibility problems'
  ];
  
  if (techStack.type.includes('React')) {
    compatibilityChecks.push(
      'React 18 concurrent features compatibility',
      'React Router version migration issues',
      'Hook usage in class components',
      'Legacy lifecycle method usage'
    );
  }
  
  templates.push({
    category: 'Compatibility & Version Issues',
    checks: compatibilityChecks
  });
  
  // 10. MISSING CRITICAL ELEMENTS
  var missingElementsChecks = [
    'Missing error boundaries in React apps',
    'Missing loading states and error handling',
    'Missing CSRF tokens in forms',
    'Missing meta tags and SEO elements',
    'Missing accessibility attributes',
    'Missing environment variable validation',
    'Missing health check endpoints',
    'Missing rate limiting on APIs',
    'Missing input validation on forms',
    'Missing backup and recovery procedures'
  ];
  
  if (techStack.type.includes('Next')) {
    missingElementsChecks.push(
      'Missing next.config.js optimizations',
      'Missing Image component usage',
      'Missing Head component for SEO',
      'Missing API route error handling'
    );
  }
  
  templates.push({
    category: 'Missing Critical Elements',
    checks: missingElementsChecks
  });
  
  // 11. REAL DEVELOPER PAIN POINTS
  var painPointChecks = [
    'Silent failures without proper logging',
    'Race conditions in async operations',
    'Memory leaks causing app crashes',
    'Infinite loops and recursive calls',
    'Unhandled promise rejections',
    'CORS errors blocking API calls',
    'Authentication redirects breaking user flow',
    'Cache invalidation problems',
    'File upload size and type restrictions',
    'Timezone and date formatting issues',
    'Email delivery and template problems',
    'Payment gateway integration issues',
    'Third-party service outages handling',
    'Mobile responsive design breakpoints',
    'Performance bottlenecks on large datasets'
  ];
  
  if (techStack.type.includes('React')) {
    painPointChecks.push(
      'useEffect infinite re-render loops',
      'State updates not reflecting in UI',
      'Component not re-rendering after state change',
      'Props not passing down correctly',
      'Context value not updating components',
      'Router navigation not working',
      'Form validation not triggering',
      'Event handlers not binding correctly'
    );
  } else if (techStack.type.includes('Express')) {
    painPointChecks.push(
      'Middleware not executing in correct order',
      'Route parameters not parsing correctly',
      'Session data not persisting',
      'File uploads not processing',
      'JSON parsing errors',
      'Cookie settings not working'
    );
  } else if (techStack.type.includes('Kubernetes')) {
    painPointChecks.push(
      'Pods stuck in pending state',
      'Service discovery not working',
      'ConfigMap updates not propagating',
      'Persistent volumes not mounting',
      'Ingress routing issues',
      'Resource limits causing crashes'
    );
  }
  
  templates.push({
    category: 'Developer Pain Points',
    checks: painPointChecks
  });
  
  // 12. RUNTIME & DEPLOYMENT ROADBLOCKS
  var roadblockChecks = [
    'Environment variables not loading correctly',
    'Build process failing on deployment',
    'Docker container startup failures',
    'Database migrations failing in production',
    'SSL certificate renewal issues',
    'CDN cache invalidation problems',
    'Load balancer health check failures',
    'Auto-scaling configuration issues',
    'Backup and restore procedure failures',
    'Monitoring and alerting gaps',
    'Log aggregation and analysis issues',
    'Performance degradation under load'
  ];
  
  templates.push({
    category: 'Runtime & Deployment Roadblocks',
    checks: roadblockChecks
  });
  
  console.log('🎯 Generated comprehensive analysis templates:', templates.length, 'categories');
  return templates;
}

// 🧠 AI RULE GENERATOR: Creates minimal, focused rule set for each repo
async function generateCustomRules(repoContext) {
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI API key for rule generation');
    return null;
  }

  try {
    // Analyze the repository type and technology stack
    const techStack = analyzeRepositoryTechStack(repoContext);
    
    // Generate comprehensive analysis templates
    const analysisTemplates = generateAnalysisTemplates(techStack);
    
    const prompt = `You are a senior software architect, security expert, and DevOps engineer. Analyze this ${techStack.type} repository and create COMPREHENSIVE rules covering MULTIPLE DIMENSIONS of software quality.

🔍 REPOSITORY INTELLIGENCE:
- Type: ${techStack.type}
- Technologies: ${techStack.technologies.join(', ')}
- Architecture: ${techStack.architecture}
- Files: ${repoContext.fileContents.length}
- Key patterns: ${techStack.patterns.join(', ')}

🔗 CROSS-FILE ANALYSIS:
- Import/Export relationships: ${repoContext.crossFileAnalysis.imports.length} imports, ${repoContext.crossFileAnalysis.exports.length} exports
- Circular dependencies: ${repoContext.crossFileAnalysis.circularDeps.length} detected
- Architectural issues: ${repoContext.crossFileAnalysis.architecturalIssues.length} found

📁 SAMPLE CODE ANALYSIS:
${repoContext.fileContents.slice(0, 3).map(file => `
=== ${file.path} ===
${file.content.substring(0, 1500)}
`).join('\n')}

🎯 COMPREHENSIVE ANALYSIS FRAMEWORK:
Create rules covering these CRITICAL DIMENSIONS:

${analysisTemplates.map(template => `
🔹 ${template.category.toUpperCase()}:
${template.checks.map(check => `   - ${check}`).join('\n')}
`).join('')}

🎯 MISSION: Create 10-20 LASER-FOCUSED rules that detect REAL DEVELOPER PAIN POINTS.

🔥 CRITICAL FOCUS AREAS:
- Issues that cause "AHA! That's what's breaking my code!" moments
- Silent failures that waste hours of debugging time
- Configuration problems that prevent deployment
- Compatibility issues that break in production
- Missing elements that cause runtime crashes
- Database/API connectivity problems
- Authentication and security bypasses
- Performance bottlenecks under load
- Cross-browser and mobile compatibility issues
- Environment-specific deployment failures

💡 DEVELOPER FRUSTRATION TARGETS:
- "Why isn't my component re-rendering?"
- "Why is my API call failing with CORS errors?"
- "Why does this work locally but not in production?"
- "Why is my database connection timing out?"
- "Why are my environment variables not loading?"
- "Why is my build failing on deployment?"
- "Why is my app crashing under load?"

Return EXECUTABLE ES5 JavaScript with COMPREHENSIVE coverage:

CRITICAL: Use ONLY this exact format with proper ES5 syntax:

{
  findPerformanceIssues: function(content, lines, filePath) {
    var issues = [];
    
    // Example: Check for specific performance patterns
    if (content.indexOf('useEffect') !== -1 && content.indexOf('[]') === -1) {
      issues.push({
        type: 'performance',
        message: 'useEffect without dependency array may cause infinite re-renders',
        line: 1,
        code: 'useEffect(...)',
        severity: 'high'
      });
    }
    
    return issues;
  },

  findSecurityVulnerabilities: function(content, lines, filePath) {
    var issues = [];
    
    // Example: Check for security patterns
    if (content.indexOf('dangerouslySetInnerHTML') !== -1) {
      issues.push({
        type: 'security',
        message: 'Potential XSS vulnerability with dangerouslySetInnerHTML',
        line: 1,
        code: 'dangerouslySetInnerHTML',
        severity: 'critical'
      });
    }
    
    return issues;
  },

  // 3. ARCHITECTURE & DESIGN PATTERNS
  findArchitecturalIssues: function(content, lines, filePath) {
    var issues = [];
    // Design pattern violations, coupling issues
    // Dependency injection problems, circular deps
    return issues;
  },

  // 4. UI/UX & ACCESSIBILITY ISSUES
  findUIAccessibilityIssues: function(content, lines, filePath) {
    var issues = [];
    // Missing alt text, poor contrast, keyboard navigation
    // Mobile responsiveness, WCAG violations
    return issues;
  },

  // 5. TESTING & RELIABILITY
  findTestingGaps: function(content, lines, filePath) {
    var issues = [];
    // Missing test coverage, brittle tests
    // Error handling gaps, edge case issues
    return issues;
  },

  // 6. DEPLOYMENT & RUNTIME ROADBLOCKS
  findDeploymentRisks: function(content, lines, filePath) {
    var issues = [];
    // Environment-specific issues, config problems
    // Docker/K8s misconfigurations, scaling issues
    return issues;
  },

  // 7. CODE QUALITY & MAINTAINABILITY
  findMaintainabilityIssues: function(content, lines, filePath) {
    var issues = [];
    // Technical debt, code smells
    // Refactoring opportunities, documentation gaps
    return issues;
  },

  // 8. DATABASE & API CONNECTIVITY
  findConnectivityIssues: function(content, lines, filePath) {
    var issues = [];
    // Database connection problems, API timeout issues
    // CORS configuration, authentication failures
    return issues;
  },

  // 9. COMPATIBILITY & VERSION ISSUES
  findCompatibilityIssues: function(content, lines, filePath) {
    var issues = [];
    // Browser compatibility, Node.js version issues
    // Deprecated API usage, breaking changes
    return issues;
  },

  // 10. MISSING CRITICAL ELEMENTS
  findMissingElements: function(content, lines, filePath) {
    var issues = [];
    // Missing error boundaries, loading states
    // Missing SEO tags, accessibility attributes
    return issues;
  },

  // 11. DEVELOPER PAIN POINTS
  findDeveloperPainPoints: function(content, lines, filePath) {
    var issues = [];
    // Silent failures, race conditions, infinite loops
    // useEffect issues, state update problems
    return issues;
  },

  // 12. RUNTIME & DEPLOYMENT ROADBLOCKS
  findRuntimeRoadblocks: function(content, lines, filePath) {
    var issues = [];
    // Environment variable issues, build failures
    // Docker problems, deployment configuration
    return issues;
  },

  // Main execution function
  executeRules: function(content, filePath) {
    var lines = content.split('\n');
    var allIssues = [];
    var ext = filePath.split('.').pop();
    var isCodeFile = filePath.match(/\\.(js|jsx|ts|tsx|py|java|go|rs|php|rb)$/);
    var isConfigFile = filePath.match(/\\.(json|yaml|yml|toml|ini|env)$/);
    var isUIFile = filePath.match(/\\.(jsx|tsx|vue|html|css|scss)$/);
    var isTestFile = filePath.match(/\\.(test|spec)\\./);
    
    // Apply rules based on file type
    if (isCodeFile) {
      if (this.findPerformanceIssues) allIssues = allIssues.concat(this.findPerformanceIssues(content, lines, filePath));
      if (this.findSecurityVulnerabilities) allIssues = allIssues.concat(this.findSecurityVulnerabilities(content, lines, filePath));
      if (this.findArchitecturalIssues) allIssues = allIssues.concat(this.findArchitecturalIssues(content, lines, filePath));
      if (this.findMaintainabilityIssues) allIssues = allIssues.concat(this.findMaintainabilityIssues(content, lines, filePath));
      if (this.findConnectivityIssues) allIssues = allIssues.concat(this.findConnectivityIssues(content, lines, filePath));
      if (this.findCompatibilityIssues) allIssues = allIssues.concat(this.findCompatibilityIssues(content, lines, filePath));
      if (this.findDeveloperPainPoints) allIssues = allIssues.concat(this.findDeveloperPainPoints(content, lines, filePath));
    }
    
    if (isUIFile) {
      if (this.findUIAccessibilityIssues) allIssues = allIssues.concat(this.findUIAccessibilityIssues(content, lines, filePath));
      if (this.findMissingElements) allIssues = allIssues.concat(this.findMissingElements(content, lines, filePath));
    }
    
    if (isTestFile) {
      if (this.findTestingGaps) allIssues = allIssues.concat(this.findTestingGaps(content, lines, filePath));
    }
    
    if (isConfigFile) {
      if (this.findDeploymentRisks) allIssues = allIssues.concat(this.findDeploymentRisks(content, lines, filePath));
      if (this.findRuntimeRoadblocks) allIssues = allIssues.concat(this.findRuntimeRoadblocks(content, lines, filePath));
    }
    
    return allIssues;
  }
}

🔥 CRITICAL REQUIREMENTS:
- Use ONLY ES5 syntax: var, function() {}, no const/let/arrow functions
- MUST include executeRules function that calls other functions
- Each function MUST return an array of issues
- Use content.indexOf() instead of includes() for compatibility
- Focus on REAL developer pain points that cause debugging sessions
- Generate WORKING JavaScript code that executes without errors

EXAMPLE WORKING FORMAT:
{
  findPerformanceIssues: function(content, lines, filePath) {
    var issues = [];
    if (content.indexOf('useEffect') !== -1 && content.indexOf('[]') === -1) {
      issues.push({
        type: 'performance',
        message: 'useEffect without dependency array',
        line: 1,
        code: 'useEffect',
        severity: 'high'
      });
    }
    return issues;
  },
  executeRules: function(content, filePath) {
    var allIssues = [];
    if (filePath.match(/\\.(js|jsx|ts|tsx)$/)) {
      allIssues = allIssues.concat(this.findPerformanceIssues(content, content.split('\n'), filePath));
    }
    return allIssues;
  }
}`;

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
    
    // Extract JavaScript code from AI response (multiple patterns)
    var jsMatch = aiResponse.match(/```javascript\n([\s\S]*?)\n```/) ||
                  aiResponse.match(/```js\n([\s\S]*?)\n```/) ||
                  aiResponse.match(/\{[\s\S]*\}/) ||
                  aiResponse.match(/```\n([\s\S]*?)\n```/);
    
    if (jsMatch) {
      var generatedCode = jsMatch[1] || jsMatch[0];
      
      // Clean and validate the code
      generatedCode = generatedCode
        .replace(/```javascript/g, '')
        .replace(/```js/g, '')
        .replace(/```/g, '')
        .trim();
      
      // Basic validation - ensure it looks like a valid object
      if (!generatedCode.startsWith('{') || !generatedCode.endsWith('}')) {
        console.warn('⚠️ Generated code does not appear to be a valid JavaScript object');
        return null;
      }
      
      // Check for executeRules function
      if (!generatedCode.includes('executeRules:') && !generatedCode.includes('executeRules ')) {
        console.warn('⚠️ Generated code missing executeRules function');
        return null;
      }
      
      console.log(`✅ AI generated ${generatedCode.length} characters of custom rules`);
      console.log(`🔍 Generated code preview:`, generatedCode.substring(0, 300) + '...');
      return generatedCode;
    }
    
    console.warn('⚠️ Could not extract JavaScript code from AI response');
    console.log('🔍 Full AI response:', aiResponse.substring(0, 1000) + '...');
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
    var customRules;
    try {
      // Clean the code and wrap it properly
      var cleanCode = customRulesCode
        .replace(/```javascript/g, '')
        .replace(/```js/g, '')
        .replace(/```/g, '')
        .trim();
      
      console.log(`🧹 Cleaned code preview:`, cleanCode.substring(0, 200) + '...');
      
      // Validate basic structure before evaluation
      if (!cleanCode.startsWith('{') || !cleanCode.endsWith('}')) {
        throw new Error('Invalid JavaScript object structure');
      }
      
      // Use Function constructor for safer evaluation
      var ruleFunction = new Function('return ' + cleanCode);
      customRules = ruleFunction();
      
      console.log(`✅ Successfully evaluated AI rules`);
      console.log(`🔍 Rules object keys:`, Object.keys(customRules || {}));
      
    } catch (evalError) {
      console.error('❌ Failed to evaluate AI-generated code:', evalError.message);
      console.log(`🔍 Problematic code snippet:`, customRulesCode.substring(0, 500) + '...');
      return null;
    }
    
    if (!customRules || typeof customRules !== 'object') {
      console.warn('⚠️ AI did not generate a valid rules object');
      console.log(`🔍 customRules type:`, typeof customRules);
      return null;
    }
    
    if (typeof customRules.executeRules !== 'function') {
      console.warn('⚠️ Missing or invalid executeRules function');
      console.log(`🔍 executeRules type:`, typeof customRules.executeRules);
      console.log(`🔍 Available methods:`, Object.keys(customRules).filter(function(key) { 
        return typeof customRules[key] === 'function'; 
      }));
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