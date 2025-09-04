import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export const handler = async (event) => {
  console.log('🚀 Enhanced Lambda analyzer started:', JSON.stringify(event));
  
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
    
    const allFiles = await findCodeFiles(tempDir, null); // No directory filtering - get ALL files
    console.log(`📊 Found ${allFiles.length} total code files in repository`);
    
    // Step 3: Handle file-based batching
    let filesToProcess = allFiles;
    let isLastBatch = true;
    
    if (isFileBatched) {
      // FILE-BASED BATCHING: Process files in chunks
      const filesPerBatch = 200; // Process 200 files per batch
      const startIndex = (batchNumber - 1) * filesPerBatch;
      const endIndex = startIndex + filesPerBatch;
      
      filesToProcess = allFiles.slice(startIndex, endIndex);
      isLastBatch = endIndex >= allFiles.length;
      
      console.log(`📦 File batch ${batchNumber}: Processing files ${startIndex + 1}-${Math.min(endIndex, allFiles.length)} of ${allFiles.length}`);
      console.log(`🏁 Is last batch: ${isLastBatch}`);
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
        
        if (issues.length > 0) {
          results.push({
            file: relativePath,
            issues: issues
          });
          totalIssues += issues.length;
        }
        
        // Progress logging every 200 files
        if (processedFiles % 200 === 0) {
          console.log(`📊 Progress: ${processedFiles}/${files.length} files, ${totalIssues} issues found`);
        }
        
      } catch (err) {
        console.warn(`Failed to analyze ${file}:`, err.message);
        processedFiles++;
      }
    }
    
    console.log(`✅ Analysis complete: ${processedFiles} files processed, ${results.length} files with issues, ${totalIssues} total issues`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
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
      })
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

