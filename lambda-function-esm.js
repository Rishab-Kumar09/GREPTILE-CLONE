import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Simple analysis patterns
const PATTERNS = {
  security: [
    'password', 'token', 'secret', 'apiKey', 'auth', 'jwt', 'credentials',
    'process\\.env', 'console\\.log', 'eval\\(', 'innerHTML'
  ],
  api: [
    'fetch\\(', 'axios', '\\.get\\(', '\\.post\\(', 'api/', 'endpoint'
  ],
  performance: [
    'useEffect.*\\[\\]', 'useState\\(', 'for.*in', 'while.*true'
  ],
  accessibility: [
    'onClick', 'onKeyDown', 'role=', 'aria-', 'alt='
  ]
};

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
    
    const gitPath = '/opt/bin/git'; // From our git layer
    const cloneCmd = `${gitPath} clone --depth 1 "${repoUrl}" "${tempDir}"`;
    console.log('Clone command:', cloneCmd);
    
    execSync(cloneCmd, { stdio: 'pipe' });
    console.log('✅ Clone successful');
    
    // Step 2: Find files
    console.log('📁 Finding files...');
    const files = await findFiles(tempDir);
    console.log(`Found ${files.length} files`);
    
    // Step 3: Analyze ALL files - we have 10GB Lambda!
    console.log(`🔍 Analyzing ALL ${files.length} files...`);
    let processedFiles = 0;
    let filesWithIssues = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(tempDir, file);
        const issues = analyzeFile(relativePath, content);
        
        processedFiles++;
        
        if (issues.length > 0) {
          filesWithIssues++;
          results.push({
            file: relativePath,
            issues: issues
          });
        }
        
        // Progress logging every 100 files
        if (processedFiles % 100 === 0) {
          console.log(`📊 Progress: ${processedFiles}/${files.length} files processed, ${filesWithIssues} files with issues`);
        }
        
      } catch (err) {
        console.warn(`Failed to analyze ${file}:`, err.message);
        processedFiles++;
      }
    }
    
    console.log(`📊 Final: ${processedFiles} files processed, ${filesWithIssues} files with issues, ${results.reduce((sum, r) => sum + r.issues.length, 0)} total issues found`);
    
    
    console.log(`✅ Analysis complete: ${results.length} files with issues`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId,
        results,
        message: `Analysis complete: ${results.length} files with issues`
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

async function findFiles(dir) {
  const files = [];
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await findFiles(fullPath);
        files.push(...subFiles);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        // Analyze ALL code files - comprehensive list!
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
  
  return files; // NO LIMITS - we have 10GB memory!
}

function analyzeFile(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // FUNCTIONS - React hooks, functions, methods
    if (trimmedLine.match(/^(export\s+)?(const|function|async\s+function)\s+\w+/)) {
      issues.push({
        type: 'function',
        message: 'Function definition',
        line: lineNum,
        code: trimmedLine,
        severity: 'info'
      });
    }
    
    // COMPONENTS - React components, classes
    if (trimmedLine.match(/^(export\s+)?(class|const)\s+[A-Z]\w+/)) {
      issues.push({
        type: 'component',
        message: 'Component/Class definition',
        line: lineNum,
        code: trimmedLine,
        severity: 'info'
      });
    }
    
    // IMPORTS - Dependencies and modules
    if (trimmedLine.match(/^import\s+.*from/)) {
      issues.push({
        type: 'import',
        message: 'Import statement',
        line: lineNum,
        code: trimmedLine,
        severity: 'info'
      });
    }
    
    // API CALLS - Network requests
    if (trimmedLine.match(/(fetch\(|axios\.|\.get\(|\.post\(|\.put\(|\.delete\()/)) {
      issues.push({
        type: 'api',
        message: 'API call detected',
        line: lineNum,
        code: trimmedLine,
        severity: 'medium'
      });
    }
    
    // SECURITY - Potential security issues
    if (trimmedLine.match(/(password|secret|token|apikey|auth)/i) && trimmedLine.includes('=')) {
      issues.push({
        type: 'security',
        message: 'Potential sensitive data',
        line: lineNum,
        code: trimmedLine,
        severity: 'high'
      });
    }
    
    // STATE MANAGEMENT - React hooks, state
    if (trimmedLine.match(/(useState|useEffect|useContext|useReducer)\s*\(/)) {
      issues.push({
        type: 'state',
        message: 'React hook usage',
        line: lineNum,
        code: trimmedLine,
        severity: 'info'
      });
    }
    
    // PERFORMANCE - Potential performance issues
    if (trimmedLine.match(/(for\s*\(.*in|while\s*\(.*true|\.map\(.*\.map\()/)) {
      issues.push({
        type: 'performance',
        message: 'Potential performance concern',
        line: lineNum,
        code: trimmedLine,
        severity: 'medium'
      });
    }
    
    // TYPES - TypeScript interfaces, types
    if (trimmedLine.match(/^(export\s+)?(interface|type)\s+\w+/)) {
      issues.push({
        type: 'type',
        message: 'Type definition',
        line: lineNum,
        code: trimmedLine,
        severity: 'info'
      });
    }
    
    // CONFIGURATION - Config files, environment
    if (trimmedLine.match(/(process\.env|config\.|\.env)/)) {
      issues.push({
        type: 'config',
        message: 'Configuration usage',
        line: lineNum,
        code: trimmedLine,
        severity: 'medium'
      });
    }
  });
  
  return issues;
}
