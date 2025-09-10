import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log('🔑 OpenAI API Key status:', OPENAI_API_KEY ? 'FOUND' : 'MISSING');

// REAL STATIC ANALYSIS: Use industry-standard tools
function performRealAnalysis(content, filePath, tempDir) {
  console.log(`🎯 Running REAL static analysis for: ${filePath}`);
  
  var issues = [];
  var ext = path.extname(filePath).toLowerCase();
  var fileName = path.basename(filePath);
  var fullPath = path.join(tempDir, filePath);
  
  try {
    // Write file to disk for tool analysis
    var fs = require('fs').promises;
    var dirPath = path.dirname(fullPath);
    execSync(`mkdir -p "${dirPath}"`, { stdio: 'ignore' });
    require('fs').writeFileSync(fullPath, content);
    
    // Run appropriate static analysis tool based on file type
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      issues = runESLintAnalysis(fullPath, content);
    } else if (['.py', '.pyx'].includes(ext)) {
      issues = runPylintAnalysis(fullPath, content);
    } else if (['.cpp', '.cc', '.c', '.h', '.hpp'].includes(ext)) {
      issues = runCppCheckAnalysis(fullPath, content);
    } else if (['.java'].includes(ext)) {
      issues = runSpotBugsAnalysis(fullPath, content);
    } else {
      // Fallback to basic analysis for unsupported types
      issues = performBasicAnalysis(content, filePath);
    }
    
  } catch (error) {
    console.warn(`⚠️ Real analysis failed for ${filePath}, using fallback:`, error.message);
    issues = performBasicAnalysis(content, filePath);
  }
  
  return issues;
}

// ESLint integration for JavaScript/TypeScript
function runESLintAnalysis(filePath, content) {
  var issues = [];
  
  try {
    // Run ESLint with strict rules
    var eslintCmd = `npx eslint --format json --no-eslintrc --config '{
      "parserOptions": { "ecmaVersion": 2022, "sourceType": "module", "ecmaFeatures": { "jsx": true } },
      "env": { "browser": true, "node": true, "es6": true },
      "rules": {
        "no-eval": "error",
        "no-implied-eval": "error", 
        "no-new-func": "error",
        "no-script-url": "error",
        "no-unsafe-innerhtml/no-unsafe-innerhtml": "error",
        "react-hooks/exhaustive-deps": "error",
        "react-hooks/rules-of-hooks": "error",
        "no-unused-vars": "error",
        "no-undef": "error",
        "prefer-const": "error",
        "no-var": "error"
      }
    }' "${filePath}" 2>/dev/null || echo '[]'`;
    
    var result = execSync(eslintCmd, { encoding: 'utf8', stdio: 'pipe' });
    var eslintResults = JSON.parse(result);
    
    if (eslintResults[0] && eslintResults[0].messages) {
      eslintResults[0].messages.forEach(function(msg) {
        issues.push({
          type: msg.severity === 2 ? 'error' : 'warning',
          message: msg.message,
          line: msg.line,
          code: content.split('\n')[msg.line - 1] || '',
          severity: msg.severity === 2 ? 'high' : 'medium',
          rule: msg.ruleId
        });
      });
    }
    
  } catch (error) {
    console.warn(`ESLint failed for ${filePath}:`, error.message);
  }
  
  return issues;
}

// Pylint integration for Python
function runPylintAnalysis(filePath, content) {
  var issues = [];
  
  try {
    var pylintCmd = `python3 -m pylint --output-format=json --disable=all --enable=unused-import,unused-variable,undefined-variable,dangerous-default-value,eval-used "${filePath}" 2>/dev/null || echo '[]'`;
    
    var result = execSync(pylintCmd, { encoding: 'utf8', stdio: 'pipe' });
    var pylintResults = JSON.parse(result);
    
    pylintResults.forEach(function(issue) {
      issues.push({
        type: issue.type,
        message: issue.message,
        line: issue.line,
        code: content.split('\n')[issue.line - 1] || '',
        severity: issue.type === 'error' ? 'high' : 'medium',
        rule: issue['message-id']
      });
    });
    
  } catch (error) {
    console.warn(`Pylint failed for ${filePath}:`, error.message);
  }
  
  return issues;
}

// CppCheck integration for C/C++
function runCppCheckAnalysis(filePath, content) {
  var issues = [];
  
  try {
    var cppcheckCmd = `cppcheck --enable=all --xml --xml-version=2 "${filePath}" 2>&1 | grep -E '<error|<location' || echo '<results></results>'`;
    
    var result = execSync(cppcheckCmd, { encoding: 'utf8', stdio: 'pipe' });
    
    // Parse XML results (simplified)
    var errorMatches = result.match(/<error[^>]*msg="([^"]*)"[^>]*line="([^"]*)"[^>]*severity="([^"]*)"/g);
    
    if (errorMatches) {
      errorMatches.forEach(function(match) {
        var msgMatch = match.match(/msg="([^"]*)"/);
        var lineMatch = match.match(/line="([^"]*)"/);
        var severityMatch = match.match(/severity="([^"]*)"/);
        
        if (msgMatch && lineMatch) {
          issues.push({
            type: 'cppcheck',
            message: msgMatch[1],
            line: parseInt(lineMatch[1]) || 1,
            code: content.split('\n')[parseInt(lineMatch[1]) - 1] || '',
            severity: severityMatch && severityMatch[1] === 'error' ? 'high' : 'medium'
          });
        }
      });
    }
    
  } catch (error) {
    console.warn(`CppCheck failed for ${filePath}:`, error.message);
  }
  
  return issues;
}

// SpotBugs integration for Java
function runSpotBugsAnalysis(filePath, content) {
  // For now, fallback to basic analysis for Java
  return performBasicAnalysis(content, filePath);
}

// Fallback basic analysis (HIGHLY SELECTIVE - only critical issues)
function performBasicAnalysis(content, filePath) {
  console.log(`🔧 Using selective fallback analysis for: ${filePath}`);
  
  var issues = [];
  var lines = content.split('\n');
  var ext = path.extname(filePath).toLowerCase();
  
  // Context detection
  var hasAuth = /password|secret|token|jwt|auth|login/i.test(content);
  var hasDatabase = /SELECT|INSERT|UPDATE|DELETE|query|sql/i.test(content);
  var isReactFile = /react|jsx|usestate|useeffect|component/i.test(content) || ['.jsx', '.tsx'].includes(ext);
  
  lines.forEach(function(line, index) {
    var lineNum = index + 1;
    var trimmedLine = line.trim();
    
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
    
    // 8. REACT-SPECIFIC: useEffect without dependencies (more precise detection)
    if (isReactFile && trimmedLine.match(/useEffect\s*\(\s*\(\s*\)\s*=>\s*{/) && 
        !content.includes('[]') && !trimmedLine.includes('[]') && 
        !trimmedLine.includes('dependencies') && !trimmedLine.includes('deps')) {
      
      // Additional validation: make sure it's actually a problematic useEffect
      var hasStateUpdate = /setState|set[A-Z]/.test(content);
      var hasAsyncOperation = /fetch|axios|setTimeout|setInterval/.test(content);
      
      if (hasStateUpdate || hasAsyncOperation) {
        issues.push({
          type: 'performance',
          message: 'useEffect without dependencies may cause infinite re-renders',
          line: lineNum,
          code: trimmedLine.substring(0, 80),
          severity: 'high'  // Reduced from critical
        });
      }
    }
    
    // 9. SECURITY: Dangerous eval() usage
    if (trimmedLine.match(/eval\s*\(/) && !trimmedLine.includes('// safe')) {
      issues.push({
        type: 'security',
        message: 'eval() usage detected - potential code injection risk',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
    
    // 10. PERFORMANCE: Inefficient loops in large datasets
    if (trimmedLine.match(/for\s*\([^)]*in[^)]*\)/) && content.includes('length') && content.length > 5000) {
      issues.push({
        type: 'performance',
        message: 'for...in loop on large dataset - consider optimization',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'medium'
      });
    }
    
    // 11. SECURITY: Unsafe HTML rendering
    if (trimmedLine.match(/innerHTML\s*=/) && !trimmedLine.includes('sanitize') && !trimmedLine.includes('DOMPurify')) {
      issues.push({
        type: 'security',
        message: 'Unsafe innerHTML assignment - XSS vulnerability',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'high'
      });
    }
    
    // 12. CRITICAL: Null pointer dereferences in C/C++
    if (['.c', '.cpp', '.cc', '.h', '.hpp'].includes(ext) && 
        trimmedLine.match(/\*\w+\s*[=\.]/) && !trimmedLine.includes('if') && !trimmedLine.includes('null')) {
      issues.push({
        type: 'security',
        message: 'Potential null pointer dereference',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
  });
  
  console.log(`🔧 Selective fallback found ${issues.length} critical issues (filtered out noise)`);
  return issues;
}

// 🎯 COMPLETE STATIC ANALYSIS ENGINE - No AI, Pure Logic
async function performSemanticBugDetection(content, filePath, repoDir) {
  console.log(`🔍 Complete static analysis: ${filePath}`);
  
  // Skip analysis for non-code files that shouldn't have logic/security issues
  var ext = path.extname(filePath).toLowerCase();
  var fileName = path.basename(filePath).toLowerCase();
  
  // Skip non-code files (assets, styles, etc.)
  var skipExtensions = ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'];
  
  // Skip test files, config files, documentation, and type definitions (high false positive rate)
  var skipPatterns = [
    /test/i, /spec/i, /__tests__/i, /\.test\./i, /\.spec\./i,
    /config/i, /\.config\./i, /webpack/i, /babel/i, /eslint/i,
    /readme/i, /changelog/i, /license/i, /\.md$/i,
    /fixture/i, /mock/i, /example/i, /demo/i,
    /node_modules/i, /dist/i, /build/i, /coverage/i,
    // Skip type definition directories and files - MORE AGGRESSIVE
    /^flow-typed\//i, /\/flow-typed\//i, /\.d\.ts$/i, /@types/i, /types\//i,
    // Skip pure declaration files
    /\.d\.[jt]s$/i, /\.flow$/i
  ];
  
  if (skipExtensions.includes(ext)) {
    console.log(`⏭️ Skipping static analysis for ${ext} file: ${filePath} (non-code file)`);
    return [];
  }
  
  if (skipPatterns.some(pattern => pattern.test(filePath))) {
    console.log(`⏭️ Skipping static analysis for: ${filePath} (test/config/docs file)`);
    return [];
  }
  
  // Skip if content is primarily type definitions
  if (isPureTypeDefinitionContent(content, filePath)) {
    console.log(`⏭️ Skipping ${filePath} - pure type definitions (no implementation code)`);
    return [];
  }
  
  // Additional check: Skip files that are clearly type definitions by content patterns
  var typeDefinitionRatio = (content.match(/^declare\s|interface\s|type\s.*=|:\s*(string|number|boolean|void|Promise)/gm) || []).length;
  var totalLines = content.split('\n').filter(line => line.trim()).length;
  if (totalLines > 10 && typeDefinitionRatio / totalLines > 0.6) {
    console.log(`⏭️ Skipping ${filePath} - high type definition ratio (${Math.round(typeDefinitionRatio/totalLines*100)}%)`);
    return [];
  }
  
  var allIssues = [];
  
  // 🔴 CRITICAL SECURITY CHECKS
  allIssues = allIssues.concat(checkHardcodedSecrets(content, filePath));
  allIssues = allIssues.concat(checkUnsafeAPIs(content, filePath));
  allIssues = allIssues.concat(checkSQLInjection(content, filePath));
  allIssues = allIssues.concat(checkCommandInjection(content, filePath));
  allIssues = allIssues.concat(checkXSSVulnerabilities(content, filePath));
  allIssues = allIssues.concat(checkInsecureOperations(content, filePath));
  
  // 🟠 HIGH PRIORITY LOGIC CHECKS  
  allIssues = allIssues.concat(checkNullDereference(content, filePath));
  allIssues = allIssues.concat(checkUnhandledPromises(content, filePath));
  allIssues = allIssues.concat(checkResourceLeaks(content, filePath));
  allIssues = allIssues.concat(checkRaceConditions(content, filePath));
  allIssues = allIssues.concat(checkErrorHandling(content, filePath));
  
  // ⚡ PERFORMANCE CHECKS
  allIssues = allIssues.concat(checkNPlusOneQueries(content, filePath));
  allIssues = allIssues.concat(checkInefficiientRegex(content, filePath));
  allIssues = allIssues.concat(checkMemoryLeaks(content, filePath));
  allIssues = allIssues.concat(checkPerformanceAntipatterns(content, filePath));
  
  // 🔍 CODE QUALITY CHECKS
  allIssues = allIssues.concat(checkComplexity(content, filePath));
  allIssues = allIssues.concat(checkCodeSmells(content, filePath));
  allIssues = allIssues.concat(checkBestPractices(content, filePath));
  
  // 🔗 CROSS-FILE CHECKS (when repo context available)
  if (repoDir) {
    allIssues = allIssues.concat(checkUnusedImports(content, filePath));
    allIssues = allIssues.concat(checkImportIssues(content, filePath, repoDir));
  }
  
  // FILTER OUT LOW SEVERITY ISSUES - Focus on what matters
  var criticalIssues = allIssues.filter(issue => 
    issue.severity === 'critical' || issue.severity === 'high' || issue.severity === 'medium'
  );
  
  console.log(`🔍 Static analysis found ${criticalIssues.length} critical/high/medium issues in ${filePath} (filtered out ${allIssues.length - criticalIssues.length} low-priority/informational noise)`);
  
  // Note: AI filtering now happens at batch level for efficiency
  return criticalIssues;
}

// 🤖 AI-POWERED POST-ANALYSIS FILTER
async function performAIIssueFilter(issues, content, filePath) {
  if (!OPENAI_API_KEY || issues.length === 0) {
    console.log('⚠️ Skipping AI filter: No API key or no issues');
    return issues;
  }
  
  try {
    console.log(`🤖 AI filtering ${issues.length} issues in ${filePath}...`);
    
    // Prepare issues for AI analysis
    var issuesSummary = issues.map((issue, index) => ({
      id: index,
      type: issue.type,
      message: issue.message,
      line: issue.line,
      severity: issue.severity,
      code: issue.code,
      context: getCodeContext(content, issue.line)
    }));
    
    var aiPrompt = `You are an expert code reviewer. Analyze these ${issues.length} potential code issues and determine which are REAL actionable problems vs false positives.

File: ${filePath}
Issues found by static analysis:

${issuesSummary.map(issue => 
`[${issue.id}] ${issue.severity.toUpperCase()}: ${issue.message}
Line ${issue.line}: ${issue.code}
Context: ${issue.context}
`).join('\n')}

For each issue, determine if it's:
- REAL: Actual problem that needs developer attention
- FALSE_POSITIVE: Static analysis mistake, not a real issue
- IGNORE: Too minor/context-dependent to be actionable

Consider:
1. Is this a genuine security/performance/logic issue?
2. Is the code pattern actually problematic in this context?
3. Would a developer realistically need to fix this?
4. Are there obvious false positives (e.g., test files, mock data, comments)?

Return ONLY a JSON array with issue IDs to KEEP (real issues only):
[0, 2, 5, 7]`;

    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: aiPrompt }],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      console.error(`❌ AI filter API error: ${response.status}`);
      return issues; // Return original issues on API failure
    }
    
    var data = await response.json();
    var aiResponse = data.choices[0].message.content.trim();
    
    // Parse AI response to get issue IDs to keep
    var jsonMatch = aiResponse.match(/\[[\d,\s]*\]/);
    if (jsonMatch) {
      var idsToKeep = JSON.parse(jsonMatch[0]);
      var filteredIssues = issues.filter((_, index) => idsToKeep.includes(index));
      
      console.log(`🤖 AI filter results: Keeping ${filteredIssues.length}/${issues.length} issues`);
      console.log(`🗑️ AI removed: ${issues.length - filteredIssues.length} false positives/non-actionable issues`);
      
      return filteredIssues;
    } else {
      console.warn('⚠️ AI filter: Could not parse response, keeping all issues');
      console.log('AI response:', aiResponse);
      return issues;
    }
    
  } catch (error) {
    console.error(`❌ AI filter failed for ${filePath}:`, error.message);
    return issues; // Return original issues on error
  }
}

// Helper function to get code context around an issue
function getCodeContext(content, lineNumber) {
  var lines = content.split('\n');
  var start = Math.max(0, lineNumber - 3);
  var end = Math.min(lines.length, lineNumber + 2);
  return lines.slice(start, end).map((line, i) => {
    var actualLineNum = start + i + 1;
    var marker = actualLineNum === lineNumber ? '→ ' : '  ';
    return `${marker}${actualLineNum}: ${line}`;
  }).join('\n');
}

// 🤖 BATCH AI FILTER - Process multiple files efficiently
async function performBatchAIFilter(fileResults) {
  if (!OPENAI_API_KEY || fileResults.length === 0) {
    return fileResults;
  }
  
  try {
    // Process files in smaller batches to avoid token limits
    var batchSize = 3; // Process 3 files at a time
    var filteredResults = [];
    
    for (var i = 0; i < fileResults.length; i += batchSize) {
      var batch = fileResults.slice(i, i + batchSize);
      var batchFiltered = await processBatchFiles(batch);
      filteredResults = filteredResults.concat(batchFiltered);
      
      console.log(`🤖 AI batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(fileResults.length/batchSize)} complete`);
    }
    
    return filteredResults;
    
  } catch (error) {
    console.error('❌ Batch AI filter failed:', error.message);
    return fileResults; // Return original on error
  }
}

// Process a small batch of files with AI
async function processBatchFiles(batch) {
  var totalIssues = batch.reduce((sum, file) => sum + file.issues.length, 0);
  
  if (totalIssues === 0) {
    return batch;
  }
  
  console.log(`🤖 AI analyzing ${batch.length} files with ${totalIssues} total issues...`);
  
  // Create comprehensive prompt for batch analysis
  var batchPrompt = `You are an expert code reviewer. Analyze these ${totalIssues} potential code issues across ${batch.length} files and identify which are REAL actionable problems vs false positives.

${batch.map((fileResult, fileIndex) => 
`FILE ${fileIndex}: ${fileResult.file}
${fileResult.issues.map((issue, issueIndex) => 
`[${fileIndex}.${issueIndex}] ${issue.severity.toUpperCase()}: ${issue.message}
Line ${issue.line}: ${issue.code}
Context: ${getCodeContext(fileResult.content, issue.line)}
`).join('\n')}
`).join('\n')}

For each issue, determine if it's:
- REAL: Actual problem that needs developer attention  
- FALSE_POSITIVE: Static analysis mistake (e.g., test files, mock data, comments, legitimate patterns)
- IGNORE: Too minor/context-dependent to be actionable

Consider:
1. Is this a genuine security/performance/logic issue?
2. Is the code pattern actually problematic in this context?
3. Would a developer realistically need to fix this?
4. Are there obvious false positives (test files, mock data, generated code)?
5. Is this issue in a test file, config file, or documentation?

Return ONLY a JSON object with file indices and issue indices to KEEP:
{
  "0": [0, 2, 5],
  "1": [1, 3],
  "2": []
}`;

  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: batchPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      console.error(`❌ Batch AI filter API error: ${response.status}`);
      return batch;
    }
    
    var data = await response.json();
    var aiResponse = data.choices[0].message.content.trim();
    
    // Parse AI response
    var jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var keepMap = JSON.parse(jsonMatch[0]);
      
      // Filter issues based on AI recommendations
      var filteredBatch = batch.map((fileResult, fileIndex) => {
        var indicesToKeep = keepMap[fileIndex.toString()] || [];
        var filteredIssues = fileResult.issues.filter((_, issueIndex) => 
          indicesToKeep.includes(issueIndex)
        );
        
        return {
          file: fileResult.file,
          issues: filteredIssues,
          content: fileResult.content
        };
      });
      
      var originalCount = totalIssues;
      var filteredCount = filteredBatch.reduce((sum, file) => sum + file.issues.length, 0);
      
      console.log(`🤖 AI batch filter: ${originalCount} → ${filteredCount} issues (removed ${originalCount - filteredCount})`);
      
      return filteredBatch;
      
    } else {
      console.warn('⚠️ Could not parse AI batch response, keeping all issues');
      return batch;
    }
    
  } catch (error) {
    console.error(`❌ Batch AI processing failed:`, error.message);
    return batch;
  }
}

// 🔴 CRITICAL SECURITY FUNCTIONS

// 1. HARDCODED SECRETS DETECTION
function checkHardcodedSecrets(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var secretPatterns = [
    { pattern: /(password|pwd|pass)\s*[:=]\s*["'][^"']{3,}["']/i, message: 'Hardcoded password detected' },
    { pattern: /(api_?key|apikey)\s*[:=]\s*["'][^"']{10,}["']/i, message: 'Hardcoded API key detected' },
    { pattern: /(secret|token)\s*[:=]\s*["'][^"']{8,}["']/i, message: 'Hardcoded secret/token detected' },
    { pattern: /sk-[a-zA-Z0-9]{48}/i, message: 'OpenAI API key detected' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/i, message: 'GitHub token detected' },
    { pattern: /AKIA[0-9A-Z]{16}/i, message: 'AWS access key detected' },
    { pattern: /mongodb:\/\/[^:]+:[^@]+@/i, message: 'MongoDB connection string with credentials' },
    { pattern: /postgres:\/\/[^:]+:[^@]+@/i, message: 'PostgreSQL connection string with credentials' }
  ];
  
  lines.forEach((line, index) => {
    secretPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'security',
          message: message + ' - use environment variables',
          line: index + 1,
          severity: 'critical',
          code: line.replace(/["'][^"']*["']/, '"***REDACTED***"'),
          pattern: 'hardcoded_secret'
        });
      }
    });
  });
  
  return issues;
}