async function findCodeFiles(dir, batchPath = null) {
  const files = [];
  
  // Priority file extensions - most important first
  const highPriorityExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'];
  const mediumPriorityExts = ['.cpp', '.c', '.h', '.php', '.rb', '.swift', '.kt'];
  const lowPriorityExts = ['.css', '.scss', '.html', '.json', '.yaml', '.yml', '.md'];
  
  const allExts = [...highPriorityExts, ...mediumPriorityExts, ...lowPriorityExts];
  
  // Determine scan directory based on batch
  let scanDir = dir;
  if (batchPath && batchPath !== '') {
    scanDir = path.join(dir, batchPath);
    console.log(`🎯 Scanning batch directory: ${scanDir}`);
    
    // Check if batch directory exists
    try {
      await fs.access(scanDir);
    } catch (error) {
      console.warn(`⚠️ Batch directory ${batchPath} not found, scanning root`);
      scanDir = dir;
    }
  }
  
  try {
    await scanDirectory(scanDir, files, allExts, 0);
  } catch (error) {
    console.warn(`Failed to scan directory ${scanDir}:`, error.message);
  }
  
  // Filter files by batch path if specified
  let filteredFiles = files;
  if (batchPath && batchPath !== '') {
    const batchPrefix = path.join(dir, batchPath);
    filteredFiles = files.filter(f => f.startsWith(batchPrefix));
    console.log(`🔍 Filtered to ${filteredFiles.length} files in ${batchPath} directory`);
  }
  
  // Sort by priority and limit to reasonable number
  const prioritizedFiles = [
    ...filteredFiles.filter(f => highPriorityExts.includes(path.extname(f).toLowerCase())),
    ...filteredFiles.filter(f => mediumPriorityExts.includes(path.extname(f).toLowerCase())),
    ...filteredFiles.filter(f => lowPriorityExts.includes(path.extname(f).toLowerCase()))
  ];
  
  // Return up to 800 files (good balance)
  return prioritizedFiles.slice(0, 800);
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
  if (lines.length > 5000) {
    return [{
      type: 'performance',
      message: 'Extremely large file may impact performance',
      line: 1,
      code: `File has ${lines.length} lines - consider splitting`,
      severity: 'medium'
    }];
  }
  
  // Track context for smarter analysis
  let inFunction = false;
  let functionComplexity = 0;
  let currentFunction = '';
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    const originalLine = line;
    
    // Skip empty lines and very long lines
    if (!trimmedLine || trimmedLine.length > 500) return;
    
    // === SECURITY VULNERABILITIES ===
    
    // 1. Hardcoded secrets/passwords
    if (trimmedLine.match(/(password|secret|token|apikey|api_key|auth_token|private_key)\s*[=:]\s*["'`][^"'`\s]+["'`]/i)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded secret detected - use environment variables',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // 2. SQL Injection risks
    if (trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE).*\+.*["'`]/i) || 
        trimmedLine.match(/query\s*\(\s*["'`][^"'`]*\+/i)) {
      issues.push({
        type: 'security',
        message: 'Potential SQL injection - use parameterized queries',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // 3. XSS vulnerabilities
    if (trimmedLine.match(/innerHTML\s*=\s*.*\+|dangerouslySetInnerHTML.*\+/i)) {
      issues.push({
        type: 'security',
        message: 'Potential XSS vulnerability - sanitize user input',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // 4. Insecure HTTP requests
    if (trimmedLine.match(/fetch\s*\(\s*["'`]http:\/\/|axios\.get\s*\(\s*["'`]http:\/\//i)) {
      issues.push({
        type: 'security',
        message: 'Insecure HTTP request - use HTTPS',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // === PERFORMANCE ISSUES ===
    
    // 5. Inefficient loops
    if (trimmedLine.match(/for\s*\([^)]*\.length\s*;\s*[^)]*\+\+/) && 
        content.includes('.push(') && content.includes('.length')) {
      issues.push({
        type: 'performance',
        message: 'Inefficient array operations - consider using map/filter',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // 6. Memory leaks - event listeners not removed
    if (trimmedLine.match(/addEventListener\s*\(/i) && 
        !content.includes('removeEventListener')) {
      issues.push({
        type: 'performance',
        message: 'Potential memory leak - missing removeEventListener',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // 7. Synchronous operations in async context
    if (trimmedLine.match(/await.*\.sync\(|await.*Sync\(/)) {
      issues.push({
        type: 'performance',
        message: 'Synchronous operation in async context - blocks event loop',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // === CODE QUALITY ISSUES ===
    
    // 8. Overly complex functions (high cyclomatic complexity)
    if (trimmedLine.match(/^(function|const\s+\w+\s*=|async\s+function)/)) {
      inFunction = true;
      functionComplexity = 0;
      currentFunction = trimmedLine.substring(0, 50);
    }
    
    if (inFunction) {
      if (trimmedLine.match(/\b(if|else if|while|for|switch|catch|&&|\|\||\?)\b/)) {
        functionComplexity++;
      }
      if (trimmedLine.match(/^}/)) {
        if (functionComplexity > 10) {
          issues.push({
            type: 'maintainability',
            message: `High complexity function (${functionComplexity}) - consider refactoring`,
            line: lineNum - 20, // Approximate function start
            code: currentFunction,
            severity: 'medium'
          });
        }
        inFunction = false;
      }
    }
    
    // 9. Magic numbers
    if (trimmedLine.match(/\b\d{3,}\b/) && !trimmedLine.match(/^\s*(\/\/|\/\*|\*|console\.|return\s+\d+)/)) {
      issues.push({
        type: 'maintainability',
        message: 'Magic number detected - use named constants',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }
    
    // 10. Dead code - unused variables/imports
    if (trimmedLine.match(/^import.*from/) && !trimmedLine.includes('* as')) {
      const importMatch = trimmedLine.match(/import\s+{([^}]+)}/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(s => s.trim());
        imports.forEach(imp => {
          if (!content.includes(imp.replace(/\s+as\s+\w+/, ''))) {
            issues.push({
              type: 'maintainability',
              message: `Unused import: ${imp}`,
              line: lineNum,
              code: trimmedLine.substring(0, 100),
              severity: 'low'
            });
          }
        });
      }
    }
    
    // === BAD PRACTICES ===
    
    // 11. Console logs in production code
    if (trimmedLine.match(/console\.(log|debug|info|warn)\s*\(/)) {
      issues.push({
        type: 'code-smell',
        message: 'Console log in production code - remove or use proper logging',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }
    
    // 12. TODO/FIXME comments
    if (trimmedLine.match(/\/\/\s*(TODO|FIXME|HACK|BUG)/i)) {
      issues.push({
        type: 'maintainability',
        message: 'Unresolved TODO/FIXME comment',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }
    
    // 13. Empty catch blocks
    if (trimmedLine.match(/catch\s*\([^)]*\)\s*{\s*}/) || 
        (trimmedLine.includes('catch') && lines[index + 1]?.trim() === '}')) {
      issues.push({
        type: 'error-handling',
        message: 'Empty catch block - handle errors properly',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // 14. Deeply nested code
    const indentLevel = (originalLine.match(/^\s*/)?.[0]?.length || 0) / 2;
    if (indentLevel > 6) {
      issues.push({
        type: 'maintainability',
        message: `Deeply nested code (${indentLevel} levels) - consider refactoring`,
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // 15. Long parameter lists
    const paramMatch = trimmedLine.match(/function\s+\w+\s*\(([^)]+)\)/);
    if (paramMatch && paramMatch[1].split(',').length > 5) {
      issues.push({
        type: 'maintainability',
        message: 'Too many parameters - consider using object parameter',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });
  
  // === FILE-LEVEL ANALYSIS ===
  
  // 16. Very long files
  if (lines.length > 300) {
    issues.push({
      type: 'maintainability',
      message: `Large file (${lines.length} lines) - consider splitting into smaller modules`,
      line: 1,
      code: `File: ${path.basename(filePath)}`,
      severity: 'medium'
    });
  }
  
  // 17. Missing error handling for async operations
  if (content.includes('await ') && !content.includes('try') && !content.includes('catch')) {
    issues.push({
      type: 'error-handling',
      message: 'Async operations without error handling',
      line: 1,
      code: 'Add try-catch blocks for async operations',
      severity: 'medium'
    });
  }
  
  return issues;
}