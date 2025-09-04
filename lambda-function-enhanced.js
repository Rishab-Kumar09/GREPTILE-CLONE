import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export const handler = async (event) => {
  console.log('🚀 Enhanced Lambda analyzer started (v2.1 with detailed early return logging):', JSON.stringify(event));
  
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
    
    for (const file of filesToProcess) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(tempDir, file);
        const issues = analyzeFile(relativePath, content);
        
        processedFiles++;
        
        // DEBUG: Log every file analysis for debugging
        if (processedFiles <= 5 || issues.length > 0) {
          console.log(`🔍 File ${processedFiles}: ${relativePath} → ${issues.length} issues`);
          if (issues.length > 0) {
            console.log(`   Issues:`, issues.map(i => i.type).join(', '));
          }
        }
        
        if (issues.length > 0) {
          results.push({
            file: relativePath,
            issues: issues
          });
          totalIssues += issues.length;
        }
        
        // Progress logging every 200 files
        if (processedFiles % 200 === 0) {
          console.log(`📊 Progress: ${processedFiles}/${filesToProcess.length} files, ${totalIssues} issues found`);
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

function analyzeFile(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  const ext = path.extname(filePath).toLowerCase();
  
  // Skip very large files to prevent timeouts
  if (lines.length > 10000) {
    return [{
      type: 'performance',
      message: 'Extremely large file may impact performance',
      line: 1,
      code: `File has ${lines.length} lines - consider splitting`,
      severity: 'high'
    }];
  }
  
  // GREPTILE-INSPIRED ANALYSIS: Context-aware, selective, professional
  // Target: 0-3 issues per file (realistic for quality code)
  // Focus: ONLY critical bugs, security risks, and obvious problems
  
  // Build context about the file
  const hasDatabase = content.includes('SELECT') || content.includes('query') || content.includes('sql');
  const hasAuth = content.includes('password') || content.includes('token') || content.includes('auth');
  const hasAsync = content.includes('await') || content.includes('Promise');
  const isTestFile = filePath.includes('test') || filePath.includes('spec') || filePath.includes('__test__');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip empty lines, comments, and very long lines
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.length > 500) return;
    
    // === CONTEXT-AWARE SECURITY ANALYSIS ===
    
    // 1. Hardcoded secrets (only in auth-related files)
    if (hasAuth && trimmedLine.match(/(password|secret|token|apikey|api_key|auth_token|private_key)\s*[=:]\s*["'`][^"'`\s]{8,}["'`]/i)) {
      // Only flag if it's a long string (8+ chars) that looks like a real secret
      issues.push({
        type: 'security',
        message: 'Hardcoded secret detected - use environment variables',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
    
    // 2. SQL Injection (only in database-related files)
    if (hasDatabase && trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE).*\+.*["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'SQL injection risk - use parameterized queries',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'critical'
      });
    }
    
    // 3. XSS vulnerabilities (only check in frontend files)
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
    
    // === CRITICAL PERFORMANCE ISSUES (Context-aware) ===
    
    // 4. Synchronous operations in async context (only in async files)
    if (hasAsync && trimmedLine.match(/await.*\.sync\(|await.*Sync\(/)) {
      issues.push({
        type: 'performance',
        message: 'Synchronous operation in async context - blocks event loop',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // === CRITICAL ERROR HANDLING (Selective) ===
    
    // 5. Empty catch blocks (only flag obvious ones)
    if (trimmedLine.match(/catch\s*\([^)]*\)\s*{\s*}$/)) {
      issues.push({
        type: 'error-handling',
        message: 'Empty catch block - handle errors properly',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // GREPTILE-STYLE: REMOVED 11 noisy checks that cause false positives
    // Professional tools focus on CRITICAL issues, not every pattern
  });
  
  // === FILE-LEVEL ANALYSIS (ONLY CRITICAL) ===
  
  // REMOVED: Large file detection (subjective - some files need to be large)
  // REMOVED: Missing async error handling (too broad - many files don't need it)
  
  return issues;
}