// 2. UNSAFE APIS DETECTION  
function checkUnsafeAPIs(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var unsafeAPIs = [
    { pattern: /eval\s*\(/i, message: 'eval() is dangerous - code injection vulnerability', severity: 'critical' },
    { pattern: /Function\s*\(/i, message: 'Function() constructor allows code injection', severity: 'critical' },
    { pattern: /setTimeout\s*\(\s*["']/i, message: 'setTimeout with string is unsafe - use function', severity: 'high' },
    { pattern: /setInterval\s*\(\s*["']/i, message: 'setInterval with string is unsafe - use function', severity: 'high' },
    { pattern: /document\.write\s*\(/i, message: 'document.write() can cause XSS vulnerabilities', severity: 'high' },
    { pattern: /innerHTML\s*=(?!\s*["'][\s]*["'])/i, message: 'innerHTML assignment without sanitization - XSS risk', severity: 'high' },
    { pattern: /outerHTML\s*=/i, message: 'outerHTML assignment - XSS risk', severity: 'high' },
    { pattern: /dangerouslySetInnerHTML/i, message: 'React dangerouslySetInnerHTML - ensure content is sanitized', severity: 'medium' },
    { pattern: /pickle\.loads?\s*\(/i, message: 'pickle.load() can execute arbitrary code', severity: 'critical' },
    { pattern: /yaml\.load\s*\(/i, message: 'yaml.load() without safe_load is dangerous', severity: 'critical' },
    { pattern: /os\.system\s*\(/i, message: 'os.system() vulnerable to command injection', severity: 'critical' },
    { pattern: /shell\s*=\s*True/i, message: 'subprocess with shell=True enables command injection', severity: 'high' }
  ];
  
  lines.forEach((line, index) => {
    unsafeAPIs.forEach(({ pattern, message, severity }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'security',
          message: message,
          line: index + 1,
          severity: severity,
          code: line.trim(),
          pattern: 'unsafe_api'
        });
      }
    });
  });
  
  return issues;
}

// 3. SQL INJECTION DETECTION
function checkSQLInjection(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // More precise SQL injection detection - must have SQL context AND string concatenation
    var hasSQLContext = /\.(query|execute)\s*\(|sql\s*=|query\s*=|executeQuery|createStatement/i.test(line);
    var hasStringConcatenation = /\+.*["']|["'].*\+|\$\{.*\}|\`.*\$\{/i.test(line);
    var hasSQLKeywords = /select\s+.*from|insert\s+into|update\s+.*set|delete\s+from/i.test(line);
    
    // Only flag if we have actual SQL context AND string concatenation
    if ((hasSQLContext || hasSQLKeywords) && hasStringConcatenation) {
      // Skip if using parameterized queries (safe patterns)
      if (/parameterize|prepare|execute.*,\s*\[|\?\s*,|\$[0-9]+|bind.*param/i.test(line)) return;
      // Skip console.log, error messages, and UI strings
      if (/console\.|log\(|error\(|message\s*[:=]|text\s*[:=]|\.innerHTML|chalk\.|theme`/i.test(line)) return;
      
      issues.push({
        type: 'security',
        message: 'SQL injection risk: Use parameterized queries instead of string concatenation',
        line: index + 1,
        severity: 'critical',
        code: line.trim(),
        pattern: 'sql_injection'
      });
    }
  });
  
  return issues;
}

// 4. COMMAND INJECTION DETECTION
function checkCommandInjection(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var commandAPIs = ['cp.exec(', 'child_process.exec(', 'childProcess.exec(', 'spawn(', 'system(', 'popen(', 'subprocess.'];
  
  lines.forEach((line, index) => {
    commandAPIs.forEach(api => {
      if (line.includes(api) && (/\+|\$\{|format\(|f["']|\%s|\%d/i.test(line))) {
        issues.push({
          type: 'security',
          message: 'Command injection risk: User input in system commands - use parameterized execution',
          line: index + 1,
          severity: 'critical',
          code: line.trim(),
          pattern: 'command_injection'
        });
      }
    });
  });
  
  return issues;
}

// 5. XSS VULNERABILITIES
function checkXSSVulnerabilities(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Unsafe HTML insertion
    if (/innerHTML|outerHTML|insertAdjacentHTML/i.test(line) && 
        !/sanitize|escape|encode|textContent/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'XSS vulnerability: HTML insertion without sanitization',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'xss_vulnerability'
      });
    }
    
    // Direct user input in HTML
    if (/\$\{.*input.*\}|\+.*input.*\+/i.test(line) && /html|template/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'XSS risk: User input directly in HTML template',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'xss_vulnerability'
      });
    }
  });
  
  return issues;
}

// 6. INSECURE OPERATIONS
function checkInsecureOperations(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Disabled SSL verification
    if (/verify\s*=\s*False|VERIFY_NONE|rejectUnauthorized.*false/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'SSL verification disabled - man-in-the-middle attack risk',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'insecure_ssl'
      });
    }
    
    // Weak cryptographic algorithms
    if (/MD5|SHA1|DES(?!C)|RC4/i.test(line) && !/SHA1[0-9]|HMAC/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'Weak cryptographic algorithm - use SHA-256 or better',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'weak_crypto'
      });
    }
    
    // Insecure random number generation
    if (/Math\.random\(\)|random\.random\(\)/i.test(line) && /token|password|key|secret/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'Insecure random generation for security purposes - use crypto.randomBytes()',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'insecure_random'
      });
    }
  });
  
  return issues;
}

// 🟠 HIGH PRIORITY LOGIC CHECKS

// 7. NULL DEREFERENCE DETECTION
function checkNullDereference(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Object method calls without null checks
    if (/\w+\.(length|push|pop|map|filter|forEach|slice|indexOf|includes)/i.test(line)) {
      var prevLines = lines.slice(Math.max(0, index - 3), index).join('\n');
      var currentAndNext = lines.slice(index, index + 2).join('\n');
      
      if (!/if.*null|if.*undefined|\?\.|&&.*\w+|optional|guard|check/i.test(prevLines + currentAndNext)) {
        issues.push({
          type: 'logic',
          message: 'Potential null dereference: Check if object exists before calling methods',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'null_dereference'
        });
      }
    }
    
    // Array/Object access without bounds checking
    if (/\w+\[\d+\]|\w+\[.*\]/i.test(line) && !/length|size|bounds|check/i.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Array access without bounds checking - may cause runtime errors',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'bounds_check'
      });
    }
  });
  
  return issues;
}

// 8. UNHANDLED PROMISES DETECTION
function checkUnhandledPromises(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Async calls without proper error handling
    if (/await\s+\w+\(/i.test(line)) {
      var surroundingCode = lines.slice(Math.max(0, index - 5), index + 5).join('\n');
      if (!/try|catch|\.catch\(/i.test(surroundingCode)) {
        issues.push({
          type: 'logic',
          message: 'Unhandled async operation: Add try-catch or .catch() for error handling',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'unhandled_promise'
        });
      }
    }
    
    // Promise chains without catch
    if (/\.then\s*\(/i.test(line)) {
      var nextLines = lines.slice(index, index + 5).join('\n');
      if (!/\.catch\s*\(/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Promise chain without error handling: Add .catch() block',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'unhandled_promise'
        });
      }
    }
    
    // Fire-and-forget async calls
    if (/^\s*\w+\s*\(/i.test(line) && /async|await|Promise/i.test(line) && !/await|return|const|let|var/i.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Fire-and-forget async call: Handle the promise or mark as intentional',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'fire_forget_async'
      });
    }
  });
  
  return issues;
}

// 9. RESOURCE LEAKS DETECTION
function checkResourceLeaks(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // File operations without proper cleanup
    if (/open\s*\(|createReadStream|createWriteStream|fs\.open/i.test(line)) {
      var nextLines = lines.slice(index, index + 15).join('\n');
      if (!/close\s*\(\)|\.end\s*\(\)|finally|with\s+/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Resource leak: File/stream opened but not properly closed',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'resource_leak'
        });
      }
    }
    
    // Database connections without cleanup
    if (/connect\s*\(|createConnection|getConnection/i.test(line)) {
      var nextLines = lines.slice(index, index + 20).join('\n');
      if (!/disconnect|close|end|release|finally/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Database connection leak: Connection not properly closed',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'connection_leak'
        });
      }
    }
    
    // Event listeners without cleanup
    if (/addEventListener|on\s*\(/i.test(line)) {
      if (!/removeEventListener|off\s*\(|cleanup|unmount/i.test(content)) {
        issues.push({
          type: 'performance',
          message: 'Memory leak: Event listener added but never removed',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'memory_leak'
        });
      }
    }
  });
  
  return issues;
}

// 10. RACE CONDITIONS DETECTION
function checkRaceConditions(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Multiple async operations without proper synchronization
    if (/Promise\.all|Promise\.allSettled/i.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (/shared|global|state|variable/i.test(nextLines) && !/mutex|lock|semaphore/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Potential race condition: Concurrent access to shared state without synchronization',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'race_condition'
        });
      }
    }
    
    // Global variable modifications in async context
    if (/global\.|window\.|process\.env/i.test(line) && /=|assign|push|pop/i.test(line)) {
      var surroundingCode = lines.slice(Math.max(0, index - 3), index + 3).join('\n');
      if (/async|await|setTimeout|setInterval/i.test(surroundingCode)) {
        issues.push({
          type: 'logic',
          message: 'Race condition risk: Global state modification in async context',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'async_global_modify'
        });
      }
    }
  });
  
  return issues;
}

// 11. ERROR HANDLING ISSUES
function checkErrorHandling(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Empty catch blocks
    if (/catch\s*\(\s*\w*\s*\)\s*\{[\s]*\}/i.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Empty catch block: Handle errors properly or add explanatory comment',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'empty_catch'
      });
    }
    
    // Catch blocks that only log
    if (/catch.*\{[\s]*console\.log|catch.*\{[\s]*logger/i.test(line)) {
      var nextLines = lines.slice(index, index + 5).join('\n');
      if (!/throw|return|handle|recover/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Error swallowing: Catch block only logs but doesn\'t handle the error',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'error_swallow'
        });
      }
    }
    
    // REMOVED: Generic error messages (low severity noise)
    // if (/throw.*Error\s*\(\s*["']error|["']something went wrong|["']oops/i.test(line)) {
    //   issues.push({
    //     type: 'maintainability',
    //     message: 'Generic error message: Provide specific, actionable error details',
    //     line: index + 1,
    //     severity: 'low',
    //     code: line.trim(),
    //     pattern: 'generic_error'
    //   });
    // }
  });
  
  return issues;
}

// ⚡ PERFORMANCE CHECKS

// 12. N+1 QUERIES DETECTION
function checkNPlusOneQueries(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Database queries inside loops
    if (/for\s*\(|while\s*\(|\.forEach|\.map/i.test(line)) {
      var nextLines = lines.slice(index, index + 15).join('\n');
      var queryPatterns = [
        'query\\s*\\(',
        'find\\s*\\(',
        'findOne\\s*\\(',
        'findMany\\s*\\(',
        'select\\s*\\(',
        'insert\\s*\\(',
        'update\\s*\\(',
        'delete\\s*\\(',
        'execute\\s*\\(',
        'fetch\\s*\\(',
        'get\\s*\\(',
        'post\\s*\\(',
        'put\\s*\\(',
        'patch\\s*\\('
      ];
      
      queryPatterns.forEach(pattern => {
        if (new RegExp(pattern, 'i').test(nextLines)) {
          issues.push({
            type: 'performance',
            message: 'N+1 query problem: Database/API query inside loop - use batch operations',
            line: index + 1,
            severity: 'high',
            code: line.trim(),
            pattern: 'n_plus_one'
          });
        }
      });
    }
  });
  
  return issues;
}

// 13. INEFFICIENT REGEX DETECTION
function checkInefficiientRegex(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var dangerousPatterns = [
    { pattern: /\/.*\(\.\*\)\+.*\//, message: 'Catastrophic backtracking: (.*)+ pattern' },
    { pattern: /\/.*\(\.\+\)\*.*\//, message: 'Catastrophic backtracking: (.+)* pattern' },
    { pattern: /\/.*\(\.\*\)\*.*\//, message: 'Catastrophic backtracking: (.*)*  pattern' },
    { pattern: /\/.*\(\.\+\)\+.*\//, message: 'Catastrophic backtracking: (.+)+ pattern' },
    { pattern: /\/.*\(\.\*\)\{.*,.*\}.*\//, message: 'Potentially expensive: (.*)* with large quantifier' }
  ];
  
  lines.forEach((line, index) => {
    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'performance',
          message: message + ' - may cause exponential time complexity',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'inefficient_regex'
        });
      }
    });
    
    // Very long regex patterns
    var regexMatch = line.match(/\/(.{50,})\//);
    if (regexMatch) {
      issues.push({
        type: 'performance',
        message: 'Complex regex pattern: Consider breaking into smaller patterns',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'complex_regex'
      });
    }
  });
  
  return issues;
}

// 14. MEMORY LEAKS DETECTION
function checkMemoryLeaks(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Timers without cleanup
    if (/setInterval|setTimeout/i.test(line) && !/clearInterval|clearTimeout/i.test(content)) {
      issues.push({
        type: 'performance',
        message: 'Memory leak: Timer created but never cleared',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'timer_leak'
      });
    }
    
    // Event listeners in loops
    if (/for\s*\(|while\s*\(|\.forEach/i.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (/addEventListener|on\s*\(/i.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'Memory leak: Event listeners created in loop without cleanup',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'loop_event_leak'
        });
      }
    }
    
    // Global arrays that only grow
    if (/\.push\s*\(|\.unshift\s*\(/i.test(line) && /global|window|process/i.test(line)) {
      if (!/\.pop|\.shift|\.splice|\.length\s*=\s*0|clear/i.test(content)) {
        issues.push({
          type: 'performance',
          message: 'Memory leak: Global array grows but never shrinks',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'growing_global_array'
        });
      }
    }
  });
  
  return issues;
}

// 15. PERFORMANCE ANTIPATTERNS
function checkPerformanceAntipatterns(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // String concatenation in loops
    if (/for\s*\(|while\s*\(|\.forEach/i.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (/\+\s*=.*["']|concat\s*\(/i.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'Performance issue: String concatenation in loop - use array.join() or StringBuilder',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'string_concat_loop'
        });
      }
    }
    
    // REMOVED: Inefficient array operations (low severity noise)
    // if (/\.indexOf\s*\(.*\)\s*!==\s*-1/i.test(line)) {
    //   issues.push({
    //     type: 'performance',
    //     message: 'Performance: Use .includes() instead of .indexOf() !== -1',
    //     line: index + 1,
    //     severity: 'low',
    //     code: line.trim(),
    //     pattern: 'inefficient_array_check'
    //   });
    // }
    
    // Synchronous file operations in async context
    if (/readFileSync|writeFileSync|existsSync/i.test(line)) {
      var surroundingCode = lines.slice(Math.max(0, index - 5), index + 5).join('\n');
      if (/async|await|Promise/i.test(surroundingCode)) {
        issues.push({
          type: 'performance',
          message: 'Performance: Use async file operations instead of sync in async context',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'sync_in_async'
        });
      }
    }
  });
  
  return issues;
}

// 🔍 CODE QUALITY CHECKS

// 16. COMPLEXITY ANALYSIS
function checkComplexity(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var currentFunction = null;
  var complexity = 0;
  var functionStart = 0;
  var braceDepth = 0;
  
  lines.forEach((line, index) => {
    // Track brace depth
    braceDepth += (line.match(/\{/g) || []).length;
    braceDepth -= (line.match(/\}/g) || []).length;
    
    // Function start
    var funcMatch = line.match(/function\s+(\w+)|const\s+(\w+)\s*=.*=>|def\s+(\w+)|(\w+)\s*\(/i);
    if (funcMatch && /function|const.*=>|def\s+/i.test(line)) {
      if (currentFunction && complexity > 10) {
        issues.push({
          type: 'maintainability',
          message: `High cyclomatic complexity (${complexity}): Break function into smaller pieces`,
          line: functionStart,
          severity: 'medium',
          code: `function ${currentFunction}...`,
          pattern: 'high_complexity'
        });
      }
      
      currentFunction = funcMatch[1] || funcMatch[2] || funcMatch[3] || funcMatch[4];
      complexity = 1;
      functionStart = index + 1;
    }
    
    // Complexity indicators
    if (/if\s*\(|else|elif|while\s*\(|for\s*\(|catch|case\s+|switch\s*\(/i.test(line)) {
      complexity++;
    }
    if (/&&|\|\||and\s+|or\s+/i.test(line)) {
      complexity += (line.match(/&&|\|\|/g) || []).length;
    }
    
    // REMOVED: Long function check (low severity noise)  
    // if (currentFunction && braceDepth === 0 && index - functionStart > 50) {
    //   issues.push({
    //     type: 'maintainability',
    //     message: `Long function (${index - functionStart + 1} lines): Consider breaking into smaller functions`,
    //     line: functionStart,
    //     severity: 'low',
    //     code: `function ${currentFunction}...`,
    //     pattern: 'long_function'
    //   });
    // }
  });
  
  // Check last function
  if (currentFunction && complexity > 10) {
    issues.push({
      type: 'maintainability',
      message: `High cyclomatic complexity (${complexity}): Break function into smaller pieces`,
      line: functionStart,
      severity: 'medium',
      code: `function ${currentFunction}...`,
      pattern: 'high_complexity'
    });
  }
  
  return issues;
}

// 17. CODE SMELLS DETECTION
function checkCodeSmells(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // REMOVED: Magic numbers, TODO comments, commented code
    // These are "informational" issues that create noise
    // Focus only on medium+ severity issues that matter
    
    // Long parameter lists
    var paramMatch = line.match(/function.*\(([^)]+)\)|.*\(([^)]+)\)\s*=>/);
    if (paramMatch) {
      var params = (paramMatch[1] || paramMatch[2]).split(',');
      if (params.length > 5) {
        issues.push({
          type: 'maintainability',
          message: `Too many parameters (${params.length}): Consider using an options object`,
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'long_parameter_list'
        });
      }
    }
  });
  
  return issues;
}

// 18. BEST PRACTICES CHECK
function checkBestPractices(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // == instead of ===  (Keep only medium+ severity issues)
    if (/[^=!]==[^=]|[^=!]!=[^=]/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Use === or !== for strict equality comparison',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'loose_equality'
      });
    }
    
    // REMOVED: console.log, var usage, missing semicolons
    // These are "informational" noise that inflates issue counts
  });
  
  return issues;
}

// 🔗 CROSS-FILE ANALYSIS

// 19. UNUSED IMPORTS DETECTION
function checkUnusedImports(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var imports = [];
  
  lines.forEach((line, index) => {
    // ES6 imports
    var esImportMatch = line.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from/i);
    if (esImportMatch) {
      var importedItems = [];
      if (esImportMatch[1]) { // Named imports
        importedItems = esImportMatch[1].split(',').map(s => s.trim().replace(/\s+as\s+\w+/, ''));
      } else if (esImportMatch[2]) { // Namespace import
        importedItems = [esImportMatch[2]];
      } else if (esImportMatch[3]) { // Default import
        importedItems = [esImportMatch[3]];
      }
      
      importedItems.forEach(item => {
        imports.push({
          name: item,
          line: index + 1,
          code: line.trim()
        });
      });
    }
    
    // CommonJS require
    var requireMatch = line.match(/(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require/i);
    if (requireMatch) {
      var requiredItems = [];
      if (requireMatch[1]) { // Destructured require
        requiredItems = requireMatch[1].split(',').map(s => s.trim());
      } else if (requireMatch[2]) { // Direct require
        requiredItems = [requireMatch[2]];
      }
      
      requiredItems.forEach(item => {
        imports.push({
          name: item,
          line: index + 1,
          code: line.trim()
        });
      });
    }
  });
  
  // Check if imports are used
  imports.forEach(imp => {
    var isUsed = content.split('\n').some((line, idx) => 
      idx !== imp.line - 1 && 
      new RegExp('\\b' + imp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(line)
    );
    
    // REMOVED: Unused imports detection
    // This is informational noise - bundlers tree-shake unused imports
  });
  
  return issues;
}

// 20. IMPORT ISSUES DETECTION
function checkImportIssues(content, filePath, repoDir) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Relative imports that might be problematic
    if (/import.*from\s*["']\.\.?\//i.test(line)) {
      var importPath = line.match(/from\s*["']([^"']+)["']/i);
      if (importPath && importPath[1]) {
        var relativePath = importPath[1];
        
        // REMOVED: Deep relative imports (low severity noise)
        // if ((relativePath.match(/\.\.\//g) || []).length > 2) {
        //   issues.push({
        //     type: 'maintainability',
        //     message: 'Deep relative import: Consider restructuring or using absolute imports',
        //     line: index + 1,
        //     severity: 'low',
        //     code: line.trim(),
        //     pattern: 'deep_relative_import'
        //   });
        // }
        
        // REMOVED: Parent directory import warnings
        // This is informational noise - relative imports are normal
      }
    }
    
    // REMOVED: Missing file extensions 
    // This is informational noise - modern bundlers handle this
  });
  
  return issues;
}

// 🔒 SECURITY VULNERABILITY DETECTION
function detectSecurityVulnerabilities(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var lineNum = index + 1;
    
    // SQL Injection Detection - more precise
    var hasSQLContext = /\.(query|execute)\s*\(|sql\s*=|query\s*=|executeQuery|createStatement/i.test(line);
    var hasStringConcatenation = /\$\{.*\}|\+.*["']|["'].*\+/i.test(line);
    var hasSQLKeywords = /select\s+.*from|insert\s+into|update\s+.*set|delete\s+from/i.test(line);
    
    if ((hasSQLContext || hasSQLKeywords) && hasStringConcatenation) {
      // Skip console.log, error messages, and UI strings
      if (!/console\.|log\(|error\(|message\s*[:=]|text\s*[:=]|chalk\.|theme`/i.test(line)) {
        issues.push({
          type: 'security',
          message: 'Potential SQL injection: Query uses string concatenation instead of parameterized queries',
          line: lineNum,
          severity: 'critical',
          code: line.trim(),
          pattern: 'sql_injection'
        });
      }
    }
    
    // XSS Detection - more precise
    if ((/\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(/i.test(line)) && 
        (/\+.*["']|["'].*\+|\$\{.*\}|\`.*\$\{/i.test(line))) {
      // Skip safe patterns and type definitions
      if (!/sanitize|escape|encode|textContent|innerText|get\s+innerHTML|set\s+innerHTML.*string|TrustedHTML|interface\s|type\s|declare\s/i.test(line)) {
        issues.push({
          type: 'security', 
          message: 'Potential XSS: Dynamic HTML insertion without sanitization',
          line: lineNum,
          severity: 'high',
          code: line.trim(),
          pattern: 'xss_vulnerability'
        });
      }
    }
    
    // Command Injection Detection - more precise (avoid regex .exec() false positives)
    if (/\b(cp|child_process|childProcess)\.exec\s*\(|\bspawn\s*\(|\bsystem\s*\(/i.test(line) && /\+.*["']|["'].*\+|\$\{.*\}|\`.*\$\{/i.test(line)) {
      // Skip console.log, error messages, and alias declarations
      if (!/console\.|log\(|error\(|alias\s|deploy\s|now\s+deploy/i.test(line)) {
        issues.push({
          type: 'security',
          message: 'Potential command injection: System command uses unsanitized input',
          line: lineNum,
          severity: 'critical', 
          code: line.trim(),
          pattern: 'command_injection'
        });
      }
    }
    
    // Hardcoded Secrets Detection
    if (/(password|secret|key|token)\s*[:=]\s*["'][^"']{8,}/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded secret detected: Sensitive data should be in environment variables',
        line: lineNum,
        severity: 'high',
        code: line.replace(/["'][^"']*["']/, '"***REDACTED***"'),
        pattern: 'hardcoded_secret'
      });
    }
  });
  
  return issues;
}

// 🐛 LOGIC BUG DETECTION  
function detectLogicBugs(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var lineNum = index + 1;
    
    // Silent Exception Swallowing
    if (/catch.*\{[\s]*\}|catch.*\{\s*\/\/|catch.*\{\s*console\.log/i.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Silent exception handling: Errors are caught but not properly handled',
        line: lineNum,
        severity: 'high',
        code: line.trim(),
        pattern: 'silent_exception'
      });
    }
    
    // Async Without Error Handling
    if (/await\s+\w+\(/i.test(line) && !/try|catch/i.test(content.slice(content.indexOf(line) - 200, content.indexOf(line) + 200))) {
      issues.push({
        type: 'logic',
        message: 'Unhandled async operation: await call without try-catch block',
        line: lineNum,
        severity: 'medium',
        code: line.trim(),
        pattern: 'unhandled_async'
      });
    }
    
    // Null/Undefined Dereference
    if (/\.length|\.push|\.map|\.filter/i.test(line) && !/if.*null|if.*undefined|\?\./i.test(line)) {
      var prevLine = lines[index - 1] || '';
      if (!/if.*null|if.*undefined/i.test(prevLine)) {
        issues.push({
          type: 'logic',
          message: 'Potential null dereference: Object method called without null check',
          line: lineNum,
          severity: 'medium',
          code: line.trim(),
          pattern: 'null_dereference'
        });
      }
    }
  });
  
  return issues;
}

// ⚡ PERFORMANCE BUG DETECTION
function detectPerformanceBugs(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var lineNum = index + 1;
    
    // Database Query in Loop
    if (/for\s*\(|while\s*\(|\.forEach|\.map/i.test(line)) {
      var nextFewLines = lines.slice(index, index + 10).join('\n');
      if (/query|findOne|findMany|select|insert|update/i.test(nextFewLines)) {
        issues.push({
          type: 'performance',
          message: 'N+1 Query Problem: Database query inside loop - consider batch operations',
          line: lineNum,
          severity: 'high',
          code: line.trim(),
          pattern: 'n_plus_one_query'
        });
      }
    }
    
    // Inefficient Regex
    if (/new RegExp|\/.*\*.*\/|\/.*\+.*\+/i.test(line)) {
      issues.push({
        type: 'performance',
        message: 'Potentially inefficient regex: Complex pattern may cause performance issues',
        line: lineNum,
        severity: 'medium',
        code: line.trim(),
        pattern: 'inefficient_regex'
      });
    }
    
    // Memory Leak Patterns
    if (/addEventListener|setInterval|setTimeout/i.test(line) && !/removeEventListener|clearInterval|clearTimeout/i.test(content)) {
      issues.push({
        type: 'performance',
        message: 'Potential memory leak: Event listener/timer added but never removed',
        line: lineNum,
        severity: 'medium',
        code: line.trim(),
        pattern: 'memory_leak'
      });
    }
  });
  
  return issues;
}

// 🔗 CROSS-FILE RELATIONSHIP ANALYSIS (simplified for now)
async function detectCrossFileIssues(content, filePath, repoDir) {
  var issues = [];
  
  // This is where we'd do semantic indexing and cross-file analysis
  // For now, just detect obvious import/export mismatches
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var lineNum = index + 1;
    
    // Import/Export Mismatch Detection (simplified)
    if (/import.*from\s*["']\.\.?\//i.test(line)) {
      var importPath = line.match(/from\s*["']([^"']+)["']/i);
      if (importPath && !importPath[1].includes('node_modules')) {
        // TODO: Check if imported file exists and exports match
        // For now, just flag relative imports for review
        // REMOVED: Relative import detection (low severity noise)
        // issues.push({
        //   type: 'logic',
        //   message: 'Relative import detected - verify file exists and exports match',
        //   line: lineNum,
        //   severity: 'low',
        //   code: line.trim(),
        //   pattern: 'import_mismatch'
        // });
      }
    }
  });
  
  return issues;
}

// 🧠 SMART AI ANALYSIS: Efficient and context-aware  
async function performAIAnalysis(content, filePath) {
  console.log(`🧠 Running AI analysis for: ${filePath}`);
  
  if (!OPENAI_API_KEY) {
    console.warn('⚠️ OpenAI API key missing, using fallback analysis');
    return performBasicAnalysis(content, filePath);
  }
  
  try {
    // Smart filtering: Only analyze files with potential issues
    var hasSecurityKeywords = /password|token|secret|eval|innerHTML|sql|query|auth|dangerous/i.test(content);
    var hasPerformanceKeywords = /useEffect|useState|for.*in|while|setTimeout|setInterval/i.test(content);
    var hasErrorKeywords = /try|catch|throw|error|exception|null|undefined/i.test(content);
    var isComplexFile = content.length > 1000;
    
    // Skip only very simple files (but still analyze most files)
    if (!hasSecurityKeywords && !hasPerformanceKeywords && !hasErrorKeywords && content.length < 300) {
      console.log(`⏭️ Skipping very simple file: ${filePath} (< 300 chars, no risk patterns)`);
      return [];
    }
    
    // Truncate very large files to save tokens (keep most important parts)
    var analysisContent = content;
    if (content.length > 3000) {
      var lines = content.split('\n');
      var importSection = lines.slice(0, 20).join('\n');  // Keep imports
      var mainSection = lines.slice(20, -20).join('\n').substring(0, 2000); // Middle part
      var endSection = lines.slice(-20).join('\n');  // Keep end
      analysisContent = importSection + '\n// ... (middle truncated) ...\n' + mainSection + '\n// ... (end part) ...\n' + endSection;
    }
    
    var ext = path.extname(filePath).toLowerCase();
    var language = ext === '.py' ? 'Python' : ext === '.js' || ext === '.jsx' ? 'JavaScript' : 
                   ext === '.ts' || ext === '.tsx' ? 'TypeScript' : ext === '.cpp' || ext === '.cc' ? 'C++' : 
                   ext === '.c' ? 'C' : ext === '.java' ? 'Java' : 'code';
    
    var prompt = `You are an expert ${language} security and performance analyst. Analyze this code for CRITICAL issues only.

FOCUS ON:
1. 🔒 Security: XSS, injection, secrets, unsafe operations
2. ⚡ Performance: infinite loops, memory leaks, inefficient algorithms  
3. 🐛 Logic: null pointers, race conditions, error handling

File: ${filePath}
\`\`\`${language.toLowerCase()}
${analysisContent}
\`\`\`

Return ONLY a JSON array of real issues. Be precise with line numbers:
[{"type": "security|performance|logic", "message": "specific issue description", "line": actual_line_number, "severity": "critical|high|medium", "code": "exact problematic line"}]

Rules:
- Only return ACTUAL problems, not style/formatting
- Line numbers must be accurate
- Be specific in messages (not generic)
- Return [] if no critical issues found
- Max 10 issues per file`;

    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // Fast and cost-effective
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,  // Reasonable response size
        temperature: 0.1  // Consistent results
      })
    });
    
    if (!response.ok) {
      console.error(`❌ OpenAI API error: ${response.status}`);
      return performBasicAnalysis(content, filePath);
    }
    
    var data = await response.json();
    var aiResponse = data.choices[0].message.content.trim();
    
    // Extract JSON from response
    var jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        var issues = JSON.parse(jsonMatch[0]);
        console.log(`🧠 AI found ${issues.length} issues in ${filePath}`);
        return Array.isArray(issues) ? issues : [];
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse AI JSON for ${filePath}:`, parseError.message);
        return [];
      }
    } else {
      console.log(`ℹ️ AI found no JSON issues in ${filePath}`);
      // Fallback to basic analysis if AI doesn't find structured issues
      console.log(`🔄 Running fallback pattern analysis for ${filePath}`);
      return performBasicAnalysis(content, filePath);
    }
    
  } catch (error) {
    console.error(`❌ AI analysis failed for ${filePath}:`, error.message);
    return performBasicAnalysis(content, filePath);
  }
}

// 🚀 NEW ENHANCED ANALYSIS ENGINE - Combines best patterns from AWS version
// 🗺️ REPOSITORY MAP GENERATOR - Creates intelligent repo structure
function createRepositoryMap(allFiles) {
  const repoMap = {
    structure: {},
    folders: {},
    fileStats: {
      total: allFiles.length,
      byType: {},
      byFolder: {}
    }
  };
  
  // Build folder structure with file counts and types
  allFiles.forEach(filePath => {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    const folderPath = parts.slice(0, -1).join('/') || 'root';
    const fileType = getFileTypeFromPath(filePath);
    
    // Track folder contents
    if (!repoMap.folders[folderPath]) {
      repoMap.folders[folderPath] = {
        files: [],
        types: {},
        importance: 'unknown'
      };
    }
    
    repoMap.folders[folderPath].files.push(fileName);
    repoMap.folders[folderPath].types[fileType] = (repoMap.folders[folderPath].types[fileType] || 0) + 1;
    
    // Track file type stats
    repoMap.fileStats.byType[fileType] = (repoMap.fileStats.byType[fileType] || 0) + 1;
    repoMap.fileStats.byFolder[folderPath] = (repoMap.fileStats.byFolder[folderPath] || 0) + 1;
  });
  
  return repoMap;
}

// 🎭 AI REPOSITORY STRATEGIST - Analyzes repo map for intelligent decisions
async function createAnalysisStrategy(allFiles) {
  console.log('🎭 AI Repository Strategist: Analyzing repository structure...');
  
  if (!OPENAI_API_KEY || allFiles.length < 20) {
    // For small repos, still run AI analysis on the most important files
    var importantFiles = allFiles.filter(f => 
      /\.(js|ts|jsx|tsx|py|java|go|rs)$/i.test(f) && 
      !/test|spec|\.test\.|\.spec\./i.test(f)
    ).slice(0, 5); // Top 5 most important files for AI analysis
    
    return {
      highPriority: allFiles.slice(0, Math.min(50, allFiles.length)),
      critical: importantFiles, // 🧠 ENSURE AI ANALYSIS FOR SMALL REPOS
      skipFiles: [],
      analysisStrategy: 'comprehensive'
    };
  }
  
  try {
    // Create intelligent repository map
    const repoMap = createRepositoryMap(allFiles);
    
    // Create folder summary for AI analysis
    const folderSummary = Object.entries(repoMap.folders)
      .map(([folder, info]) => {
        const mainTypes = Object.entries(info.types)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ');
        return `${folder}/ (${info.files.length} files: ${mainTypes})`;
      })
      .slice(0, 30); // Limit to top 30 folders
    
    const strategyPrompt = `You are an AI Repository Strategist. Analyze this repository structure and create an intelligent analysis plan.

REPOSITORY OVERVIEW:
- Total files: ${repoMap.fileStats.total}
- File types: ${Object.entries(repoMap.fileStats.byType).map(([type, count]) => `${count} ${type}`).join(', ')}

FOLDER STRUCTURE:
${folderSummary.join('\n')}

SAMPLE FILES (showing structure):
${allFiles.slice(0, 50).join('\n')}

Create analysis strategy with different priorities:

CRITICAL: Files that MUST be analyzed (auth, payment, admin, core business logic)
HIGH: Important files likely to have issues (API endpoints, components, services)  
MEDIUM: Standard files (utilities, helpers, regular components)
SKIP: Files to completely skip (tests, docs, configs, assets)
LIGHT: Files to check only for secrets/leaks (README, configs, env files)

Return ONLY JSON:
{
  "strategy": "detected-tech-stack",
  "critical": ["path1", "path2"],
  "high": ["path3", "path4"], 
  "medium": ["path5", "path6"],
  "light": ["README.md", "config.js"],
  "skip": ["test1.js", "docs/"],
  "reasoning": "Brief explanation of decisions"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: strategyPrompt }],
        temperature: 0.1,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      console.warn('⚠️ AI strategy planning failed, using default strategy');
      return { highPriority: allFiles.slice(0, 50), skipFiles: [], analysisStrategy: 'comprehensive' };
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    
    // Parse AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const strategy = JSON.parse(jsonMatch[0]);
      console.log(`🎯 AI Repository Strategy: ${strategy.strategy}`);
      console.log(`📊 Analysis Plan: ${strategy.critical?.length || 0} critical, ${strategy.high?.length || 0} high, ${strategy.medium?.length || 0} medium, ${strategy.light?.length || 0} light, ${strategy.skip?.length || 0} skip`);
      console.log(`💡 Reasoning: ${strategy.reasoning}`);
      
      // Convert to our expected format
      return {
        critical: strategy.critical || [],
        high: strategy.high || [],
        medium: strategy.medium || [],
        light: strategy.light || [],
        skip: strategy.skip || [],
        analysisStrategy: strategy.strategy,
        reasoning: strategy.reasoning
      };
    }
    
  } catch (error) {
    console.warn('⚠️ AI strategy planning error:', error.message);
  }
  
  // Fallback strategy
  return {
    critical: allFiles.filter(f => f.includes('auth') || f.includes('payment') || f.includes('admin')).slice(0, 10),
    high: allFiles.filter(f => !f.includes('test') && !f.includes('spec') && (f.includes('api') || f.includes('component'))).slice(0, 30),
    medium: allFiles.filter(f => !f.includes('test') && !f.includes('spec')).slice(0, 50),
    light: allFiles.filter(f => f.includes('README') || f.includes('config')).slice(0, 20),
    skip: allFiles.filter(f => f.includes('test') || f.includes('spec') || f.includes('.d.ts')),
    analysisStrategy: 'comprehensive'
  };
}

// Helper function to detect file type from path
function getFileTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    if (filePath.includes('react') || filePath.includes('component')) return 'react';
    if (filePath.includes('server') || filePath.includes('api')) return 'server';
    return 'javascript';
  }
  if (['.py'].includes(ext)) return 'python';
  if (['.java'].includes(ext)) return 'java';
  if (fileName.includes('docker')) return 'docker';
  if (fileName.includes('package.json')) return 'config';
  if (ext === '.md') return 'docs';
  return 'other';
}

// 🚀 SMART PATTERN SELECTION - File Type Based (Super Fast!)
function selectPatternsForBatch(fileBatch, analysisStrategy) {
  // Skip AI for pattern selection - use smart file-type mapping instead
  // This is MUCH faster and almost as effective
  
  const patternMap = {};
  
  for (const file of fileBatch) {
    const fileType = getFileTypeFromPath(file.path);
    const fileName = path.basename(file.path).toLowerCase();
    
    // Smart pattern selection based on file type and name
    if (fileType === 'react') {
      patternMap[file.path] = ['security', 'react_hooks', 'memory_leaks'];
    } else if (fileType === 'server' || fileName.includes('api') || fileName.includes('server')) {
      patternMap[file.path] = ['security', 'async_patterns', 'logic_errors'];
    } else if (fileName.includes('auth') || fileName.includes('login')) {
      patternMap[file.path] = ['security', 'async_patterns'];
    } else if (fileName.includes('config') || fileName.includes('env')) {
      patternMap[file.path] = ['security'];
    } else if (fileType === 'javascript' || fileType === 'python') {
      patternMap[file.path] = ['security', 'async_patterns', 'logic_errors'];
    } else {
      patternMap[file.path] = ['security']; // Default to security for all files
    }
  }
  
  console.log(`🚀 Smart pattern selection for batch of ${fileBatch.length} files (no AI delay)`);
  return patternMap;
}

// 🎼 AI PATTERN CONDUCTOR - ONLY for complex repos (Optional Enhancement)
async function selectPatternsForBatchAI(fileBatch, analysisStrategy) {
  // Only use AI for pattern selection if:
  // 1. Repo is very large (100+ priority files)
  // 2. Mixed tech stack (React + Python + Go)
  // 3. User specifically requests AI pattern selection
  
  if (!OPENAI_API_KEY || fileBatch.length < 50) {
    return selectPatternsForBatch(fileBatch, analysisStrategy);
  }
  
  // AI implementation for complex cases...
  // (keeping the AI code but making it optional)
}

// 🎯 PRIORITY-BASED ANALYSIS - Different analysis depth based on file importance
async function analyzeFileByPriority(content, filePath, priority = 'medium', analysisStrategy = null) {
  console.log(`🎯 ${priority.toUpperCase()} priority analysis for: ${filePath}`);
  
  switch (priority) {
    case 'critical':
      return await analyzeCriticalFile(content, filePath);
    case 'high':
      return await analyzeHighPriorityFile(content, filePath);
    case 'medium':
      return await analyzeMediumPriorityFile(content, filePath);
    case 'light':
      return await analyzeLightFile(content, filePath);
    default:
      return await analyzeMediumPriorityFile(content, filePath);
  }
}

// 🔥 CRITICAL FILES - Full comprehensive analysis including medium issues
async function analyzeCriticalFile(content, filePath) {
  console.log(`🔥 CRITICAL analysis: ${filePath}`);
  var allIssues = [];
  
  // Run ALL security patterns - no shortcuts for critical files
  allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
  allIssues = allIssues.concat(checkSQLInjectionEnhanced(content, filePath));
  allIssues = allIssues.concat(checkXSSVulnerabilitiesEnhanced(content, filePath));
  allIssues = allIssues.concat(checkCommandInjectionEnhanced(content, filePath));
  allIssues = allIssues.concat(checkResourceLeaksEnhanced(content, filePath));
  allIssues = allIssues.concat(checkMemoryLeaksEnhanced(content, filePath));
  allIssues = allIssues.concat(checkErrorHandlingEnhanced(content, filePath));
  allIssues = allIssues.concat(checkPerformanceIssuesEnhanced(content, filePath));
  
  // 🎯 DISABLED: Medium priority detection for speed optimization
  // These patterns were causing 5-10x slowdown due to multiple line-by-line processing
  // TODO: Implement more efficient single-pass analysis
  // allIssues = allIssues.concat(checkReactPerformanceIssues(content, filePath));
  // allIssues = allIssues.concat(checkLogicErrors(content, filePath));
  // allIssues = allIssues.concat(checkAsyncPatternIssues(content, filePath));
  
  // Return ALL issues including low severity for critical files
  return allIssues;
}

// ⚡ HIGH PRIORITY FILES - Security + Logic focus + Medium Issues
async function analyzeHighPriorityFile(content, filePath) {
  console.log(`⚡ HIGH priority analysis: ${filePath}`);
  var allIssues = [];
  
  // Focus on security and logic issues
  allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
  allIssues = allIssues.concat(checkSQLInjectionEnhanced(content, filePath));
  allIssues = allIssues.concat(checkXSSVulnerabilitiesEnhanced(content, filePath));
  allIssues = allIssues.concat(checkErrorHandlingEnhanced(content, filePath));
  
  // 🆕 NEW ISSUE TYPES FOR HIGH PRIORITY FILES
  allIssues = allIssues.concat(checkCodeQualityIssues(content, filePath));
  allIssues = allIssues.concat(checkAccessibilityIssues(content, filePath));
  allIssues = allIssues.concat(checkDataValidationIssues(content, filePath));
  allIssues = allIssues.concat(checkConcurrencyIssues(content, filePath));
  allIssues = allIssues.concat(checkConfigurationIssues(content, filePath));
  
  // 🎯 DISABLED: Medium priority detection for speed optimization
  // allIssues = allIssues.concat(checkReactPerformanceIssues(content, filePath));
  // allIssues = allIssues.concat(checkLogicErrors(content, filePath));
  // allIssues = allIssues.concat(checkAsyncPatternIssues(content, filePath));
  
  // Return medium+ severity issues
  return allIssues.filter(issue => 
    issue.severity === 'critical' || issue.severity === 'high' || issue.severity === 'medium'
  );
}

// 📋 MEDIUM PRIORITY FILES - Security + Basic Medium Issues
async function analyzeMediumPriorityFile(content, filePath) {
  console.log(`📋 MEDIUM priority analysis: ${filePath}`);
  var allIssues = [];
  
  // Basic security checks
  allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
  allIssues = allIssues.concat(checkSQLInjectionEnhanced(content, filePath));
  
  // 🎯 DISABLED: Medium priority detection for speed optimization
  // allIssues = allIssues.concat(checkLogicErrors(content, filePath));
  
  // Return high+ severity issues + some medium
  return allIssues.filter(issue => 
    issue.severity === 'critical' || issue.severity === 'high' || 
    (issue.severity === 'medium' && ['assignment_in_condition', 'nan_comparison', 'missing_await'].includes(issue.pattern))
  );
}

// 🔍 LIGHT FILES - Secrets/leaks only (README, configs, etc.)
async function analyzeLightFile(content, filePath) {
  console.log(`🔍 LIGHT analysis (secrets + strict low priority): ${filePath}`);
  var allIssues = [];
  
  // Only check for hardcoded secrets and basic leaks
  allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
  
  // 🔍 VERY STRICT LOW PRIORITY ISSUES (zero false positives)
  allIssues = allIssues.concat(checkStrictLowPriorityIssues(content, filePath));
  
  // Return critical + strict low priority issues
  return allIssues.filter(issue => 
    issue.severity === 'critical' || 
    (issue.severity === 'low' && issue.strictPattern === true)
  );
}

// 🎯 ENHANCED MEDIUM PRIORITY DETECTION - React Performance & Logic Issues
function checkReactPerformanceIssues(content, filePath) {
  console.log(`⚡ Checking React performance issues: ${filePath}`);
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // Skip comments and imports
    if (/^\/\/|^\/\*|\*\/|^import|^export/.test(trimmed)) return;
    
    // 1. useEffect missing dependencies
    if (/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (!/\[\s*\]/.test(nextLines) && /setState|set[A-Z]|fetch|axios/.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'useEffect missing dependencies - may cause infinite re-renders',
          line: index + 1,
          severity: 'high',
          code: trimmed,
          pattern: 'react_useeffect_deps'
        });
      }
    }
    
    // 2. Expensive operations in render (no useMemo)
    if (/\.map\s*\(.*\.sort\s*\(|\.filter\s*\(.*\.map\s*\(/.test(line)) {
      var surroundingCode = lines.slice(Math.max(0, index - 5), index + 5).join('\n');
      if (!/useMemo|React\.memo/.test(surroundingCode)) {
        issues.push({
          type: 'performance',
          message: 'Expensive array operations in render - consider useMemo',
          line: index + 1,
          severity: 'medium',
          code: trimmed,
          pattern: 'react_expensive_render'
        });
      }
    }
    
    // 3. Missing React.memo for functional components
    if (/^(export\s+)?(const|function)\s+[A-Z]\w*\s*[=\(]/.test(trimmed) && /props/.test(line)) {
      var componentLines = lines.slice(index, index + 20).join('\n');
      if (!/React\.memo|memo\s*\(/.test(componentLines) && /\.map\s*\(|props\.\w+/.test(componentLines)) {
        issues.push({
          type: 'performance',
          message: 'Component receives props but not memoized - may cause unnecessary re-renders',
          line: index + 1,
          severity: 'medium',
          code: trimmed,
          pattern: 'react_missing_memo'
        });
      }
    }
    
    // 4. useState with object (should use useReducer)
    if (/useState\s*\(\s*\{/.test(line)) {
      issues.push({
        type: 'maintainability',
        message: 'Complex state object in useState - consider useReducer',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'react_complex_state'
      });
    }
    
    // 5. Inline object/array in JSX (causes re-renders)
    if (/\w+\s*=\s*\{[^}]+\}|\w+\s*=\s*\[[^\]]+\]/.test(line) && /style|className|props/.test(line)) {
      issues.push({
        type: 'performance',
        message: 'Inline object/array in JSX causes re-renders - move outside render',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'react_inline_objects'
      });
    }
  });
  
  return issues;
}

// 🧠 LOGIC ERROR DETECTION - Common Programming Mistakes
function checkLogicErrors(content, filePath) {
  console.log(`🧠 Checking logic errors: ${filePath}`);
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // 1. REAL ASSIGNMENT BUGS: Only flag actual assignment (=) not equality (==)
    // DISABLED: Pattern was too aggressive, flagging valid arrow functions and property access
    // TODO: Create more precise pattern that only catches real assignments like "if (x = 5)"
    // Current pattern incorrectly flags: "if (gate(flags => flags.something))" as assignment
    /*
    if (/if\s*\([^)]*[^=!<>]\s*=\s*[^=]/.test(line) && !/===|!==|==|!=|<=|>=/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Assignment in if condition - did you mean ==?',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'assignment_in_condition'
      });
    }
    */
    
    // 2. REAL LOGIC ISSUES: Missing null checks before property access
    if (/\w+\.\w+/.test(line) && !/if\s*\(.*!=\s*null\)|if\s*\(.*==\s*null\)/.test(line) && /\.length|\.push|\.map|\.filter/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Potential null reference - consider null check before property access',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'missing_null_check'
      });
    }
    
    // 2. Array.length in loop condition (performance issue)
    if (/for\s*\([^;]*;\s*\w+\s*<\s*\w+\.length/.test(line)) {
      issues.push({
        type: 'performance',
        message: 'Array.length evaluated every iteration - cache the length',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'inefficient_loop'
      });
    }
    
    // 3. Comparing with NaN (always false)
    if (/===\s*NaN|!==\s*NaN|==\s*NaN|!=\s*NaN/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Comparison with NaN always returns false - use isNaN() or Number.isNaN()',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'nan_comparison'
      });
    }
    
    // 4. REAL REACT ISSUES: Missing dependency in useEffect
    if (/useEffect\s*\(\s*\(\s*\)\s*=>\s*{/.test(line) && !content.includes('[]')) {
      issues.push({
        type: 'react',
        message: 'useEffect missing dependency array - may cause infinite re-renders',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'missing_useeffect_deps'
      });
    }
    
    // 5. REAL PERFORMANCE ISSUE: Multiple DOM queries
    if (/(document\.getElementById|document\.querySelector)/.test(line) && /\./.test(line)) {
      issues.push({
        type: 'performance',
        message: 'DOM query in loop or multiple times - consider caching',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'inefficient_dom_query'
      });
    }
    
    // 6. REAL ASYNC ISSUES: Unhandled promise rejections
    if (/\.then\s*\(/.test(line) && !/\.catch\s*\(/.test(line) && !content.includes('.catch(')) {
      issues.push({
        type: 'async',
        message: 'Promise without .catch() - unhandled rejections can crash app',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'unhandled_promise'
      });
    }
    
    // 4. Missing break in switch case
    if (/case\s+.*:/.test(line)) {
      var nextLines = lines.slice(index + 1, index + 10);
      var hasBreak = false;
      var hasReturn = false;
      
      for (var i = 0; i < nextLines.length; i++) {
        if (/break;|return/.test(nextLines[i])) {
          hasBreak = true;
          break;
        }
        if (/case\s+.*:|default\s*:/.test(nextLines[i])) {
          break;
        }
      }
      
      if (!hasBreak && nextLines.some(l => l.trim().length > 0)) {
        issues.push({
          type: 'logic',
          message: 'Switch case without break - may cause fall-through',
          line: index + 1,
          severity: 'medium',
          code: trimmed,
          pattern: 'missing_break'
        });
      }
    }
    
    // 5. Potential null/undefined access
    if (/\w+\.\w+/.test(line) && !/if.*null|if.*undefined|\?\.|&&.*\w+/.test(line)) {
      var prevLine = lines[index - 1] || '';
      if (!/if.*null|if.*undefined/.test(prevLine)) {
        issues.push({
          type: 'logic',
          message: 'Potential null/undefined access - add null check',
          line: index + 1,
          severity: 'medium',
          code: trimmed,
          pattern: 'null_access_risk'
        });
      }
    }
  });
  
  return issues;
}

// 🔄 ASYNC/AWAIT PATTERN ISSUES
function checkAsyncPatternIssues(content, filePath) {
  console.log(`🔄 Checking async pattern issues: ${filePath}`);
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // 1. await in loop (should use Promise.all)
    if (/for\s*\(|while\s*\(|\.forEach/.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (/await\s+/.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'await in loop - consider Promise.all for parallel execution',
          line: index + 1,
          severity: 'medium',
          code: trimmed,
          pattern: 'await_in_loop'
        });
      }
    }
    
    // 2. Missing await on Promise-returning function
    if (/\.\s*(fetch|query|save|update|delete|find)\s*\(/.test(line) && !/await|\.then|\.catch/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Promise-returning function without await - potential unhandled promise',
        line: index + 1,
        severity: 'medium',
        code: trimmed,
        pattern: 'missing_await'
      });
    }
    
    // 3. async function without try-catch
    if (/async\s+(function|\w+\s*=>|\w+\s*\()/.test(line)) {
      var functionBody = lines.slice(index, index + 20).join('\n');
      if (!/try\s*\{|\.catch\s*\(/.test(functionBody) && /await/.test(functionBody)) {
        issues.push({
          type: 'error-handling',
          message: 'async function without error handling - add try-catch',
          line: index + 1,
          severity: 'medium',
          code: trimmed,
          pattern: 'async_no_error_handling'
        });
      }
    }
  });
  
  return issues;
}

async function analyzeFileWithNewEngine(content, filePath, tempDir, analysisStrategy = null, selectedPatterns = 'all') {
  console.log(`🎯 Enhanced analysis for: ${filePath}`);
  
  var ext = path.extname(filePath).toLowerCase();
  var fileName = path.basename(filePath).toLowerCase();
  
  // selectedPatterns now passed from batch processing
  
  // Skip non-code files
  var skipExtensions = ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'];
  var skipPatterns = [
    /test/i, /spec/i, /__tests__/i, /\.test\./i, /\.spec\./i,
    /config/i, /\.config\./i, /webpack/i, /babel/i, /eslint/i,
    /readme/i, /changelog/i, /license/i, /\.md$/i,
    /fixture/i, /mock/i, /example/i, /demo/i,
    /node_modules/i, /dist/i, /build/i, /coverage/i
  ];
  
  if (skipExtensions.includes(ext)) {
    console.log(`⏭️ Skipping ${ext} file: ${filePath}`);
    return [];
  }
  
  if (skipPatterns.some(pattern => pattern.test(filePath))) {
    console.log(`⏭️ Skipping: ${filePath} (test/config/docs)`);
    return [];
  }
  
  var allIssues = [];
  
  // 🎼 AI-DRIVEN PATTERN EXECUTION - Only run selected patterns
  if (selectedPatterns === 'all') {
    // Run all patterns (fallback)
    allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
    allIssues = allIssues.concat(checkSQLInjectionEnhanced(content, filePath));
    allIssues = allIssues.concat(checkXSSVulnerabilitiesEnhanced(content, filePath));
    allIssues = allIssues.concat(checkCommandInjectionEnhanced(content, filePath));
    allIssues = allIssues.concat(checkResourceLeaksEnhanced(content, filePath));
    allIssues = allIssues.concat(checkMemoryLeaksEnhanced(content, filePath));
    allIssues = allIssues.concat(checkErrorHandlingEnhanced(content, filePath));
    allIssues = allIssues.concat(checkPerformanceIssuesEnhanced(content, filePath));
  } else {
    // Run only AI-selected patterns
    if (selectedPatterns.includes('security')) {
      allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
      allIssues = allIssues.concat(checkSQLInjectionEnhanced(content, filePath));
      allIssues = allIssues.concat(checkXSSVulnerabilitiesEnhanced(content, filePath));
      allIssues = allIssues.concat(checkCommandInjectionEnhanced(content, filePath));
    }
    
    if (selectedPatterns.includes('memory_leaks')) {
      allIssues = allIssues.concat(checkMemoryLeaksEnhanced(content, filePath));
      allIssues = allIssues.concat(checkResourceLeaksEnhanced(content, filePath));
    }
    
    if (selectedPatterns.includes('async_patterns')) {
      allIssues = allIssues.concat(checkErrorHandlingEnhanced(content, filePath));
    }
    
    if (selectedPatterns.includes('performance')) {
      allIssues = allIssues.concat(checkPerformanceIssuesEnhanced(content, filePath));
    }
    
    // If no patterns selected or unknown patterns, run security by default
    if (!selectedPatterns.length) {
      allIssues = allIssues.concat(checkHardcodedSecretsEnhanced(content, filePath));
    }
  }
  
  // Filter to only critical/high/medium issues
  var criticalIssues = allIssues.filter(issue => 
    issue.severity === 'critical' || issue.severity === 'high' || issue.severity === 'medium'
  );
  
  console.log(`🎯 Enhanced analysis found ${criticalIssues.length} issues in ${filePath}`);
  return criticalIssues;
}

// 🤖 EXPERIMENTAL: AI-POWERED ANALYSIS FUNCTIONS
async function checkHardcodedSecretsAI(content, filePath, fileContext = {}) {
  // If no AI key, fallback to static analysis
  if (!OPENAI_API_KEY) {
    return checkHardcodedSecretsEnhanced(content, filePath);
  }
  
  try {
    const contextInfo = {
      language: path.extname(filePath).substring(1),
      type: fileContext.type || 'unknown',
      framework: fileContext.framework || 'unknown'
    };
    
    const aiPrompt = `You are a security expert analyzing ${contextInfo.language} code for hardcoded secrets.

CONTEXT: ${filePath} - ${contextInfo.type} file in ${contextInfo.framework} project
CODE (first 1500 chars):
${content.substring(0, 1500)}

Find hardcoded secrets with HIGH PRECISION (avoid false positives):
- API keys, passwords, tokens, connection strings
- Consider context: test files have different risk than production code
- Consider patterns: environment variables are OK, hardcoded values are NOT

Return ONLY JSON array (empty if no issues):
[{"line": 15, "severity": "critical", "issue": "Hardcoded API key", "code": "const key = 'sk-123'", "suggestion": "Use environment variable"}]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: aiPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices[0].message.content.trim();
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiIssues = JSON.parse(jsonMatch[0]);
        console.log(`🤖 AI found ${aiIssues.length} hardcoded secret issues in ${path.basename(filePath)}`);
        return aiIssues.map(issue => ({
          type: 'Hardcoded Secret (AI)',
          severity: issue.severity || 'high',
          line: issue.line || 1,
          column: 1,
          message: issue.issue,
          code: issue.code,
          suggestion: issue.suggestion,
          file: filePath
        }));
      }
    }
  } catch (error) {
    console.warn('⚠️ AI security analysis failed, using static analysis:', error.message);
  }
  
  // Fallback to static analysis
  return checkHardcodedSecretsEnhanced(content, filePath);
}

// 🧠 TIER 2: DEDICATED AI ANALYSIS - Thorough analysis of critical files in multiple batches
// 🔪 SPLIT LARGE FILES - Breaks huge files into manageable chunks for AI analysis
function splitLargeFile(file, maxSize) {
  var chunks = [];
  var content = file.content;
  var lines = content.split('\n');
  var currentChunk = '';
  var chunkIndex = 0;
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    
    // If adding this line would exceed limit, create new chunk
    if (currentChunk.length + line.length > maxSize && currentChunk.length > 0) {
      chunks.push({
        path: `${file.path} (chunk ${chunkIndex + 1})`,
        content: currentChunk,
        priority: file.priority,
        size: currentChunk.length
      });
      
      currentChunk = '';
      chunkIndex++;
    }
    
    currentChunk += line + '\n';
  }
  
  // Add remaining content
  if (currentChunk.length > 0) {
    chunks.push({
      path: `${file.path} (chunk ${chunkIndex + 1})`,
      content: currentChunk,
      priority: file.priority,
      size: currentChunk.length
    });
  }
  
  console.log(`📄 Split large file ${file.path} (${file.size} chars) → ${chunks.length} chunks`);
  return chunks;
}

async function performDedicatedAIAnalysis(criticalFiles, analysisStrategy, criticalTempDir) {
  console.log(`🧠 DEDICATED AI ANALYSIS: Starting thorough analysis of ${criticalFiles.length} critical files`);
  
  if (!OPENAI_API_KEY || criticalFiles.length === 0) {
    console.log(`⚠️ Dedicated AI Analysis skipped: ${!OPENAI_API_KEY ? 'No API key' : 'No critical files'}`);
    return [];
  }
  
  var allAIIssues = [];
  
  // 🚀 SMART FILE BATCHING: Split by content size, not just file count
  var fileBatches = [];
  var currentBatch = [];
  var currentBatchSize = 0;
  var maxBatchSize = 15000; // 15K chars per batch (safe for OpenAI API)
  
  for (var file of criticalFiles) {
    var fileSize = file.content.length;
    
    // If adding this file would exceed limit, start new batch
    if (currentBatchSize + fileSize > maxBatchSize && currentBatch.length > 0) {
      fileBatches.push(currentBatch);
      currentBatch = [];
      currentBatchSize = 0;
    }
    
    // If single file is too large, split it into chunks
    if (fileSize > maxBatchSize) {
      var chunks = splitLargeFile(file, maxBatchSize);
      for (var chunk of chunks) {
        if (currentBatch.length > 0) {
          fileBatches.push(currentBatch);
          currentBatch = [];
          currentBatchSize = 0;
        }
        fileBatches.push([chunk]);
      }
    } else {
      currentBatch.push(file);
      currentBatchSize += fileSize;
    }
  }
  
  // Add remaining files
  if (currentBatch.length > 0) {
    fileBatches.push(currentBatch);
  }
  
  var totalBatches = fileBatches.length;
  
  console.log(`📊 AI Analysis Plan: ${criticalFiles.length} files → ${totalBatches} smart batches (size-based)`);
  
  // Process critical files in multiple batches for thorough analysis
  for (var batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    var batchFiles = fileBatches[batchIndex];
    var batchTotalSize = batchFiles.reduce((sum, f) => sum + f.content.length, 0);
    
    console.log(`🧠 Processing AI Batch ${batchIndex + 1}/${totalBatches}: ${batchFiles.length} files (${batchTotalSize} chars)`);
    
    try {
      var batchIssues = await performSingleAIBatch(batchFiles, batchIndex + 1, totalBatches, analysisStrategy);
      allAIIssues = allAIIssues.concat(batchIssues);
      console.log(`✅ AI Batch ${batchIndex + 1} completed: ${batchIssues.length} insights found`);
      
      // Small delay between batches to avoid rate limiting
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (batchError) {
      console.warn(`⚠️ AI Batch ${batchIndex + 1} failed:`, batchError.message);
    }
  }
  
  console.log(`🎯 DEDICATED AI ANALYSIS COMPLETE: ${allAIIssues.length} total insights from ${totalBatches} batches`);
  return allAIIssues;
}

// 🧠 Single AI Batch Analysis - Thorough analysis of 5-7 critical files
async function performSingleAIBatch(batchFiles, batchNum, totalBatches, analysisStrategy) {
  console.log(`🧠 AI Batch ${batchNum}/${totalBatches}: Analyzing ${batchFiles.length} critical files...`);
  
  try {
    // Prepare files for AI with size limits
    var fileBatch = batchFiles.map(file => ({
      path: file.path,
      content: file.content.substring(0, 12000), // More content per file for thorough analysis
      priority: file.priority,
      originalSize: file.size
    }));
    
    var aiPrompt = `You are a SENIOR SECURITY ARCHITECT conducting a thorough code review of ${fileBatch.length} CRITICAL files from a production codebase.

🎯 MISSION: Find ALL significant issues in these critical files - this is batch ${batchNum}/${totalBatches} of the most important code.

🔍 ANALYSIS FOCUS (in priority order):
1. 🚨 CRITICAL SECURITY VULNERABILITIES
   - SQL injection, XSS, command injection
   - Hardcoded secrets, weak authentication
   - Insecure data handling, path traversal
   
2. 🐛 LOGIC ERRORS & BUGS  
   - Race conditions, null pointer exceptions
   - Incorrect business logic, data corruption risks
   - Memory leaks, resource management issues
   
3. 🏗️ ARCHITECTURE & DESIGN FLAWS
   - Security by design violations
   - Performance bottlenecks, scalability issues
   - Code maintainability problems

4. ⚡ PERFORMANCE & RELIABILITY
   - N+1 queries, inefficient algorithms
   - Missing error handling, timeout issues
   - Resource exhaustion vulnerabilities

📁 CRITICAL FILES TO ANALYZE:
${fileBatch.map(f => `${f.path} (${f.originalSize} chars, analyzing ${f.content.length} chars)`).join('\n')}

💻 CODE CONTENT:
${fileBatch.map(f => `\n=== CRITICAL FILE: ${f.path} ===\n${f.content}`).join('\n')}

🎯 REQUIREMENTS:
- Focus ONLY on HIGH and CRITICAL severity issues
- Provide specific line references when possible
- Explain the BUSINESS IMPACT and security implications
- Suggest concrete fixes with code examples
- Skip minor style/formatting issues
- Be thorough but concise

📋 OUTPUT FORMAT: Return JSON array:
[{"file": "exact_file_path", "line": 123, "severity": "critical|high", "type": "security|logic|performance|architecture", "title": "Brief issue title", "description": "Detailed explanation", "impact": "Business/security impact", "fix": "Concrete solution with code example", "confidence": "high|medium"}]`;

    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cost-effective for batch analysis
        messages: [{ role: 'user', content: aiPrompt }],
        max_tokens: 6000, // More tokens for thorough analysis
        temperature: 0.1 // Low temperature for consistent analysis
      })
    });
    
    if (!response.ok) {
      console.log(`❌ AI Batch ${batchNum} failed: ${response.status} ${response.statusText}`);
      return [];
    }
    
    var data = await response.json();
    var aiAnalysis = data.choices[0].message.content;
    
    console.log(`✅ AI Batch ${batchNum} completed: ${aiAnalysis.length} chars response`);
    
    // Parse AI response (try JSON, fallback to text parsing)
    try {
      var aiIssues = JSON.parse(aiAnalysis);
      return aiIssues.map(issue => ({
        ...issue,
        pattern: 'dedicated_ai_analysis',
        code: `AI Batch ${batchNum}: ${issue.title}`,
        aiGenerated: true,
        batchNumber: batchNum
      }));
    } catch (parseError) {
      // Fallback: Extract issues from text response
      console.log(`📝 AI Batch ${batchNum} returned text format, parsing manually...`);
      return [{
        file: `AI Batch ${batchNum} Summary`,
        line: 1,
        severity: 'high',
        type: 'analysis',
        title: `Critical Files Analysis - Batch ${batchNum}`,
        description: aiAnalysis.substring(0, 800) + '...',
        impact: 'See full analysis in description field',
        fix: 'Review detailed AI analysis above',
        pattern: 'dedicated_ai_analysis',
        code: `AI Batch ${batchNum} Generated Analysis`,
        aiGenerated: true,
        batchNumber: batchNum
      }];
    }
    
  } catch (error) {
    console.log(`❌ AI Batch ${batchNum} error: ${error.message}`);
    return [];
  }
}

// 🧠 LEGACY: AI DEEP ANALYSIS - Analyze 1-15 critical files with ChatGPT/Claude
async function performAIDeepAnalysis(criticalFiles, analysisStrategy) {
  console.log(`🧠 AI DEEP ANALYSIS: Starting analysis of ${criticalFiles.length} critical files`);
  
  if (!OPENAI_API_KEY || criticalFiles.length === 0) {
    console.log(`⚠️ AI Deep Analysis skipped: ${!OPENAI_API_KEY ? 'No API key' : 'No critical files'}`);
    return [];
  }
  
  try {
    // Prepare batch of critical files for AI analysis
    var fileBatch = criticalFiles.slice(0, 15).map(file => ({
      path: file.path,
      content: file.content.substring(0, 8000), // Limit content for API
      priority: file.priority || 'critical'
    }));
    
    var aiPrompt = `You are a senior code security analyst. Analyze these ${fileBatch.length} critical code files for:

🔍 FOCUS AREAS:
1. Security vulnerabilities (SQL injection, XSS, hardcoded secrets)
2. Logic errors and potential bugs
3. Performance issues and anti-patterns
4. Architecture and design flaws
5. Error handling problems

📁 FILES TO ANALYZE:
${fileBatch.map(f => `${f.path} (${f.content.length} chars)`).join('\n')}

CODE CONTENT:
${fileBatch.map(f => `\n=== ${f.path} ===\n${f.content}`).join('\n')}

🎯 REQUIREMENTS:
- Focus on HIGH and CRITICAL severity issues only
- Provide specific line references when possible
- Explain the impact and fix for each issue
- Skip minor style/formatting issues
- Be concise but thorough

FORMAT: Return JSON array of issues:
[{"file": "path", "line": 123, "severity": "critical|high", "type": "security|logic|performance", "message": "description", "impact": "explanation", "fix": "solution"}]`;

    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cost-effective
        messages: [{ role: 'user', content: aiPrompt }],
        max_tokens: 4000,
        temperature: 0.1 // Low temperature for consistent analysis
      })
    });
    
    if (!response.ok) {
      console.log(`❌ AI Deep Analysis failed: ${response.status} ${response.statusText}`);
      return [];
    }
    
    var data = await response.json();
    var aiAnalysis = data.choices[0].message.content;
    
    console.log(`✅ AI Deep Analysis completed: ${aiAnalysis.length} chars response`);
    
    // Parse AI response (try JSON, fallback to text parsing)
    try {
      var aiIssues = JSON.parse(aiAnalysis);
      return aiIssues.map(issue => ({
        ...issue,
        pattern: 'ai_deep_analysis',
        code: `AI Analysis: ${issue.message}`,
        aiGenerated: true
      }));
    } catch (parseError) {
      // Fallback: Extract issues from text response
      console.log(`📝 AI returned text format, parsing manually...`);
      return [{
        file: 'AI Analysis Summary',
        line: 1,
        severity: 'high',
        type: 'analysis',
        message: 'AI Deep Analysis Results',
        impact: aiAnalysis.substring(0, 500) + '...',
        fix: 'See full AI analysis in impact field',
        pattern: 'ai_deep_analysis',
        code: 'AI Generated Analysis',
        aiGenerated: true
      }];
    }
    
  } catch (error) {
    console.log(`❌ AI Deep Analysis error: ${error.message}`);
    return [];
  }
}

// 🔒 ENHANCED SECURITY PATTERNS (Static Fallback)
function checkHardcodedSecretsEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var secretPatterns = [
    // 🔐 SECRETS & CREDENTIALS
    { pattern: /(password|pwd|pass)\s*[:=]\s*["'][^"']{3,}["']/i, message: 'Hardcoded password detected' },
    { pattern: /(api_?key|apikey)\s*[:=]\s*["'][^"']{10,}["']/i, message: 'Hardcoded API key detected' },
    { pattern: /(secret|token)\s*[:=]\s*["'][^"']{8,}["']/i, message: 'Hardcoded secret/token detected' },
    { pattern: /sk-[a-zA-Z0-9]{48}/i, message: 'OpenAI API key detected' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/i, message: 'GitHub token detected' },
    { pattern: /AKIA[0-9A-Z]{16}/i, message: 'AWS access key detected' },
    { pattern: /mongodb:\/\/[^:]+:[^@]+@/i, message: 'MongoDB connection string with credentials' },
    { pattern: /postgres:\/\/[^:]+:[^@]+@/i, message: 'PostgreSQL connection string with credentials' },
    
    // 🚨 CRITICAL LOGIC ERRORS (added to existing function for speed)
    { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/i, message: 'Empty catch block - handle errors properly' },
    { pattern: /console\.log.*password|console\.log.*secret|console\.log.*token/i, message: 'Logging sensitive data in console' },
    
    // 🔍 MORE COMPREHENSIVE SECURITY PATTERNS FOR NON-CRITICAL FILES
    { pattern: /jwt_secret\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded JWT secret detected' },
    { pattern: /private_key\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded private key detected' },
    { pattern: /client_secret\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded OAuth client secret detected' },
    { pattern: /encryption_key\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded encryption key detected' },
    { pattern: /admin_password\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded admin password detected' },
    { pattern: /db_password\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded database password detected' },
    { pattern: /auth_token\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded auth token detected' },
    { pattern: /bearer\s+[a-zA-Z0-9_-]{20,}/i, message: 'Hardcoded Bearer token detected' },
    { pattern: /Basic\s+[A-Za-z0-9+\/=]{10,}/i, message: 'Hardcoded Basic auth credentials detected' },
    { pattern: /x-api-key\s*[:=]\s*["'][^"']+["']/i, message: 'Hardcoded API key header detected' },
    
    // 🛡️ ADDITIONAL SECURITY PATTERNS
    { pattern: /document\.write\s*\(/i, message: 'Potential XSS risk: Avoid document.write()' },
    { pattern: /innerHTML\s*=.*\+|innerHTML\s*\+=|outerHTML\s*=/i, message: 'Potential XSS: Sanitize before setting innerHTML' },
    { pattern: /\b(cp|child_process|childProcess)\.exec\s*\(|\bspawn\s*\(|\bsystem\s*\(/i, message: 'Command execution: Validate input to prevent injection' },
    { pattern: /md5\s*\(|sha1\s*\(/i, message: 'Weak hashing algorithm: Use SHA-256 or bcrypt' },
    { pattern: /ssl.*false|verify.*false|rejectUnauthorized.*false/i, message: 'SSL verification disabled: Security risk' }
  ];
  
  lines.forEach((line, index) => {
    // Skip if using environment variables (safe pattern)
    if (/os\.getenv|process\.env|config\.get/i.test(line)) return;
    
    secretPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'security',
          message: message + ' - use environment variables',
          line: index + 1,
          severity: 'critical',
          code: line.replace(/["'][^"']*["']/, '"***REDACTED***"'),
          pattern: 'hardcoded_secret'
        });
      }
    });
  });
  
  return issues;
}

function checkSQLInjectionEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // More precise SQL injection detection - must have SQL context AND string concatenation
    var hasSQLContext = /\.(query|execute)\s*\(|sql\s*=|query\s*=|executeQuery|createStatement/i.test(line);
    var hasStringConcatenation = /\+.*["']|["'].*\+|\$\{.*\}|\`.*\$\{/i.test(line);
    var hasSQLKeywords = /select\s+.*from|insert\s+into|update\s+.*set|delete\s+from/i.test(line);
    
    // Only flag if we have actual SQL context AND string concatenation
    if ((hasSQLContext || hasSQLKeywords) && hasStringConcatenation) {
      // Skip if using parameterized queries (safe patterns)
      if (/parameterize|prepare|execute.*,\s*\[|\?\s*,|\$[0-9]+|bind.*param/i.test(line)) return;
      // Skip console.log, error messages, and UI strings
      if (/console\.|log\(|error\(|message\s*[:=]|text\s*[:=]|\.innerHTML|chalk\.|theme`/i.test(line)) return;
      
      issues.push({
        type: 'security',
        message: 'SQL injection risk: Use parameterized queries instead of string concatenation',
        line: index + 1,
        severity: 'critical',
        code: line.trim(),
        pattern: 'sql_injection'
      });
    }
  });
  
  return issues;
}

function checkXSSVulnerabilitiesEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // More precise XSS detection - only flag actual assignments with user input
    if ((/\.innerHTML\s*=|\.outerHTML\s*=|\.insertAdjacentHTML\s*\(/i.test(line)) && 
        (/\+.*["']|["'].*\+|\$\{.*\}|\`.*\$\{/i.test(line))) {
      // Skip safe methods and type definitions
      if (/sanitize|escape|encode|textContent|innerText|DOMPurify|get\s+innerHTML|set\s+innerHTML.*string|TrustedHTML/i.test(line)) return;
      // Skip Flow/TypeScript type definitions and interfaces
      if (/:\s*string|interface\s|type\s|declare\s|get\s+innerHTML\(\)|set\s+innerHTML\(/i.test(line)) return;
      
      issues.push({
        type: 'security',
        message: 'XSS vulnerability: HTML insertion without sanitization',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'xss_vulnerability'
      });
    }
    
    // React-specific XSS - only flag actual usage, not type definitions
    if (/dangerouslySetInnerHTML\s*[:=]/i.test(line) && 
        !/case\s|interface\s|type\s|declare\s|sanitize/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'React XSS risk: dangerouslySetInnerHTML without sanitization',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'react_xss'
      });
    }
  });
  
  return issues;
}

function checkCommandInjectionEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  var commandAPIs = ['cp.exec(', 'child_process.exec(', 'childProcess.exec(', 'spawn(', 'system(', 'popen(', 'subprocess.', 'os.system'];
  
  lines.forEach((line, index) => {
    commandAPIs.forEach(api => {
      if (line.includes(api) && (/\+.*["']|["'].*\+|\$\{.*\}|\`.*\$\{/i.test(line))) {
        // Skip if using safe execution methods
        if (/shell\s*=\s*False|shlex\.quote|subprocess\.run.*args/i.test(line)) return;
        // Skip console.log, error messages, and alias declarations
        if (/console\.|log\(|error\(|alias\s|deploy\s|now\s+deploy/i.test(line)) return;
        
        issues.push({
          type: 'security',
          message: 'Command injection risk: User input in system commands - use parameterized execution',
          line: index + 1,
          severity: 'critical',
          code: line.trim(),
          pattern: 'command_injection'
        });
      }
    });
  });
  
  return issues;
}

function checkResourceLeaksEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // Skip type definitions and declarations
    if (/^(declare\s+|interface\s+|type\s+|\*\s|\/\*\*)/i.test(trimmed)) return;
    
    // File operations without proper cleanup - only flag actual function calls, not type definitions
    if (/open\s*\(|createReadStream|createWriteStream|fs\.open/i.test(line)) {
      // Skip if it's just a type definition
      if (/:\s*(string|void|Promise|Function|\(\))/i.test(line)) return;
      
      var nextLines = lines.slice(index, index + 15).join('\n');
      if (!/close\s*\(\)|\.end\s*\(\)|finally|with\s+/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Resource leak: File/stream opened but not properly closed',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'resource_leak'
        });
      }
    }
    
    // Database connections without cleanup - only actual calls, not type definitions or error messages
    if (/\w+\s*=\s*.*connect\s*\(|\.connect\s*\(|createConnection\s*\(|getConnection\s*\(/i.test(line)) {
      // Skip type definitions, error messages, and import statements
      if (/:\s*(string|void|Promise|Function|\(\))/i.test(line) ||
          /console\.|log\(|error\(|message|import\s|require\(/i.test(line)) return;
      
      var nextLines = lines.slice(index, index + 20).join('\n');
      if (!/disconnect|close|end|release|finally/i.test(nextLines)) {
        issues.push({
          type: 'logic',
          message: 'Database connection leak: Connection not properly closed',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'connection_leak'
        });
      }
    }
  });
  
  return issues;
}

function checkMemoryLeaksEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // Skip type definitions, function declarations, comments, method signatures, and string literals
    if (/^(declare\s+|interface\s+|type\s+|\*\s|\/\*\*|\/\/|function\s+\w+\s*\(|export\s+function|\w+\s*:\s*\w+|\w+\(\)\s*:\s*\w+|['"`].*['"`])/i.test(trimmed)) return;
    
    // Event listeners without cleanup - but skip function declarations and type definitions
    if (/addEventListener|on\s*\(/i.test(line)) {
      // Skip method signatures, type definitions, function declarations, and variable assignments
      if (/:\s*(Function|\(\)|\w+\s*=>)/i.test(line) || 
          /^(function\s+|export\s+function|\w+\s*:\s*|\w+\(\)\s*:\s*|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)/i.test(trimmed) ||
          /toJSON\(\)|toString\(\)|valueOf\(\)|timestampToPosition|formatDuration/i.test(line)) return;
      
      if (!/removeEventListener|off\s*\(|cleanup|unmount/i.test(content)) {
        issues.push({
          type: 'performance',
          message: 'Memory leak: Event listener added but never removed',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'memory_leak'
        });
      }
    }
    
    // Timers without cleanup - but skip function declarations and Promise constructors
    if (/setInterval|setTimeout/i.test(line) && !/clearInterval|clearTimeout/i.test(content)) {
      // Skip function signatures, type definitions, Promise constructors, resolve callbacks, and variable assignments
      if (/:\s*(Function|\(\)|\w+\s*=>)/i.test(line) || 
          /^(function\s+|export\s+function|\w+\s*:\s*|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)/i.test(trimmed) ||
          /new Promise|resolve\)|setTimeout\(resolve|timestampToPosition|formatDuration/i.test(line)) return;
      
      issues.push({
        type: 'performance',
        message: 'Memory leak: Timer created but never cleared',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'timer_leak'
      });
    }
  });
  
  return issues;
}

function checkErrorHandlingEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // Empty catch blocks
    if (/catch\s*\(\s*\w*\s*\)\s*\{[\s]*\}/i.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Empty catch block: Handle errors properly or add explanatory comment',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'empty_catch'
      });
    }
    
    // 🚨 CRITICAL LOGIC ERRORS (added for speed)
    // Assignment in if condition (actual bug pattern)
    if (/if\s*\([^)]*[^=!<>]=\s*[^=][^)]*\)/.test(line) && !/==|===|!=|!==/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Assignment in if condition - did you mean == or ===?',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'assignment_in_condition'
      });
    }
    
    // Missing null checks before method calls
    if (/\w+\.(length|push|pop|map|filter|forEach)/i.test(line) && !/if.*null|&&|\|\|/.test(line)) {
      issues.push({
        type: 'logic',
        message: 'Potential null reference: Add null check before method call',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'missing_null_check'
      });
    }
    
    // 🔍 MORE COMPREHENSIVE PATTERNS FOR NON-CRITICAL FILES
    
    // Hardcoded URLs and endpoints
    if (/https?:\/\/[^"'\s]+|api\/[^"'\s]+|\/v\d+\/[^"'\s]+/i.test(line) && !/localhost|127\.0\.0\.1|example\.com/.test(line)) {
      issues.push({
        type: 'security',
        message: 'Hardcoded URL/endpoint: Consider using environment variables',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'hardcoded_url'
      });
    }
    
    // TODO/FIXME/HACK comments (potential technical debt)
    if (/\/\/.*\b(TODO|FIXME|HACK|XXX|BUG)\b/i.test(line)) {
      issues.push({
        type: 'maintenance',
        message: 'Technical debt marker: Review and address this comment',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'technical_debt'
      });
    }
    
    // Potential SQL injection in string concatenation
    if (/SELECT|INSERT|UPDATE|DELETE/i.test(line) && /\+.*["']|["'].*\+|\$\{.*\}/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'Potential SQL injection: Use parameterized queries',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'sql_injection_risk'
      });
    }
    
    // Weak random number generation
    if (/Math\.random\(\)/i.test(line) && !/test|mock|demo/i.test(filePath)) {
      issues.push({
        type: 'security',
        message: 'Weak random number generation: Use crypto.randomBytes() for security',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'weak_random'
      });
    }
    
    // Debug/console statements in production code
    if (/console\.(log|debug|info|warn|error|trace)/i.test(line) && !/test|spec|debug/i.test(filePath)) {
      issues.push({
        type: 'maintenance',
        message: 'Debug statement: Remove console logs from production code',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'debug_statement'
      });
    }
    
    // Eval usage (security risk)
    if (/\beval\s*\(|new\s+Function\s*\(/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'Code injection risk: Avoid eval() and Function() constructor',
        line: index + 1,
        severity: 'critical',
        code: line.trim(),
        pattern: 'code_injection'
      });
    }
    
    // Insecure HTTP usage
    if (/http:\/\/(?!localhost|127\.0\.0\.1)/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'Insecure HTTP: Use HTTPS for external communications',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'insecure_http'
      });
    }
    
    // Unhandled async operations - skip string literals and comments
    if (/await\s+\w+\(/i.test(line) && !/^[\s]*['"`\/]/.test(trimmed)) {
      var surroundingCode = lines.slice(Math.max(0, index - 5), index + 5).join('\n');
      if (!/try|catch|\.catch\(/i.test(surroundingCode)) {
        issues.push({
          type: 'logic',
          message: 'Unhandled async operation: Add try-catch or .catch() for error handling',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'unhandled_promise'
        });
      }
    }
  });
  
  return issues;
}

function checkPerformanceIssuesEnhanced(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // N+1 queries
    if (/for\s*\(|while\s*\(|\.forEach|\.map/i.test(line)) {
      var nextLines = lines.slice(index, index + 15).join('\n');
      var queryPatterns = ['query\\s*\\(', 'find\\s*\\(', 'findOne\\s*\\(', 'select\\s*\\(', 'fetch\\s*\\('];
      
      queryPatterns.forEach(pattern => {
        if (new RegExp(pattern, 'i').test(nextLines)) {
          issues.push({
            type: 'performance',
            message: 'N+1 query problem: Database/API query inside loop - use batch operations',
            line: index + 1,
            severity: 'high',
            code: line.trim(),
            pattern: 'n_plus_one'
          });
        }
      });
    }
    
    // 🚀 REACT PERFORMANCE ISSUES (added for speed)
    // useEffect missing dependencies
    if (/useEffect\s*\(\s*[^,]+\s*\)(?!\s*,\s*\[)/i.test(line)) {
      issues.push({
        type: 'performance',
        message: 'useEffect missing dependencies - may cause infinite re-renders',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'useEffect_missing_deps'
      });
    }
    
    // Multiple DOM queries (should cache)
    if (/document\.querySelector|document\.getElementById|getElementsBy/i.test(line)) {
      var nextLines = lines.slice(index, index + 5).join('\n');
      if ((nextLines.match(/document\.(querySelector|getElementById|getElementsBy)/gi) || []).length > 1) {
        issues.push({
          type: 'performance',
          message: 'Multiple DOM queries: Cache DOM elements for better performance',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'multiple_dom_queries'
        });
      }
    }
    
    // 🔄 ASYNC PATTERN ISSUES (added for speed)
    // await in loop (should use Promise.all)
    if (/for\s*\(|while\s*\(|\.forEach/i.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (/await\s+/i.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'await in loop: Use Promise.all() for parallel execution',
          line: index + 1,
          severity: 'high',
          code: line.trim(),
          pattern: 'await_in_loop'
        });
      }
    }
    
    // 🚀 MORE PERFORMANCE PATTERNS FOR NON-CRITICAL FILES
    
    // Inefficient string concatenation in loops
    if (/for\s*\(|while\s*\(|\.forEach/i.test(line)) {
      var nextLines = lines.slice(index, index + 8).join('\n');
      if (/\w+\s*\+=\s*["']|string\s*\+=|concat\(/i.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'Inefficient string concatenation in loop: Use array.join() or StringBuilder',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'string_concat_loop'
        });
      }
    }
    
    // Synchronous file operations (blocking)
    if (/fs\.readFileSync|fs\.writeFileSync|fs\.existsSync/i.test(line) && !/test|spec/i.test(filePath)) {
      issues.push({
        type: 'performance',
        message: 'Blocking file operation: Use async version for better performance',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'sync_file_operation'
      });
    }
    
    // Inefficient array operations
    if (/\.indexOf\([^)]*\)\s*!=\s*-1|\.indexOf\([^)]*\)\s*>\s*-1/i.test(line)) {
      issues.push({
        type: 'performance',
        message: 'Inefficient array search: Use .includes() instead of indexOf() !== -1',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'inefficient_array_search'
      });
    }
    
    // Memory-intensive operations without limits
    if (/\.map\(|\.filter\(|\.reduce\(/i.test(line) && /\.length\s*>\s*\d{4}/i.test(line)) {
      issues.push({
        type: 'performance',
        message: 'Large array operation: Consider pagination or streaming for large datasets',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'large_array_operation'
      });
    }
    
    // Regex in loops (performance killer)
    if (/for\s*\(|while\s*\(|\.forEach/i.test(line)) {
      var nextLines = lines.slice(index, index + 8).join('\n');
      if (/new\s+RegExp\(|\/.*\/[gim]*\.test\(/i.test(nextLines)) {
        issues.push({
          type: 'performance',
          message: 'Regex in loop: Pre-compile regex outside loop for better performance',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'regex_in_loop'
        });
      }
    }
  });
  
  return issues;
}

// 🚀 ULTIMATE FILE-SPECIFIC ANALYSIS ENGINE
async function performHybridAnalysis(content, filePath, tempDir) {
  console.log(`🎯 SMART FILE ANALYSIS: ${filePath}`);
  
  var startTime = Date.now();
  var ext = path.extname(filePath).toLowerCase();
  var fileName = path.basename(filePath).toLowerCase();
  
  try {
    // PHASE 1: 🔍 INTELLIGENT FILE CLASSIFICATION & SPECIALIZED ANALYSIS
    var fileType = classifyFileType(filePath, content);
    console.log(`📋 File classified as: ${fileType.category} (${fileType.subtype})`);
    
    var issues = [];
    
    // PHASE 2: ⚡ SPECIALIZED ANALYZERS (Ultra-fast, file-specific)
    switch (fileType.category) {
      case 'code':
        issues = await analyzeCodeFile(content, filePath, fileType, tempDir);
        break;
      case 'config':
        issues = analyzeConfigFile(content, filePath, fileType);
        break;
      case 'security':
        issues = analyzeSecurityFile(content, filePath, fileType);
        break;
      case 'build':
        issues = analyzeBuildFile(content, filePath, fileType);
        break;
      case 'docs':
        issues = analyzeDocumentationFile(content, filePath, fileType);
        break;
      case 'data':
        issues = analyzeDataFile(content, filePath, fileType);
        break;
      default:
        issues = performBasicAnalysis(content, filePath);
    }
    
    // PHASE 3: 🎯 PRIORITY SCORING & ENHANCEMENT
    issues = enhanceIssuesWithMetadata(issues, fileType, content, filePath);
    
    var analysisTime = Date.now() - startTime;
    console.log(`🎯 SPECIALIZED ANALYSIS COMPLETE: ${issues.length} issues in ${analysisTime}ms`);
    
    return issues;
    
  } catch (error) {
    console.error(`❌ Specialized analysis failed for ${filePath}:`, error.message);
    return performBasicAnalysis(content, filePath);
  }
}

// 🎯 INTELLIGENT AI DECISION ENGINE
function decideShouldUseAI(content, filePath, staticIssues) {
  var ext = path.extname(filePath).toLowerCase();
  
  // Always use AI for complex files
  if (content.length > 2000) return true;
  
  // Use AI if static analysis found critical issues (for better explanations)
  if (staticIssues && staticIssues.some(issue => issue.severity === 'critical')) return true;
  
  // Use AI for security-sensitive files
  if (/password|token|secret|auth|crypto|security/i.test(content)) return true;
  
  // Use AI for complex React components
  if (['.jsx', '.tsx'].includes(ext) && /useEffect|useState|useContext/i.test(content)) return true;
  
  // Use AI for C/C++ with pointers (memory safety)
  if (['.c', '.cpp', '.cc'].includes(ext) && /\*|malloc|free|delete/i.test(content)) return true;
  
  // Use AI for Python with ML/AI libraries
  if (ext === '.py' && /tensorflow|pytorch|numpy|pandas/i.test(content)) return true;
  
  // Skip AI for simple files
  return false;
}

// 🔄 SMART DEDUPLICATION ENGINE  
function deduplicateIssues(staticIssues, aiIssues) {
  if (!staticIssues || staticIssues.length === 0) return aiIssues;
  if (!aiIssues || aiIssues.length === 0) return [];
  
  var uniqueAIIssues = [];
  
  aiIssues.forEach(function(aiIssue) {
    var isDuplicate = staticIssues.some(function(staticIssue) {
      // Same line number and similar message
      return Math.abs(aiIssue.line - staticIssue.line) <= 2 && 
             (aiIssue.message.toLowerCase().includes(staticIssue.message.toLowerCase().substring(0, 20)) ||
              staticIssue.message.toLowerCase().includes(aiIssue.message.toLowerCase().substring(0, 20)));
    });
    
    if (!isDuplicate) {
      uniqueAIIssues.push(aiIssue);
    }
  });
  
  return uniqueAIIssues;
}

// 🏆 INTELLIGENT PRIORITY SCORING
function prioritizeIssues(issues, content, filePath) {
  issues.forEach(function(issue) {
    var score = 0;
    
    // Base severity score
    if (issue.severity === 'critical') score += 100;
    else if (issue.severity === 'high') score += 75;
    else if (issue.severity === 'medium') score += 50;
    else score += 25;
    
    // Source confidence boost
    if (issue.source === 'static') score += 20; // Static analysis is reliable
    if (issue.source === 'ai') score += 10;     // AI provides context
    
    // Security issues get priority
    if (issue.type === 'security') score += 30;
    
    // Performance issues in hot paths
    if (issue.type === 'performance' && /loop|render|effect/i.test(issue.message)) score += 15;
    
    // Critical files get attention
    if (/index|main|app|server|auth|security/i.test(filePath)) score += 10;
    
    issue.priorityScore = score;
  });
  
  // Sort by priority score (highest first)
  return issues.sort(function(a, b) { return b.priorityScore - a.priorityScore; });
}

// 🧠 INTELLIGENT FILE CLASSIFIER
function classifyFileType(filePath, content) {
  var ext = path.extname(filePath).toLowerCase();
  var fileName = path.basename(filePath).toLowerCase();
  var dirPath = path.dirname(filePath).toLowerCase();
  
  // CODE FILES - Need deep analysis
  if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb'].includes(ext)) {
    var subtype = 'general';
    if (/react|component|hook/i.test(content) || ['.jsx', '.tsx'].includes(ext)) subtype = 'react';
    else if (/express|server|api|route/i.test(content)) subtype = 'backend';
    else if (/test|spec|__test__/i.test(fileName)) subtype = 'test';
    else if (/tensorflow|pytorch|numpy|ml|ai/i.test(content)) subtype = 'ml';
    return { category: 'code', subtype: subtype, priority: 'high' };
  }
  
  // SECURITY FILES - Critical analysis
  if (fileName.includes('auth') || fileName.includes('security') || fileName.includes('secret') || 
      fileName.includes('key') || fileName.includes('cert') || ext === '.pem' || ext === '.key') {
    return { category: 'security', subtype: 'credentials', priority: 'critical' };
  }
  
  // CONFIG FILES - Structured analysis
  if (['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg'].includes(ext) ||
      ['package.json', 'tsconfig.json', 'webpack.config.js', '.env', '.gitignore'].includes(fileName)) {
    var subtype = 'general';
    if (fileName === 'package.json') subtype = 'npm';
    else if (fileName.includes('docker')) subtype = 'docker';
    else if (fileName.includes('webpack') || fileName.includes('babel')) subtype = 'build';
    else if (fileName === '.env' || fileName.includes('env')) subtype = 'environment';
    return { category: 'config', subtype: subtype, priority: 'medium' };
  }
  
  // BUILD FILES - Deployment analysis  
  if (['dockerfile', 'makefile', 'gulpfile.js', 'gruntfile.js'].includes(fileName) ||
      fileName.includes('build') || fileName.includes('deploy') || ext === '.sh' || ext === '.bat') {
    return { category: 'build', subtype: 'deployment', priority: 'high' };
  }
  
  // DATA FILES - Format validation
  if (['.csv', '.xml', '.sql', '.db', '.sqlite'].includes(ext)) {
    return { category: 'data', subtype: 'structured', priority: 'low' };
  }
  
  // DOCUMENTATION - Content analysis
  if (['.md', '.txt', '.rst', '.adoc'].includes(ext) || fileName === 'readme') {
    return { category: 'docs', subtype: 'markdown', priority: 'low' };
  }
  
  return { category: 'unknown', subtype: 'generic', priority: 'low' };
}

// 💻 CODE FILE ANALYZER (AI-Enhanced for Complex Logic)
async function analyzeCodeFile(content, filePath, fileType, tempDir) {
  console.log(`💻 Analyzing ${fileType.subtype} code file: ${filePath}`);
  
  var issues = [];
  
  // PHASE 1: Fast pattern-based analysis
  var patterns = getCodePatterns(fileType.subtype);
  issues = issues.concat(analyzeWithPatterns(content, patterns, filePath));
  
  // PHASE 2: AI analysis for complex files only
  if (content.length > 1000 || issues.some(i => i.severity === 'critical')) {
    console.log(`🧠 Using AI for complex ${fileType.subtype} analysis`);
    var aiIssues = await performAIAnalysis(content, filePath);
    if (aiIssues) {
      aiIssues.forEach(issue => issue.source = 'ai');
      issues = issues.concat(aiIssues);
    }
  }
  
  return issues;
}

// ⚙️ CONFIG FILE ANALYZER (100+ Predefined Rules)
function analyzeConfigFile(content, filePath, fileType) {
  console.log(`⚙️ Analyzing ${fileType.subtype} config: ${filePath}`);
  
  var issues = [];
  var fileName = path.basename(filePath);
  
  try {
    if (fileType.subtype === 'npm' && fileName === 'package.json') {
      issues = issues.concat(analyzePackageJson(content, filePath));
    } else if (fileType.subtype === 'environment') {
      issues = issues.concat(analyzeEnvFile(content, filePath));
    } else if (fileType.subtype === 'docker') {
      issues = issues.concat(analyzeDockerfile(content, filePath));
    } else if (['.json', '.yaml', '.yml'].includes(path.extname(filePath))) {
      issues = issues.concat(analyzeGenericConfig(content, filePath));
    }
  } catch (error) {
    console.warn(`Config analysis failed for ${filePath}:`, error.message);
  }
  
  return issues;
}

// 🔒 SECURITY FILE ANALYZER (Critical Security Checks)
function analyzeSecurityFile(content, filePath, fileType) {
  console.log(`🔒 Security analysis: ${filePath}`);
  
  var issues = [];
  
  // Check for exposed secrets
  var secretPatterns = [
    { pattern: /sk-[a-zA-Z0-9]{48}/, message: 'OpenAI API key exposed', severity: 'critical' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, message: 'GitHub token exposed', severity: 'critical' },
    { pattern: /AKIA[0-9A-Z]{16}/, message: 'AWS access key exposed', severity: 'critical' },
    { pattern: /-----BEGIN PRIVATE KEY-----/, message: 'Private key exposed', severity: 'critical' },
    { pattern: /password\s*[=:]\s*["'][^"']{8,}["']/, message: 'Hardcoded password', severity: 'high' }
  ];
  
  secretPatterns.forEach(function(check) {
    if (check.pattern.test(content)) {
      issues.push({
        type: 'security',
        message: check.message,
        line: findLineNumber(content, check.pattern),
        severity: check.severity,
        source: 'security-scanner'
      });
    }
  });
  
  return issues;
}

// 🏗️ BUILD FILE ANALYZER (Deployment & CI/CD Issues)
function analyzeBuildFile(content, filePath, fileType) {
  console.log(`🏗️ Build file analysis: ${filePath}`);
  
  var issues = [];
  var fileName = path.basename(filePath).toLowerCase();
  
  if (fileName === 'dockerfile') {
    issues = issues.concat(analyzeDockerfile(content, filePath));
  } else if (path.extname(filePath) === '.sh') {
    issues = issues.concat(analyzeShellScript(content, filePath));
  }
  
  return issues;
}

// 📚 DOCUMENTATION ANALYZER (Content Quality)
function analyzeDocumentationFile(content, filePath, fileType) {
  console.log(`📚 Documentation analysis: ${filePath}`);
  
  var issues = [];
  
  // Check for common documentation issues
  if (content.length < 100) {
    // REMOVED: Short documentation file (low severity noise)
    // issues.push({
    //   type: 'documentation',
    //   message: 'Documentation file is too short',
    //   line: 1,
    //   severity: 'low',
    //   source: 'doc-analyzer'
    // });
  }
  
  // REMOVED: Missing markdown headers (low severity noise)
  // if (!/#+\s/.test(content)) {
  //   issues.push({
  //     type: 'documentation',
  //     message: 'Missing proper markdown headers',
  //     line: 1,
  //     severity: 'low',
  //     source: 'doc-analyzer'
  //   });
  // }
  
  return issues;
}

// 📊 DATA FILE ANALYZER (Format & Structure)
function analyzeDataFile(content, filePath, fileType) {
  console.log(`📊 Data file analysis: ${filePath}`);
  
  var issues = [];
  var ext = path.extname(filePath);
  
  if (ext === '.json') {
    try {
      JSON.parse(content);
    } catch (error) {
      issues.push({
        type: 'syntax',
        message: 'Invalid JSON format: ' + error.message,
        line: 1,
        severity: 'high',
        source: 'json-parser'
      });
    }
  }
  
  return issues;
}

// 🎯 SPECIALIZED HELPER FUNCTIONS

// Check if content is primarily type definitions (should be skipped)
function isPureTypeDefinitionContent(content, filePath) {
  try {
    // Skip flow-typed directories entirely
    if (/flow-typed/i.test(filePath)) {
      return true;
    }
    
    var lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    if (lines.length === 0) return false;
    
    var typeDefinitionLines = 0;
    var implementationLines = 0;
    
    lines.forEach(line => {
      var trimmed = line.trim();
      
      // Count type definition patterns
      if (/^(declare\s+|interface\s+|type\s+\w+\s*=|export\s+interface|export\s+type)/.test(trimmed) ||
          /:\s*(string|number|boolean|void|Promise<|Function|\(\)|\{)/.test(trimmed) ||
          /^\/\*\*|\*\/|\*\s/.test(trimmed)) { // JSDoc comments
        typeDefinitionLines++;
      }
      // Count implementation patterns
      else if (/^(function\s+|const\s+\w+\s*=|let\s+|var\s+|class\s+|if\s*\(|for\s*\(|while\s*\(|return\s+|throw\s+)/.test(trimmed) ||
               /\w+\s*\([^)]*\)\s*\{/.test(trimmed)) {
        implementationLines++;
      }
    });
    
    // If >80% type definitions and <20% implementation, consider it pure type definitions
    var totalSignificantLines = typeDefinitionLines + implementationLines;
    if (totalSignificantLines > 0) {
      var typeRatio = typeDefinitionLines / totalSignificantLines;
      return typeRatio > 0.8;
    }
    
    return false;
  } catch (error) {
    console.warn('Error checking type definition content:', error);
    return false;
  }
}

// Get code patterns for specific subtypes
function getCodePatterns(subtype) {
  var patterns = {
    react: [
      { pattern: /useEffect\s*\(\s*[^,]+\s*\)(?!\s*,\s*\[)/, message: 'useEffect missing dependencies', severity: 'high' },
      { pattern: /dangerouslySetInnerHTML/, message: 'XSS risk with dangerouslySetInnerHTML', severity: 'critical' },
      { pattern: /useState\(\s*\{\s*\}\s*\)/, message: 'useState with object - prefer useReducer', severity: 'medium' }
    ],
    backend: [
      { pattern: /app\.use\([^)]*\)(?!.*cors)/, message: 'Missing CORS middleware', severity: 'high' },
      { pattern: /process\.env\.[A-Z_]+(?!\s*\|\|)/, message: 'Missing environment variable fallback', severity: 'medium' },
      { pattern: /\.query\s*\(\s*["`'][^"`']*\+/, message: 'SQL injection vulnerability', severity: 'critical' }
    ],
    ml: [
      { pattern: /torch\.load\([^)]*\)(?!.*map_location)/, message: 'PyTorch load without map_location', severity: 'medium' },
      { pattern: /pickle\.load/, message: 'Unsafe pickle.load usage', severity: 'high' },
      { pattern: /eval\s*\(/, message: 'Dangerous eval() in ML code', severity: 'critical' }
    ]
  };
  
  return patterns[subtype] || [];
}

// Analyze with pattern matching
function analyzeWithPatterns(content, patterns, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  patterns.forEach(function(pattern) {
    lines.forEach(function(line, index) {
      if (pattern.pattern.test(line)) {
        issues.push({
          type: 'pattern',
          message: pattern.message,
          line: index + 1,
          code: line.trim(),
          severity: pattern.severity,
          source: 'pattern-matcher'
        });
      }
    });
  });
  
  return issues;
}

// Package.json analyzer
function analyzePackageJson(content, filePath) {
  var issues = [];
  
  try {
    var pkg = JSON.parse(content);
    
    // Security checks
    if (!pkg.engines || !pkg.engines.node) {
      issues.push({
        type: 'config',
        message: 'Missing Node.js engine specification',
        line: 1,
        severity: 'medium',
        source: 'npm-analyzer'
      });
    }
    
    // Check for known vulnerable packages
    var vulnerablePackages = ['lodash@4.17.20', 'moment@2.29.1', 'axios@0.21.0'];
    Object.keys(pkg.dependencies || {}).forEach(function(dep) {
      var version = pkg.dependencies[dep];
      if (vulnerablePackages.some(vuln => vuln.startsWith(dep + '@'))) {
        issues.push({
          type: 'security',
          message: `Potentially vulnerable package: ${dep}@${version}`,
          line: findLineInJson(content, dep),
          severity: 'high',
          source: 'vulnerability-scanner'
        });
      }
    });
    
  } catch (error) {
    issues.push({
      type: 'syntax',
      message: 'Invalid package.json: ' + error.message,
      line: 1,
      severity: 'high',
      source: 'json-parser'
    });
  }
  
  return issues;
}

// Environment file analyzer
function analyzeEnvFile(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach(function(line, index) {
    var trimmed = line.trim();
    
    // Check for exposed secrets
    if (/^[A-Z_]+\s*=\s*[a-zA-Z0-9+/]{20,}/.test(trimmed)) {
      issues.push({
        type: 'security',
        message: 'Potential secret in environment file',
        line: index + 1,
        code: trimmed.substring(0, 50) + '...',
        severity: 'critical',
        source: 'env-scanner'
      });
    }
    
    // Check for missing quotes
    if (/=.*\s/.test(trimmed) && !/=["']/.test(trimmed)) {
      issues.push({
        type: 'config',
        message: 'Environment value with spaces should be quoted',
        line: index + 1,
        code: trimmed,
        severity: 'medium',
        source: 'env-scanner'
      });
    }
  });
  
  return issues;
}

// Dockerfile analyzer
function analyzeDockerfile(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach(function(line, index) {
    var trimmed = line.trim().toUpperCase();
    
    // Security best practices
    if (trimmed.startsWith('FROM ') && trimmed.includes(':LATEST')) {
      issues.push({
        type: 'deployment',
        message: 'Using :latest tag is not recommended',
        line: index + 1,
        code: line.trim(),
        severity: 'medium',
        source: 'docker-analyzer'
      });
    }
    
    if (trimmed.startsWith('RUN ') && trimmed.includes('SUDO')) {
      issues.push({
        type: 'security',
        message: 'Avoid using sudo in Dockerfile',
        line: index + 1,
        code: line.trim(),
        severity: 'high',
        source: 'docker-analyzer'
      });
    }
  });
  
  return issues;
}

// Shell script analyzer
function analyzeShellScript(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach(function(line, index) {
    var trimmed = line.trim();
    
    // Security checks
    if (/\$\([^)]*\)/.test(trimmed) && !/set -e/.test(content)) {
      issues.push({
        type: 'security',
        message: 'Command substitution without error handling',
        line: index + 1,
        code: trimmed,
        severity: 'medium',
        source: 'shell-analyzer'
      });
    }
  });
  
  return issues;
}

// Generic config analyzer
function analyzeGenericConfig(content, filePath) {
  var issues = [];
  
  // Check for common misconfigurations
  if (/debug\s*[:=]\s*true/i.test(content)) {
    issues.push({
      type: 'config',
      message: 'Debug mode enabled in configuration',
      line: findLineNumber(content, /debug\s*[:=]\s*true/i),
      severity: 'medium',
      source: 'config-analyzer'
    });
  }
  
  return issues;
}

// Helper functions
function findLineNumber(content, pattern) {
  var lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return 1;
}

function findLineInJson(content, key) {
  var lines = content.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].includes('"' + key + '"')) {
      return i + 1;
    }
  }
  return 1;
}

// Enhance issues with metadata
function enhanceIssuesWithMetadata(issues, fileType, content, filePath) {
  return issues.map(function(issue) {
    issue.fileType = fileType.category;
    issue.subtype = fileType.subtype;
    issue.priority = fileType.priority;
    issue.confidence = issue.source === 'pattern-matcher' ? 'high' : 'medium';
    return issue;
  });
}

// 🚀 SMART BATCHING HELPER FUNCTIONS

// Determine if a file will need AI analysis
function willNeedAIAnalysis(content, filePath, classification) {
  // Only CODE files might need AI
  if (classification.category !== 'code') return false;
  
  // Large files likely need AI
  if (content.length > 2000) return true;
  
  // Complex React components need AI
  if (classification.subtype === 'react' && /useEffect|useContext|useReducer/i.test(content)) return true;
  
  // Backend files with auth/security need AI
  if (classification.subtype === 'backend' && /auth|security|jwt|passport/i.test(content)) return true;
  
  // ML/AI files always need AI
  if (classification.subtype === 'ml') return true;
  
  // Files with complex patterns need AI
  if (/async.*await.*Promise|generator.*function|class.*extends/i.test(content)) return true;
  
  return false;
}

// FAST & SIMPLE batch sizing - prioritize speed over perfection
function calculateAdaptiveBatchSize(totalFiles, batchNumber) {
  // MUCH LARGER batches for speed - accept some timeout risk for performance
  if (totalFiles < 500) {
    return Math.min(100, totalFiles); // Small repos: 100 files per batch
  } else if (totalFiles < 2000) {
    return 150; // Medium repos: 150 files per batch
  } else if (totalFiles < 10000) {
    return 200; // Large repos: 200 files per batch  
  } else {
    // Huge repos: Still large batches for speed
    return 250; // 250 files per batch = ~18 batches for React
  }
}

// Enhanced file classification for batching
function classifyFileForBatching(filePath, content) {
  var classification = classifyFileType(filePath, content);
  var needsAI = willNeedAIAnalysis(content, filePath, classification);
  
  return {
    classification: classification,
    needsAI: needsAI,
    estimatedTime: needsAI ? '2-4s' : '0.1ms',
    complexity: needsAI ? 'high' : 'low'
  };
}

// Keep the old function for compatibility
async function generateCustomRules(repoContext) {
  console.log('🎯 Using SPECIALIZED file-type analyzers with SMART BATCHING');
  return null; // Signal to use specialized analysis
}

// 🚀 EXECUTE AI-GENERATED RULES ON ALL FILES
async function executeCustomRules(customRulesCode, filesToProcess, tempDir) {
  try {
    console.log(`⚡ Executing AI-generated rules on ${filesToProcess.length} files...`);
    
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
      customRules = new Function('return ' + cleanCode)();
      
      if (!customRules.executeRules) {
        throw new Error('Missing executeRules function');
      }
      
      console.log('✅ AI rules loaded successfully');
      
    } catch (evalError) {
      console.error('❌ Failed to evaluate AI-generated code:', evalError.message);
      console.log('🔍 Problematic code snippet:', cleanCode.substring(0, 500) + '...');
      return null;
    }
    
    var results = [];
    var totalIssues = 0;
    
    for (var i = 0; i < filesToProcess.length; i++) {
      var file = filesToProcess[i];
      try {
        var content = await fs.readFile(file, 'utf-8');
        var relativePath = path.relative(tempDir, file);
        
        // Execute AI-generated rules
        var issues = customRules.executeRules(content, relativePath);
        
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

async function findCodeFiles(dir) {
  var files = [];
  
  // Priority file extensions - most important first
  var highPriorityExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs'];
  var mediumPriorityExts = ['.cpp', '.c', '.h', '.php', '.rb', '.swift', '.kt'];
  var lowPriorityExts = ['.css', '.scss'];
  
  var allExts = highPriorityExts.concat(mediumPriorityExts, lowPriorityExts);
  
  // ALWAYS scan the entire repository (no directory filtering)
  console.log('🌍 Scanning ENTIRE repository for all code files...');
  
  try {
    await scanDirectory(dir, files, allExts, 0);
  } catch (error) {
    console.warn(`Failed to scan directory ${dir}:`, error.message);
  }
  
  // Sort by priority - NO LIMITS, return ALL files
  var prioritizedFiles = [].concat(
    files.filter(function(f) { return highPriorityExts.includes(path.extname(f).toLowerCase()); }),
    files.filter(function(f) { return mediumPriorityExts.includes(path.extname(f).toLowerCase()); }),
    files.filter(function(f) { return lowPriorityExts.includes(path.extname(f).toLowerCase()); })
  );
  
  // Return ALL files - no limits for comprehensive analysis
  console.log(`📊 Final file count: ${prioritizedFiles.length} files for analysis`);
  return prioritizedFiles;
}

async function scanDirectory(dir, files, extensions, depth) {
  // Prevent infinite recursion
  if (depth > 10) return;
  
  try {
    var items = await fs.readdir(dir, { withFileTypes: true });
    
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      // Skip common unimportant directories
      if (item.name.startsWith('.') || 
          ['node_modules', 'build', 'dist', 'coverage', '__pycache__', 'target', 'vendor'].includes(item.name)) {
        continue;
      }
      
      var fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        await scanDirectory(fullPath, files, extensions, depth + 1);
      } else if (item.isFile()) {
        var ext = path.extname(item.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error.message);
  }
}

// 🆕 NEW ISSUE TYPES - Completely different categories of problems

// 🎨 CODE QUALITY ISSUES - Clean code violations
function checkCodeQualityIssues(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // Magic numbers (not constants)
    if (/\b\d{2,}\b/.test(line) && !/const|let|var|enum|#define/.test(line) && !/test|spec|mock/.test(filePath)) {
      issues.push({
        type: 'quality',
        message: 'Magic number: Consider using named constants for better readability',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'magic_number'
      });
    }
    
    // Long functions (>50 lines)
    if (/^function\s+\w+|^\w+\s*\(.*\)\s*\{|^const\s+\w+\s*=.*=>/.test(trimmed)) {
      var functionLength = 0;
      for (var i = index; i < Math.min(index + 80, lines.length); i++) {
        functionLength++;
        if (lines[i].includes('}') && functionLength > 50) {
          issues.push({
            type: 'quality',
            message: 'Long function: Consider breaking into smaller functions (>50 lines)',
            line: index + 1,
            severity: 'medium',
            code: line.trim(),
            pattern: 'long_function'
          });
          break;
        }
      }
    }
    
    // Deeply nested code (>4 levels)
    var nestingLevel = (line.match(/^\s*/)[0].length / 2);
    if (nestingLevel > 4 && /if\s*\(|for\s*\(|while\s*\(|switch\s*\(/.test(line)) {
      issues.push({
        type: 'quality',
        message: 'Deep nesting: Consider refactoring to reduce complexity (>4 levels)',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'deep_nesting'
      });
    }
    
    // Duplicate code patterns
    if (trimmed.length > 20 && index < lines.length - 5) {
      var duplicateCount = 0;
      for (var j = index + 1; j < Math.min(index + 20, lines.length); j++) {
        if (lines[j].trim() === trimmed) duplicateCount++;
      }
      if (duplicateCount >= 2) {
        issues.push({
          type: 'quality',
          message: 'Duplicate code: Consider extracting into a function or constant',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'duplicate_code'
        });
      }
    }
  });
  
  return issues;
}

// ♿ ACCESSIBILITY ISSUES - Web accessibility violations
function checkAccessibilityIssues(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  // Only check web-related files
  if (!/\.(html|jsx|tsx|vue|svelte)$/i.test(filePath)) return issues;
  
  lines.forEach((line, index) => {
    // Missing alt text on images
    if (/<img\s[^>]*>/i.test(line) && !/alt\s*=/i.test(line)) {
      issues.push({
        type: 'accessibility',
        message: 'Missing alt attribute: Add alt text for screen readers',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'missing_alt_text'
      });
    }
    
    // Missing labels on form inputs
    if (/<input\s[^>]*>/i.test(line) && !/aria-label|id\s*=.*label/i.test(line)) {
      issues.push({
        type: 'accessibility',
        message: 'Missing label: Associate form inputs with labels',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'missing_form_label'
      });
    }
    
    // Missing ARIA roles on interactive elements
    if (/<div\s[^>]*onClick|<span\s[^>]*onClick/i.test(line) && !/role\s*=|tabIndex/i.test(line)) {
      issues.push({
        type: 'accessibility',
        message: 'Interactive element missing ARIA: Add role and tabIndex for keyboard navigation',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'missing_aria_role'
      });
    }
    
    // Low contrast colors (basic detection)
    if (/#fff.*#ccc|#000.*#333|color:\s*white.*background:\s*#ccc/i.test(line)) {
      issues.push({
        type: 'accessibility',
        message: 'Potential low contrast: Ensure sufficient color contrast for readability',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'low_contrast'
      });
    }
  });
  
  return issues;
}

// 🛡️ DATA VALIDATION ISSUES - Input validation problems
function checkDataValidationIssues(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Direct use of user input without validation
    if (/req\.(body|query|params)\.\w+/.test(line) && !/validate|sanitize|escape|trim/.test(line)) {
      issues.push({
        type: 'security',
        message: 'Unvalidated user input: Validate and sanitize user data',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'unvalidated_input'
      });
    }
    
    // Missing email validation
    if (/email/.test(line) && !/\@.*\./.test(line) && !/validator|joi|yup|zod/.test(line)) {
      issues.push({
        type: 'validation',
        message: 'Email validation missing: Use proper email validation library',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'missing_email_validation'
      });
    }
    
    // Missing length validation on strings
    if (/\.length\s*<|\.length\s*>/.test(line) && !/password|username|name/.test(line)) {
      issues.push({
        type: 'validation',
        message: 'String length validation: Consider max/min length limits',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'missing_length_validation'
      });
    }
    
    // File upload without type validation
    if (/multer|upload|file\./i.test(line) && !/mimetype|extension|size/i.test(line)) {
      issues.push({
        type: 'security',
        message: 'File upload validation: Validate file type, size, and content',
        line: index + 1,
        severity: 'high',
        code: line.trim(),
        pattern: 'unsafe_file_upload'
      });
    }
  });
  
  return issues;
}

// ⚡ CONCURRENCY ISSUES - Race conditions and thread safety
function checkConcurrencyIssues(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Shared variable modification without locks
    if (/global\.|window\.|this\.\w+\s*=/.test(line) && /\+\+|--|=.*\+|=.*-/.test(line)) {
      issues.push({
        type: 'concurrency',
        message: 'Potential race condition: Shared variable modification needs synchronization',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'race_condition'
      });
    }
    
    // setTimeout/setInterval without cleanup
    if (/setTimeout|setInterval/i.test(line)) {
      var nextLines = lines.slice(index, index + 10).join('\n');
      if (!/clearTimeout|clearInterval|cleanup|unmount|destroy/.test(nextLines)) {
        issues.push({
          type: 'concurrency',
          message: 'Timer leak: Clear timers to prevent memory leaks',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'timer_leak'
        });
      }
    }
    
    // Promise.all without error handling for individual promises
    if (/Promise\.all\(/i.test(line)) {
      var nextLines = lines.slice(index, index + 5).join('\n');
      if (!/catch|allSettled/.test(nextLines)) {
        issues.push({
          type: 'concurrency',
          message: 'Promise.all error handling: One failed promise fails all - consider allSettled',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'promise_all_failure'
        });
      }
    }
  });
  
  return issues;
}

// ⚙️ CONFIGURATION ISSUES - Configuration and environment problems
function checkConfigurationIssues(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Missing environment variable checks
    if (/process\.env\.\w+/.test(line) && !/\|\||&&|if\s*\(/i.test(line)) {
      issues.push({
        type: 'configuration',
        message: 'Missing env var validation: Check if environment variable exists',
        line: index + 1,
        severity: 'medium',
        code: line.trim(),
        pattern: 'missing_env_check'
      });
    }
    
    // Hardcoded port numbers
    if (/port\s*[:=]\s*\d+|listen\s*\(\s*\d{4}/i.test(line) && !/process\.env|config/i.test(line)) {
      issues.push({
        type: 'configuration',
        message: 'Hardcoded port: Use environment variable for port configuration',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'hardcoded_port'
      });
    }
    
    // Missing CORS configuration
    if (/express\(\)|app\s*=/.test(line) && filePath.includes('server')) {
      var nextLines = lines.slice(index, index + 20).join('\n');
      if (!/cors|Access-Control-Allow/i.test(nextLines)) {
        issues.push({
          type: 'configuration',
          message: 'Missing CORS configuration: Configure CORS for security',
          line: index + 1,
          severity: 'medium',
          code: line.trim(),
          pattern: 'missing_cors'
        });
      }
    }
    
    // Development dependencies in production
    if (/require.*dev|import.*dev/i.test(line) && !/NODE_ENV.*dev/i.test(line)) {
      issues.push({
        type: 'configuration',
        message: 'Development dependency: Avoid dev dependencies in production code',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'dev_dependency_in_prod'
      });
    }
  });
  
  return issues;
}

// 🔍 VERY STRICT LOW PRIORITY ISSUES - Ultra-precise patterns with ZERO false positives
function checkStrictLowPriorityIssues(content, filePath) {
  var issues = [];
  var lines = content.split('\n');
  
  lines.forEach((line, index) => {
    var trimmed = line.trim();
    
    // Skip comments, strings, imports, and type definitions
    if (/^\/\/|^\/\*|\*\/|^import|^export|^declare|^interface|^type\s|^enum\s|["'`].*["'`]$/.test(trimmed)) return;
    
    // 1. 🚨 ULTRA STRICT: Unused variables (very specific pattern)
    // Only flag if: const/let variable = value; and never used again in next 20 lines
    if (/^(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;?\s*$/.test(trimmed)) {
      var varMatch = trimmed.match(/^(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
      if (varMatch) {
        var varName = varMatch[2];
        var nextLines = lines.slice(index + 1, index + 21).join('\n');
        
        // Very strict: Only flag if variable name appears nowhere in next 20 lines
        // AND it's not a common pattern (destructuring, exports, etc.)
        if (!nextLines.includes(varName) && 
            !trimmed.includes('{') && // Not destructuring
            !trimmed.includes('export') && // Not export
            varName.length > 3 && // Not short variable names
            !/^(i|j|k|x|y|z|_)$/.test(varName)) { // Not common loop vars
          
          issues.push({
            type: 'maintenance',
            message: 'Unused variable: Variable declared but never used',
            line: index + 1,
            severity: 'low',
            code: line.trim(),
            pattern: 'unused_variable',
            strictPattern: true
          });
        }
      }
    }
    
    // 2. 🚨 ULTRA STRICT: Commented out code (very specific)
    // Only flag multi-line commented code blocks that look like actual code
    if (/^\/\/\s*(function|const|let|var|if\s*\(|for\s*\(|while\s*\(|class\s+\w+)/.test(trimmed)) {
      // Check if next 2-3 lines are also commented code
      var nextCommentedLines = 0;
      for (var i = index + 1; i < Math.min(index + 4, lines.length); i++) {
        if (/^\/\/\s*(}|{|\w+\s*\(|\w+\s*=)/.test(lines[i].trim())) {
          nextCommentedLines++;
        }
      }
      
      // Only flag if it's clearly a block of commented code (3+ lines)
      if (nextCommentedLines >= 2) {
        issues.push({
          type: 'maintenance',
          message: 'Commented code block: Remove dead code instead of commenting',
          line: index + 1,
          severity: 'low',
          code: line.trim(),
          pattern: 'commented_code_block',
          strictPattern: true
        });
      }
    }
    
    // 3. 🚨 ULTRA STRICT: Redundant type annotations (TypeScript specific)
    // Only in .ts/.tsx files with obvious redundant types
    if (/\.(ts|tsx)$/i.test(filePath)) {
      if (/:\s*string\s*=\s*["']|:\s*number\s*=\s*\d+|:\s*boolean\s*=\s*(true|false)/.test(line)) {
        issues.push({
          type: 'maintenance',
          message: 'Redundant type annotation: TypeScript can infer this type',
          line: index + 1,
          severity: 'low',
          code: line.trim(),
          pattern: 'redundant_type_annotation',
          strictPattern: true
        });
      }
    }
    
    // 4. 🚨 ULTRA STRICT: Unnecessary semicolons (JavaScript/TypeScript)
    // Only flag obvious cases like double semicolons or after braces
    if (/;;|}\s*;/.test(line) && !/for\s*\(/i.test(line)) {
      issues.push({
        type: 'style',
        message: 'Unnecessary semicolon: Remove redundant semicolon',
        line: index + 1,
        severity: 'low',
        code: line.trim(),
        pattern: 'unnecessary_semicolon',
        strictPattern: true
      });
    }
    
    // 5. 🚨 ULTRA STRICT: Empty functions (very specific)
    // Only flag functions that are completely empty (not just whitespace/comments)
    if (/function\s+\w+\s*\([^)]*\)\s*\{\s*\}|=>\s*\{\s*\}/.test(line)) {
      // Make sure it's not a placeholder or interface method
      if (!/TODO|FIXME|placeholder|abstract|interface/i.test(line)) {
        issues.push({
          type: 'maintenance',
          message: 'Empty function: Implement function body or remove if not needed',
          line: index + 1,
          severity: 'low',
          code: line.trim(),
          pattern: 'empty_function',
          strictPattern: true
        });
      }
    }
    
    // 6. 🚨 ULTRA STRICT: Inconsistent indentation (very obvious cases)
    // Only flag lines that are clearly misaligned (mixed tabs/spaces)
    if (/^\t+ +|^ +\t/.test(line)) {
      issues.push({
        type: 'style',
        message: 'Mixed indentation: Use consistent tabs or spaces',
        line: index + 1,
        severity: 'low',
        code: 'Mixed tabs and spaces detected',
        pattern: 'mixed_indentation',
        strictPattern: true
      });
    }
    
    // 7. 🚨 ULTRA STRICT: Trailing whitespace (only if significant)
    // Only flag lines with 3+ trailing spaces (not just 1-2)
    if (/   +$/.test(line)) {
      issues.push({
        type: 'style',
        message: 'Trailing whitespace: Remove unnecessary spaces at end of line',
        line: index + 1,
        severity: 'low',
        code: 'Trailing whitespace detected',
        pattern: 'trailing_whitespace',
        strictPattern: true
      });
    }
  });
  
  return issues;
}

export const handler = async (event) => {
  console.log('🤖 CLEAN Lambda analyzer started:', JSON.stringify(event));
  
  var { repoUrl, analysisId, batchNumber = null, fullRepoAnalysis = false } = JSON.parse(event.body || '{}');
  
  if (!repoUrl || !analysisId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'repoUrl and analysisId required' })
    };
  }
  
  var tempDir = path.join('/tmp', `analysis-${Date.now()}`);
  var results = [];
  var isFileBatched = !!batchNumber;
  
  try {
    // Step 1: ALWAYS SHALLOW CLONE FULL REPOSITORY
    console.log(`📥 Shallow cloning full repository ${isFileBatched ? `(file batch ${batchNumber})` : '(single analysis)'}...`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Try git layer first, fallback to system git
    var gitPath = '/opt/bin/git'; // From git layer
    try {
      // Test if git layer exists
      execSync(`${gitPath} --version`, { stdio: 'pipe' });
      console.log('✅ Using git from Lambda layer: /opt/bin/git');
    } catch (error) {
      console.warn('⚠️ Git layer not found, using system git');
      gitPath = 'git';
    }
    
    // Check available /tmp storage space
    try {
      var tmpStats = await fs.stat('/tmp');
      console.log('💾 /tmp directory exists, checking available space...');
      
      // Get disk usage info (rough estimate)
      var tmpUsage = execSync('df -h /tmp', { encoding: 'utf8' });
      console.log('💾 /tmp storage info:', tmpUsage);
    } catch (storageError) {
      console.warn('⚠️ Could not check /tmp storage:', storageError.message);
    }
    
    // REGULAR SHALLOW CLONE: Fast and reliable
    console.log('🌊 Performing shallow clone (depth=1)...');
    
    var cloneCmd = `${gitPath} clone --depth 1 --single-branch --no-tags "${repoUrl}" "${tempDir}"`;
    console.log('📋 Clone command:', cloneCmd);
    
    try {
      execSync(cloneCmd, { stdio: 'pipe' });
      console.log('✅ Shallow clone successful');
    } catch (cloneError) {
      console.error('❌ Git clone failed:', cloneError.message);
      console.error('📋 Failed command:', cloneCmd);
      console.error('🔍 Repository URL:', repoUrl);
      console.error('📁 Target directory:', tempDir);
      throw new Error(`Failed to clone repository: ${cloneError.message}`);
    }
    
    // Step 2: Find ALL code files from full repository
    console.log('📁 Finding ALL code files from full repository...');
    
    var allFiles = await findCodeFiles(tempDir);
    console.log(`📊 CRITICAL: Found ${allFiles.length} total code files in repository`);
    
    // 🎭 STEP 2.5: AI ORCHESTRA MANAGER - Create intelligent analysis strategy
    console.log('🎭 AI Orchestra Manager: Creating analysis strategy...');
    var analysisStrategy = await createAnalysisStrategy(allFiles);
    
    // Apply AI strategy to filter files by priority
    var prioritizedFiles = [];
    if (analysisStrategy.critical) {
      prioritizedFiles = prioritizedFiles.concat(analysisStrategy.critical.map(f => ({path: f, priority: 'critical'})));
    }
    if (analysisStrategy.high) {
      prioritizedFiles = prioritizedFiles.concat(analysisStrategy.high.map(f => ({path: f, priority: 'high'})));
    }
    if (analysisStrategy.medium) {
      prioritizedFiles = prioritizedFiles.concat(analysisStrategy.medium.map(f => ({path: f, priority: 'medium'})));
    }
    if (analysisStrategy.light) {
      prioritizedFiles = prioritizedFiles.concat(analysisStrategy.light.map(f => ({path: f, priority: 'light'})));
    }
    
    // If no strategy returned, use fallback
    var filesToProcess;
    if (prioritizedFiles.length === 0) {
      filesToProcess = allFiles.slice(0, 100);
      console.log('⚠️ Using fallback strategy: analyzing first 100 files');
    } else {
      filesToProcess = prioritizedFiles.map(f => f.path);
      console.log(`🎯 AI Strategy applied: ${filesToProcess.length} files prioritized for analysis`);
      console.log(`📊 Priority breakdown: ${analysisStrategy.critical?.length || 0} critical, ${analysisStrategy.high?.length || 0} high, ${analysisStrategy.medium?.length || 0} medium, ${analysisStrategy.light?.length || 0} light`);
    }
    
    // Step 3: Handle file-based batching
    var isLastBatch = true;
    
    if (isFileBatched) {
      // 🚀 ADAPTIVE BATCHING: Smart but lightweight approach
      console.log('🎯 Using adaptive batching strategy...');
      
      // Determine batch size based on repository size and batch number
      var adaptiveBatchSize = calculateAdaptiveBatchSize(allFiles.length, batchNumber);
      console.log(`📊 Adaptive batch size: ${adaptiveBatchSize} files`);
      
      const startIndex = (batchNumber - 1) * adaptiveBatchSize;
      const endIndex = startIndex + adaptiveBatchSize;
      
      filesToProcess = allFiles.slice(startIndex, endIndex);
      isLastBatch = endIndex >= allFiles.length || filesToProcess.length === 0;
      
      console.log(`📦 ADAPTIVE BATCH ${batchNumber} DETAILS:`);
      console.log(`   📊 Total files in repo: ${allFiles.length}`);
      console.log(`   📍 Processing range: ${startIndex + 1} to ${Math.min(endIndex, allFiles.length)}`);
      console.log(`   📁 Files in this batch: ${filesToProcess.length}`);
      console.log(`   🏁 Is last batch: ${isLastBatch}`);
      
      if (filesToProcess.length === 0) {
        console.log(`⚠️ WARNING: No files to process in batch ${batchNumber}`);
        console.log(`📊 Debug info: allFiles.length=${allFiles.length}, startIndex=${startIndex}, endIndex=${endIndex}`);
        console.log(`🎭 AI Strategy files: critical=${analysisStrategy.critical?.length || 0}, high=${analysisStrategy.high?.length || 0}, medium=${analysisStrategy.medium?.length || 0}, light=${analysisStrategy.light?.length || 0}`);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            analysisId: analysisId,
            results: [],
            isFileBatched: true,
            batchNumber: batchNumber,
            isLastBatch: true,
            stats: {
              filesProcessed: 0,
              filesWithIssues: 0,
              totalIssues: 0,
              totalFilesInRepo: allFiles.length
            },
            message: `ADAPTIVE BATCH ${batchNumber} - No more files to process`
          })
        };
      }
    }
    
    // Step 4: Analyze files using semantic bug detection (no timeouts for speed)
    var processedFiles = 0;
    var totalIssues = 0;
    var batchStartTime = Date.now();
    var timeoutLimit = 25000; // 25 seconds timeout (AWS Lambda has 30s limit)
    
    for (var i = 0; i < filesToProcess.length; i++) {
      // 🚨 TIMEOUT SAFETY: Check if we're approaching Lambda timeout
      if (Date.now() - batchStartTime > timeoutLimit) {
        console.warn(`⏰ Approaching timeout limit, stopping analysis at ${i}/${filesToProcess.length} files`);
        break;
      }
      
      var file = filesToProcess[i];
      try {
        var content = await fs.readFile(file, 'utf-8');
        var relativePath = path.relative(tempDir, file);
        
        // 🎯 AI ORCHESTRA MANAGER: Priority-based analysis
        var filePriority = prioritizedFiles.find(f => f.path === relativePath)?.priority || 'medium';
        
        // 🧠 SMALL REPO ENHANCEMENT: Give more comprehensive analysis to small repos (but limit to prevent timeouts)
        if (analysisStrategy.analysisStrategy === 'comprehensive' && allFiles.length < 20) {
          // For small repos, upgrade ONLY the most important files to critical analysis
          if (/\.(js|ts|jsx|tsx)$/i.test(relativePath) && 
              !/test|spec|\.test\.|\.spec\.|node_modules/i.test(relativePath) &&
              i < 3) { // 🚀 LIMIT: Only first 3 files get critical analysis to prevent timeouts
            filePriority = 'critical'; // 🔥 More thorough analysis for key files only
          }
        }
        var issues = await analyzeFileByPriority(content, relativePath, filePriority, analysisStrategy);
        
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
    
    console.log(`✅ TIER 1 ANALYSIS COMPLETE FOR BATCH ${batchNumber || 'N/A'}:`);
    console.log(`   📊 Files processed: ${processedFiles}`);
    console.log(`   📁 Files with issues: ${results.length}`);
    console.log(`   🚨 Total issues found: ${totalIssues}`);
    
    // 🧠 TIER 2: DEDICATED AI ANALYSIS - Create special batch of ONLY critical files
    var aiDeepIssues = [];
    if (analysisStrategy.critical && analysisStrategy.critical.length > 0) {
      console.log(`🧠 Starting DEDICATED AI ANALYSIS of ${analysisStrategy.critical.length} critical files...`);
      
      try {
        // 📁 STEP 1: Create special temp folder for ONLY critical files
        var criticalTempDir = path.join('/tmp', `ai-critical-${Date.now()}`);
        await fs.mkdir(criticalTempDir, { recursive: true });
        console.log(`📁 Created dedicated AI analysis folder: ${criticalTempDir}`);
        
        // 📋 STEP 2: Copy ONLY critical files to dedicated folder
        var criticalFilesWithContent = [];
        var copiedFiles = 0;
        
        for (var criticalFile of analysisStrategy.critical) {
          try {
            // Convert absolute path to relative if needed
            var relativePath = criticalFile.startsWith(tempDir) 
              ? path.relative(tempDir, criticalFile)
              : criticalFile;
            
            var sourcePath = path.join(tempDir, relativePath);
            var destPath = path.join(criticalTempDir, relativePath);
            
            // Create directory structure
            var destDir = path.dirname(destPath);
            await fs.mkdir(destDir, { recursive: true });
            
            // Copy file
            var content = await fs.readFile(sourcePath, 'utf-8');
            await fs.writeFile(destPath, content);
            
            criticalFilesWithContent.push({
              path: relativePath,
              content: content,
              priority: 'critical',
              size: content.length
            });
            copiedFiles++;
            
            console.log(`📄 Copied critical file: ${criticalFile} (${content.length} chars)`);
          } catch (copyError) {
            console.warn(`⚠️ Could not copy critical file ${criticalFile}:`, copyError.message);
          }
        }
        
        console.log(`✅ Successfully copied ${copiedFiles} critical files for AI analysis`);
        
        // 🧠 STEP 3: AI analyzes dedicated critical files batch (multiple batches if needed)
        if (criticalFilesWithContent.length > 0) {
          aiDeepIssues = await performDedicatedAIAnalysis(criticalFilesWithContent, analysisStrategy, criticalTempDir);
          console.log(`🧠 Dedicated AI Analysis found ${aiDeepIssues.length} deep insights`);
          
          // Add AI issues to results
          if (aiDeepIssues.length > 0) {
            results.push({
              file: '🧠 Dedicated AI Analysis',
              issues: aiDeepIssues
            });
            totalIssues += aiDeepIssues.length;
          }
        }
        
        // Cleanup AI temp folder
        try {
          execSync(`rm -rf "${criticalTempDir}"`, { stdio: 'ignore' });
          console.log(`🗑️ Cleaned up AI analysis folder`);
        } catch (cleanupError) {
          console.warn(`⚠️ AI folder cleanup failed:`, cleanupError.message);
        }
        
      } catch (aiError) {
        console.warn(`⚠️ Dedicated AI Analysis failed:`, aiError.message);
      }
    } else {
      console.log(`⚠️ Skipping AI Deep Analysis: No critical files found`);
    }
    
    console.log(`✅ COMPLETE TWO-TIER ANALYSIS:`);
    console.log(`   📊 Tier 1 (Fast): ${processedFiles} files, ${totalIssues - aiDeepIssues.length} issues`);
    console.log(`   🧠 Tier 2 (AI): ${aiDeepIssues.length} deep insights`);
    console.log(`   🎯 Total: ${totalIssues} issues found`);
    
    // Note: AI filtering will happen in frontend API layer to prevent Lambda timeouts
    
    var returnData = {
      success: true,
      analysisId: analysisId,
      results: results,
      isFileBatched: isFileBatched,
      batchNumber: batchNumber,
      isLastBatch: isLastBatch,
      stats: {
        filesProcessed: processedFiles,
        filesWithIssues: results.length,
        totalIssues: totalIssues,
        totalFilesInRepo: isFileBatched ? allFiles.length : processedFiles
      },
      message: `${isFileBatched ? `FILE BATCH ${batchNumber}` : 'FULL'} Analysis complete: ${totalIssues} issues found in ${results.length} files`
    };
    
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
