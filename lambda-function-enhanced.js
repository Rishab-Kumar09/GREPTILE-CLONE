const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event) => {
  console.log('🚀 Lambda analyzer started:', JSON.stringify(event));
  
  const { repoUrl, analysisId } = JSON.parse(event.body || '{}');
  
  if (!repoUrl || !analysisId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'repoUrl and analysisId required' })
    };
  }
  
  const tempDir = path.join('/tmp', `analysis-${Date.now()}`);
  const results = [];
  
  try {
    // Step 1: Clone repository
    console.log('📥 Cloning repository...');
    await fs.mkdir(tempDir, { recursive: true });
    
    const gitPath = '/opt/bin/git'; // From git layer
    const cloneCmd = `${gitPath} clone --depth 1 "${repoUrl}" "${tempDir}"`;
    console.log('Clone command:', cloneCmd);
    
    execSync(cloneCmd, { stdio: 'pipe' });
    console.log('✅ Clone successful');
    
    // Step 2: Find files (optimized)
    console.log('📁 Finding code files...');
    const files = await findCodeFiles(tempDir);
    console.log(`Found ${files.length} code files`);
    
    // Step 3: Analyze files (smart batching)
    console.log(`🔍 Analyzing ${files.length} files...`);
    let processedFiles = 0;
    let totalIssues = 0;
    
    for (const file of files) {
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
        
        // Progress logging every 500 files
        if (processedFiles % 500 === 0) {
          console.log(`📊 Progress: ${processedFiles}/${files.length} files processed, ${totalIssues} total issues`);
        }
        
      } catch (err) {
        console.warn(`Failed to analyze ${file}:`, err.message);
      }
    }
    
    console.log(`✅ Analysis complete: ${totalIssues} issues found in ${results.length} files`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId,
        results,
        message: `Analysis complete: ${totalIssues} issues found in ${results.length} files (${processedFiles} total files processed)`
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

async function findCodeFiles(dir) {
  const files = [];
  
  async function scanDirectory(currentDir, depth = 0) {
    if (depth > 10) return; // Prevent too deep recursion
    
    try {
      const items = await fs.readdir(currentDir);
      
      for (const item of items) {
        // Skip common non-code directories
        if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor'].includes(item)) {
          continue;
        }
        
        const fullPath = path.join(currentDir, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await scanDirectory(fullPath, depth + 1);
        } else if (stats.isFile()) {
          const ext = path.extname(item).toLowerCase();
          // Include common code file extensions
          if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h', '.php', '.rb', '.swift', '.kt'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${currentDir}:`, error.message);
    }
  }
  
  await scanDirectory(dir);
  return files;
}

function analyzeFile(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  const ext = path.extname(filePath).toLowerCase();
  
  // Skip very large files to prevent timeouts
  if (lines.length > 5000) {
    return [{
      type: 'info',
      message: 'Large file - skipped detailed analysis',
      line: 1,
      code: `File has ${lines.length} lines`,
      severity: 'info'
    }];
  }
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip empty lines and very long lines
    if (!trimmedLine || trimmedLine.length > 500) return;
    
    // FUNCTIONS - Universal patterns
    if (trimmedLine.match(/^(export\s+)?(const|function|async\s+function|def\s+|func\s+|fn\s+)\s+\w+/)) {
      issues.push({
        type: 'function',
        message: 'Function definition',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'info'
      });
    }
    
    // CLASSES/COMPONENTS
    if (trimmedLine.match(/^(export\s+)?(class|interface|struct)\s+[A-Z]\w+/) ||
        trimmedLine.match(/^(export\s+)?const\s+[A-Z]\w+\s*=.*=>/)) {
      issues.push({
        type: 'component',
        message: 'Class/Component definition',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'info'
      });
    }
    
    // IMPORTS - Language specific
    if (trimmedLine.match(/^(import|from|#include|require\(|use\s+)/) ||
        trimmedLine.match(/^(using|package|namespace)/)) {
      issues.push({
        type: 'import',
        message: 'Import/Include statement',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'info'
      });
    }
    
    // API CALLS
    if (trimmedLine.includes('fetch(') || trimmedLine.includes('axios') || 
        trimmedLine.includes('http.') || trimmedLine.includes('requests.')) {
      issues.push({
        type: 'api',
        message: 'API call detected',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // SECURITY PATTERNS
    if (trimmedLine.match(/(password|secret|token|key)\s*[=:]/i) && 
        !trimmedLine.includes('process.env')) {
      issues.push({
        type: 'security',
        message: 'Potential hardcoded credential',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // DATABASE QUERIES
    if (trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+/i)) {
      issues.push({
        type: 'database',
        message: 'Database query detected',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // CONFIGURATION
    if (trimmedLine.includes('process.env') || trimmedLine.includes('config') ||
        trimmedLine.match(/\.(env|config|settings|properties)$/)) {
      issues.push({
        type: 'config',
        message: 'Configuration reference',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'info'
      });
    }
    
    // PERFORMANCE CONCERNS
    if (trimmedLine.includes('console.log') || trimmedLine.includes('print(') ||
        trimmedLine.includes('System.out')) {
      issues.push({
        type: 'performance',
        message: 'Debug/logging statement',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'low'
      });
    }
    
    // TYPE DEFINITIONS (TypeScript/Flow)
    if (ext === '.ts' || ext === '.tsx') {
      if (trimmedLine.includes('interface ') || trimmedLine.includes('type ') ||
          trimmedLine.includes(': any') || trimmedLine.includes('as any')) {
        issues.push({
          type: 'type',
          message: 'Type definition or usage',
          line: lineNum,
          code: trimmedLine.substring(0, 100),
          severity: 'info'
        });
      }
    }
  });
  
  return issues;
}