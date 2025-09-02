const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

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
    
    const gitPath = '/opt/bin/git'; // From our git layer
    const cloneCmd = `${gitPath} clone --depth 1 "${repoUrl}" "${tempDir}"`;
    console.log('Clone command:', cloneCmd);
    
    execSync(cloneCmd, { stdio: 'pipe' });
    console.log('✅ Clone successful');
    
    // Step 2: Find files
    console.log('📁 Finding files...');
    const files = await findFiles(tempDir);
    console.log(`Found ${files.length} files`);
    
    // Step 3: Analyze files
    console.log('🔍 Analyzing files...');
    for (let i = 0; i < Math.min(files.length, 50); i++) { // Limit for demo
      const file = files[i];
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(tempDir, file);
        const issues = analyzeFile(relativePath, content);
        
        if (issues.length > 0) {
          results.push({
            file: relativePath,
            issues: issues
          });
        }
      } catch (err) {
        console.warn(`Failed to analyze ${file}:`, err.message);
      }
    }
    
    console.log(`✅ Analysis complete: ${results.length} files with issues`);
    
    // Update database with results (you'll need to add Prisma here)
    // For now, just return results
    
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
        if (['.js', '.ts', '.jsx', '.tsx', '.json', '.md'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error.message);
  }
  
  return files.slice(0, 100); // Limit for demo
}

function analyzeFile(filePath, content) {
  const issues = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Security patterns
    if (trimmedLine.includes('password') && trimmedLine.includes('=')) {
      issues.push({
        type: 'security',
        message: 'Potential hardcoded password detected',
        line: lineNum,
        code: trimmedLine,
        severity: 'high'
      });
    }
    
    if (trimmedLine.includes('console.log')) {
      issues.push({
        type: 'smell',
        message: 'Console statement found - remove before production',
        line: lineNum,
        code: trimmedLine,
        severity: 'low'
      });
    }
    
    if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
      issues.push({
        type: 'smell',
        message: 'TODO comment found',
        line: lineNum,
        code: trimmedLine,
        severity: 'medium'
      });
    }
    
    if (trimmedLine.includes('fetch(') || trimmedLine.includes('axios')) {
      issues.push({
        type: 'api',
        message: 'API call detected - verify error handling',
        line: lineNum,
        code: trimmedLine,
        severity: 'medium'
      });
    }
  });
  
  return issues;
}
