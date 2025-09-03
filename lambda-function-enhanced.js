const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Helper function to get file priority for analysis
const getFilePriority = (ext) => {
  switch (ext) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
      return 1; // High priority for JS/TS files
    case '.py':
    case '.java':
    case '.go':
    case '.rs':
    case '.cpp':
    case '.c':
    case '.h':
      return 2; // Medium priority for other backend/compiled languages
    case '.html':
    case '.css':
    case '.scss':
    case '.vue':
    case '.json':
    case '.yml':
    case '.yaml':
    case '.xml':
    case '.md':
      return 3; // Lower priority for markup/config/docs
    default:
      return 4; // Lowest priority
  }
};

exports.handler = async (event) => {
  console.log('🚀 Enhanced Lambda analyzer started:', JSON.stringify(event));

  const { repoUrl, analysisId, batchPath = null } = JSON.parse(event.body || '{}');

  if (!repoUrl || !analysisId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'repoUrl and analysisId required' })
    };
  }

  console.log(`📦 Batch path: ${batchPath || 'FULL REPO'}`);
  const isBatchedAnalysis = !!batchPath;

  const tempDir = path.join('/tmp', `analysis-${Date.now()}`);
  const results = [];
  let processedFilesCount = 0;
  let filesWithIssuesCount = 0;
  // REMOVE ALL LIMITS - analyze everything!
  // const MAX_FILES_TO_ANALYZE = 800; // REMOVED
  // const MAX_FILE_SIZE_LINES = 5000; // REMOVED

  try {
    // Step 1: Clone repository
    console.log('📥 Cloning repository...');
    await fs.mkdir(tempDir, { recursive: true });

    const gitPath = '/opt/bin/git'; // From our git layer
    
    if (isBatchedAnalysis && batchPath !== null) {
      // SPARSE CHECKOUT - clone only specific directory
      console.log(`🎯 BATCHED CLONE: Only analyzing "${batchPath}" (empty = root files)`);
      
      try {
        // DEBUGGING: Log exact batch path and type
        console.log(`📋 DEBUG - batchPath: "${batchPath}", type: ${typeof batchPath}, length: ${batchPath.length}`);
        
        // Step 1: Clone with sparse checkout support
        execSync(`${gitPath} clone --filter=blob:none --no-checkout --depth=1 "${repoUrl}" "${tempDir}"`, { stdio: 'pipe' });
        console.log('✅ Initial clone successful');
        
        // Step 2: Configure sparse checkout
        execSync(`cd "${tempDir}" && ${gitPath} sparse-checkout init --cone`, { stdio: 'pipe' });
        console.log('✅ Sparse checkout initialized');
        
        // Step 3: Set sparse checkout patterns
        let sparsePattern;
        if (batchPath === '' || batchPath === '/') {
          // Root files only - exclude all directories
          sparsePattern = '/*\n!/*/';
          console.log('📁 Configuring for ROOT FILES ONLY');
        } else {
          // Specific directory
          sparsePattern = batchPath.endsWith('/') ? batchPath : batchPath + '/';
          console.log(`📁 Configuring for DIRECTORY: ${sparsePattern}`);
        }
        
        execSync(`cd "${tempDir}" && echo "${sparsePattern}" | ${gitPath} sparse-checkout set --stdin`, { stdio: 'pipe' });
        console.log(`✅ Sparse checkout pattern set: ${sparsePattern}`);
        
        // Step 4: Checkout files
        execSync(`cd "${tempDir}" && ${gitPath} checkout`, { stdio: 'pipe' });
        console.log('✅ Files checked out');
        
        // DEBUGGING: List what we actually got
        try {
          const lsResult = execSync(`find "${tempDir}" -type f -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.py" | head -10`, { encoding: 'utf8' });
          console.log(`🔍 DEBUG - Sample files found:\n${lsResult}`);
        } catch (lsError) {
          console.log('🔍 DEBUG - No sample files found or ls failed');
        }
        
        console.log(`✅ Sparse clone successful for "${batchPath}"`);
      } catch (sparseError) {
        console.error(`❌ Sparse checkout failed:`, sparseError.message);
        console.error(`❌ Error details:`, sparseError);
        
        // Fallback to full clone if sparse fails
        console.log('🔄 Falling back to full clone...');
        execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
        await fs.mkdir(tempDir, { recursive: true });
        const fallbackCmd = `${gitPath} clone --depth 1 "${repoUrl}" "${tempDir}"`;
        execSync(fallbackCmd, { stdio: 'pipe' });
        console.log('✅ Fallback full clone successful');
      }
    } else {
      // FULL REPO CLONE (for smaller repos)
      const cloneCmd = `${gitPath} clone --depth 1 --single-branch --no-tags "${repoUrl}" "${tempDir}"`;
      console.log('Full shallow clone command:', cloneCmd);
      execSync(cloneCmd, { stdio: 'pipe' });
      console.log('✅ Full shallow clone successful');
    }

    // Step 2: Find files
    console.log('📁 Finding files...');
    let files = await findFiles(tempDir, 0); // Start depth at 0
    console.log(`Found ${files.length} files`);
    
    // DEBUGGING: Show sample file paths to verify sparse checkout worked
    if (files.length > 0) {
      const sampleFiles = files.slice(0, 10).map(f => f.replace(tempDir, ''));
      console.log(`🔍 DEBUG - Sample file paths:\n${sampleFiles.join('\n')}`);
      
      // Show directory distribution
      const dirCounts = {};
      files.forEach(f => {
        const relativePath = f.replace(tempDir, '');
        const topDir = relativePath.split('/')[1] || 'root';
        dirCounts[topDir] = (dirCounts[topDir] || 0) + 1;
      });
      console.log(`📊 DEBUG - Files by directory:`, dirCounts);
    }

    // Sort files by priority to analyze more relevant files first
    files.sort((a, b) => {
      const extA = path.extname(a).toLowerCase();
      const extB = path.extname(b).toLowerCase();
      return getFilePriority(extA) - getFilePriority(extB);
    });

    // Step 3: Analyze ALL files (NO LIMITS!)
    console.log(`🔍 Analyzing ALL ${files.length} files...`);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const stats = await fs.stat(file);
        
        // Skip files larger than 10MB to save memory (increased from 5MB)
        if (stats.size > 10 * 1024 * 1024) {
          console.log(`⚠️ Skipping large file ${path.relative(tempDir, file)} (${Math.round(stats.size / 1024 / 1024)}MB)`);
          processedFilesCount++;
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Skip files with too many lines (likely generated/minified) - increased from 15k to 25k
        if (lines.length > 25000) {
          console.log(`⚠️ Skipping file with many lines ${path.relative(tempDir, file)} (${lines.length} lines)`);
          processedFilesCount++;
          continue;
        }

        const relativePath = path.relative(tempDir, file);
        const issues = analyzeFileForSpecificIssues(relativePath, content);

        processedFilesCount++;

        if (issues.length > 0) {
          filesWithIssuesCount++;
          results.push({
            file: relativePath,
            issues: issues
          });
        }

        // Progress logging every 1000 files
        if (processedFilesCount % 1000 === 0) {
          console.log(`📊 Progress: ${processedFilesCount}/${files.length} files processed, ${filesWithIssuesCount} files with issues, ${results.reduce((sum, r) => sum + r.issues.length, 0)} total issues`);
        }

      } catch (err) {
        console.warn(`Failed to analyze ${file}:`, err.message);
        processedFilesCount++;
      }
    }

    console.log(`📊 Final: ${processedFilesCount} files processed, ${filesWithIssuesCount} files with issues, ${results.reduce((sum, r) => sum + r.issues.length, 0)} total issues found`);
    console.log(`✅ SUPER SHALLOW Analysis complete: ${results.length} files with issues`);

    // Check response size to prevent API Gateway 6MB limit
    const responseSize = JSON.stringify(results).length;
    console.log(`📏 Response size: ${Math.round(responseSize / 1024 / 1024 * 100) / 100}MB`);
    
    if (responseSize > 5 * 1024 * 1024) { // 5MB safety limit
      console.log(`⚠️ Response too large, truncating to first 1000 files with issues`);
      results.splice(1000); // Keep only first 1000 files with issues
    }

    // DEBUG: Sample of issues for debugging
    const sampleIssues = results.slice(0, 10).map(r => ({
      file: r.file,
      issueCount: r.issues.length,
      firstIssue: r.issues[0] ? {
        type: r.issues[0].type,
        message: r.issues[0].message,
        line: r.issues[0].line
      } : null
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId,
        results,
        message: `${isBatchedAnalysis ? `BATCH [${batchPath}]` : 'FULL'} Analysis complete: ${results.reduce((sum, r) => sum + r.issues.length, 0)} issues found in ${filesWithIssuesCount} files (${processedFilesCount} total files processed)`,
        isBatch: isBatchedAnalysis,
        batchPath: batchPath,
        needsMoreBatches: false, // Frontend can determine this
        debugSample: sampleIssues // DEBUG: Show sample of issues
      })
    };

  } catch (error) {
    console.error('❌ Analysis failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Unknown analysis error'
      })
    };

  } finally {
    // Cleanup
    try {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
      console.log('🗑️ Cleanup successful');
    } catch (err) {
      console.warn('Cleanup failed:', err.message);
    }
  }
};

