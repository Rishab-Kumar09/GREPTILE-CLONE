import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

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

export const handler = async (event) => {
  console.log('🚀 Enhanced Lambda analyzer started:', JSON.stringify(event));

  const { repoUrl, analysisId } = JSON.parse(event.body || '{}');

  if (!repoUrl || !analysisId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'repoUrl and analysisId required' })
    };
  }

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
    
    // SUPER AGGRESSIVE CLONE - minimal data transfer
    const cloneCmd = [
      gitPath,
      'clone',
      '--depth 1',              // Only latest commit
      '--single-branch',        // Only main branch
      '--no-tags',             // Skip all tags
      '--filter=blob:none',    // Skip file contents initially (partial clone)
      '--sparse-checkout',     // Enable sparse checkout
      `"${repoUrl}"`,
      `"${tempDir}"`
    ].join(' ');
    
    console.log('SUPER SHALLOW Clone command:', cloneCmd);
    execSync(cloneCmd, { stdio: 'pipe' });
    
    // Configure sparse checkout to exclude heavy directories
    execSync(`cd "${tempDir}" && ${gitPath} sparse-checkout init --cone`, { stdio: 'pipe' });
    execSync(`cd "${tempDir}" && ${gitPath} sparse-checkout set '/*' '!node_modules' '!.git' '!dist' '!build' '!out' '!coverage' '!.next' '!vendor' '!target' '!__pycache__'`, { stdio: 'pipe' });
    
    // Now fetch the actual file contents we need
    execSync(`cd "${tempDir}" && ${gitPath} checkout HEAD -- .`, { stdio: 'pipe' });
    
    console.log('✅ SUPER SHALLOW Clone successful');

    // Step 2: Find files
    console.log('📁 Finding files...');
    let files = await findFiles(tempDir, 0); // Start depth at 0
    console.log(`Found ${files.length} files`);

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
        
        // Skip files larger than 5MB to save memory
        if (stats.size > 5 * 1024 * 1024) {
          console.log(`⚠️ Skipping large file ${path.relative(tempDir, file)} (${Math.round(stats.size / 1024 / 1024)}MB)`);
          processedFilesCount++;
          continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Skip files with too many lines (likely generated/minified)
        if (lines.length > 15000) {
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId,
        results,
        message: `SUPER SHALLOW Analysis complete: ${results.reduce((sum, r) => sum + r.issues.length, 0)} issues found in ${filesWithIssuesCount} files (${processedFilesCount} total files processed)`
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
  const MAX_DEPTH = 5; // Limit directory recursion depth
  const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.vscode'];

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

    // FUNCTIONS - Only flag problematic ones
    if (trimmedLine.match(/^(export\s+)?(const|function|async\s+function)\s+\w+/) &&
        trimmedLine.length > 80) {
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

  return issues;
}
