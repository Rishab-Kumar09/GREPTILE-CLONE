import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export const handler = async (event) => {
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
        stats: {
          filesProcessed: processedFiles,
          filesWithIssues: results.length,
          totalIssues: totalIssues
        },
        message: `Analysis complete: ${totalIssues} issues found in ${results.length} files`
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

async function findCodeFiles(dir) {
  const files = [];
  
  // Priority file extensions - most important first
  const highPriorityExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'];
  const mediumPriorityExts = ['.cpp', '.c', '.h', '.php', '.rb', '.swift', '.kt'];
  const lowPriorityExts = ['.css', '.scss', '.html', '.json', '.yaml', '.yml', '.md'];
  
  const allExts = [...highPriorityExts, ...mediumPriorityExts, ...lowPriorityExts];
  
  try {
    await scanDirectory(dir, files, allExts, 0);
  } catch (error) {
    console.warn(`Failed to scan directory ${dir}:`, error.message);
  }
  
  // Sort by priority and limit to reasonable number
  const prioritizedFiles = [
    ...files.filter(f => highPriorityExts.includes(path.extname(f).toLowerCase())),
    ...files.filter(f => mediumPriorityExts.includes(path.extname(f).toLowerCase())),
    ...files.filter(f => lowPriorityExts.includes(path.extname(f).toLowerCase()))
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
    if (trimmedLine.match(/(fetch\(|axios\.|requests\.|http\.|curl|wget)/)) {
      issues.push({
        type: 'api',
        message: 'API/Network call',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // SECURITY PATTERNS
    if (trimmedLine.match(/(password|secret|token|apikey|auth)\s*[=:]/i)) {
      issues.push({
        type: 'security',
        message: 'Potential sensitive data',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'high'
      });
    }
    
    // DATABASE/STORAGE
    if (trimmedLine.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|DROP TABLE)/i) ||
        trimmedLine.match(/(\.query\(|\.exec\(|\.find\(|\.save\()/)) {
      issues.push({
        type: 'database',
        message: 'Database operation',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
    
    // CONFIGURATION
    if (trimmedLine.match(/(process\.env|config\.|\.env|settings\.|ENV\[)/)) {
      issues.push({
        type: 'config',
        message: 'Configuration usage',
        line: lineNum,
        code: trimmedLine.substring(0, 100),
        severity: 'medium'
      });
    }
  });
  
  return issues;
}