async function findFiles(dir, depth) {
  const files = [];
  const MAX_DEPTH = 8; // Increased depth for more coverage
  const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.vscode', 'vendor', 'target', '__pycache__'];

  if (depth > MAX_DEPTH) {
    return [];
  }

  try {
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith('.') || EXCLUDE_DIRS.includes(item.name)) continue;

      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        const subFiles = await findFiles(fullPath, depth + 1);
        files.push(...subFiles);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        const codeExtensions = [
          // JavaScript/TypeScript
          '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
          // Web
          '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
          // Backend
          '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h', '.hpp', '.cc',
          '.php', '.rb', '.cs', '.fs', '.scala', '.clj', '.hs',
          // Mobile
          '.swift', '.kt', '.dart', '.m', '.mm',
          // Data/Config
          '.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.cfg',
          '.sql', '.graphql', '.proto',
          // Scripts/Shell
          '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat',
          // Documentation (selective)
          '.md', '.rst', '.txt'
        ];

        if (codeExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error.message);
  }

  return files;
}

function analyzeFileForSpecificIssues(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  const fileExt = path.extname(filePath).toLowerCase();
  
  // DEBUG: Track what issues are found
  let issueTypes = {};

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Skip empty lines and very long lines
    if (!trimmedLine || trimmedLine.length > 500) return;

    // HARDCODED VALUES - Like Reviews page shows
    if (trimmedLine.match(/=\s*["'](localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded IP address detected',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }

    // Hardcoded project names, titles, etc.
    if (trimmedLine.match(/name\s*[=:]\s*["'][A-Z][^"']*["']/) && 
        !trimmedLine.includes('${') && !trimmedLine.includes('process.env')) {
      issues.push({
        type: 'config',
        message: 'Hardcoded project name instead of using a variable or configuration',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }

    // CODE SMELLS - Like Reviews page
    if (trimmedLine.includes('console.log') || trimmedLine.includes('print(') || 
        trimmedLine.includes('System.out.println') || trimmedLine.includes('fmt.Println')) {
      issues.push({
        type: 'smell',
        message: 'Debug statement should be removed before production',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }

    // TODO/FIXME comments
    if (trimmedLine.match(/(TODO|FIXME|HACK|XXX)/i)) {
      issues.push({
        type: 'smell',
        message: 'Unresolved TODO/FIXME comment',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }

    // BEST PRACTICES - Markdown specific (like Reviews page shows)
    if (fileExt === '.md') {
      // Code block language identifier
      if (trimmedLine === '```' || trimmedLine.startsWith('```') && trimmedLine.length <= 5) {
        issues.push({
          type: 'bestpractice',
          message: 'Code block language identifier should be specified',
          line: lineNum,
          code: trimmedLine,
          severity: 'medium'
        });
      }

      // Unclear instructions
      if (trimmedLine.match(/click|press|enter/i) && 
          !trimmedLine.match(/(left|right|double|ctrl|shift|alt)/i)) {
        issues.push({
          type: 'bestpractice',
          message: 'Unclear instructions for the user',
          line: lineNum,
          code: trimmedLine.substring(0, 100),
          severity: 'medium'
        });
      }
    }

    // SECURITY - More specific patterns
    if (trimmedLine.match(/(password|secret|token|key|auth)\s*[=:]\s*["'][^"']+["']/i) &&
        !trimmedLine.includes('process.env') && !trimmedLine.includes('${')) {
      issues.push({
        type: 'security',
        message: 'Potential hardcoded credential',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }

    // SQL injection risks
    if (trimmedLine.match(/sql.*\+.*\$|query.*\+.*\$|SELECT.*\+|INSERT.*\+/i)) {
      issues.push({
        type: 'security',
        message: 'Potential SQL injection vulnerability',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }

    // PERFORMANCE - Specific issues
    if (trimmedLine.match(/for\s*\(.*in.*\)\s*{[\s\S]*for\s*\(.*in/)) {
      issues.push({
        type: 'performance',
        message: 'Nested loop detected - potential performance issue',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }

    // Synchronous file operations
    if (trimmedLine.match(/fs\.readFileSync|fs\.writeFileSync|readFileSync|writeFileSync/)) {
      issues.push({
        type: 'performance',
        message: 'Synchronous file operation blocks event loop',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }

    // FUNCTIONS - Only flag actually problematic ones
    if (trimmedLine.match(/^(export\s+)?(const|function|async\s+function)\s+\w+/) &&
        (trimmedLine.length > 120 || trimmedLine.split(',').length > 5)) {
      issues.push({
        type: 'function',
        message: 'Long function signature may need refactoring',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'info'
      });
    }

    // Missing error handling
    if (trimmedLine.includes('fetch(') || trimmedLine.includes('axios.') || 
        trimmedLine.includes('http.')) {
      // Check if there's a catch block in the next few lines
      const nextLines = lines.slice(index, index + 5).join(' ');
      if (!nextLines.includes('catch') && !nextLines.includes('.catch') && 
          !nextLines.includes('try')) {
        issues.push({
          type: 'api',
          message: 'API call without error handling',
          line: lineNum,
          code: trimmedLine.substring(0, 100),
          severity: 'medium'
        });
      }
    }

    // TYPE ISSUES - TypeScript specific
    if (fileExt === '.ts' || fileExt === '.tsx') {
      if (trimmedLine.includes(': any') || trimmedLine.includes('as any')) {
        issues.push({
          type: 'type',
          message: 'Using "any" type reduces type safety',
          line: lineNum,
          code: trimmedLine.substring(0, 100),
          severity: 'medium'
        });
      }
    }

    // CONFIGURATION - Environment variables
    if (trimmedLine.includes('process.env') && !trimmedLine.includes('||') && 
        !trimmedLine.includes('??')) {
      issues.push({
        type: 'config',
        message: 'Environment variable without fallback value',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });

  // DEBUG: Log issue distribution
  if (issues.length > 0) {
    issues.forEach(issue => {
      issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
    });
  }
  
  // CRITICAL DEBUG: Log files with exactly 1 issue to find the pattern
  const fileName = path.basename(filePath);
  if (issues.length === 1) {
    console.log(`🚨 SINGLE ISSUE FILE - ${fileName}: "${issues[0].message}" (${issues[0].type})`);
  } else if (issues.length === 0) {
    console.log(`✅ NO ISSUES - ${fileName}`);
  } else {
    console.log(`📊 MULTIPLE ISSUES - ${fileName}: ${issues.length} issues`, issueTypes);
  }

  return issues;
}
