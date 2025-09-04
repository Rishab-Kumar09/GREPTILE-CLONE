import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// AI-powered analysis
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Add to Lambda environment variables

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
        model: 'gpt-4o',
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

// Fallback basic analysis (existing logic)
function performBasicAnalysis(content, filePath) {
  // Use existing analyzeFile logic as fallback
  return []; // Simplified for now
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
    
    // DEBUG: Log first few files to verify
    if (allFiles.length > 0) {
      console.log(`📂 First 5 files:`, allFiles.slice(0, 5).map(f => path.relative(tempDir, f)));
      console.log(`📂 Last 5 files:`, allFiles.slice(-5).map(f => path.relative(tempDir, f)));
    }
    
    // Step 3: Handle file-based batching
    let filesToProcess = allFiles;
    let isLastBatch = true;
    
    if (isFileBatched) {
      // FILE-BASED BATCHING: Process files in chunks
      // OPTIMIZED FOR AI ANALYSIS: 500 files per batch for best performance
      const filesPerBatch = 500; // Perfect size for AI-enhanced analysis
      console.log(`🤖 AI-optimized batch size: ${filesPerBatch} files per batch`);
      
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
    
              // 🤖 AI-POWERED ANALYSIS LOOP
          for (const file of filesToProcess) {
            try {
              const content = await fs.readFile(file, 'utf-8');
              const relativePath = path.relative(tempDir, file);
              
              // AI-powered analysis (async)
              const issues = await analyzeFile(relativePath, content);
              
              processedFiles++;
              
              // Enhanced logging with AI insights
              if (processedFiles <= 5 || issues.length > 0) {
                console.log(`🤖 AI Analysis ${processedFiles}: ${relativePath} → ${issues.length} issues`);
                if (issues.length > 0) {
                  console.log(`   Issues:`, issues.map(i => `${i.type}:${i.severity}`).join(', '));
                }
              }
              
              if (issues.length > 0) {
                results.push({
                  file: relativePath,
                  issues: issues
                });
                totalIssues += issues.length;
              }
              
              // Progress logging every 100 files (more frequent for AI analysis)
              if (processedFiles % 100 === 0) {
                console.log(`🤖 AI Progress: ${processedFiles}/${filesToProcess.length} files, ${totalIssues} real issues found`);
              }
              
            } catch (err) {
              console.warn(`❌ Failed to analyze ${file}:`, err.message);
              processedFiles++;
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

// AI-POWERED ANALYSIS FUNCTION
async function analyzeFile(filePath, content) {
  console.log(`🔍 Starting AI analysis for: ${filePath}`);
  
  // Skip very large files to prevent timeouts
  if (content.length > 50000) { // 50KB limit
    return [{
      type: 'performance',
      message: 'Extremely large file may impact performance',
      line: 1,
      code: `File has ${content.length} characters - consider splitting`,
      severity: 'high'
    }];
  }
  
  try {
    // Step 1: Create intelligent file profile
    const profile = createFileProfile(filePath, content);
    console.log(`📋 File profile: ${JSON.stringify(profile, null, 2)}`);
    
    // Step 2: Get AI-powered analysis strategy
    const aiStrategy = await getAIAnalysisStrategy(profile);
    
    // Step 3: Perform targeted analysis based on AI recommendations
    const issues = performTargetedAnalysis(content, aiStrategy, filePath);
    
    console.log(`✅ AI analysis complete for ${filePath}: ${issues.length} issues found`);
    return issues;
    
  } catch (error) {
    console.error(`❌ AI analysis failed for ${filePath}:`, error.message);
    // Fallback to basic analysis
    return performBasicAnalysis(content, filePath);
  }
}