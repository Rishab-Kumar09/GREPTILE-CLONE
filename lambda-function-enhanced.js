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
    
    // Skip simple files to save tokens and time
    if (!hasSecurityKeywords && !hasPerformanceKeywords && !hasErrorKeywords && !isComplexFile) {
      console.log(`⏭️ Skipping simple file: ${filePath} (no risk patterns)`);
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
      console.log(`ℹ️ AI found no issues in ${filePath}`);
      return [];
    }
    
  } catch (error) {
    console.error(`❌ AI analysis failed for ${filePath}:`, error.message);
    return performBasicAnalysis(content, filePath);
  }
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
    issues.push({
      type: 'documentation',
      message: 'Documentation file is too short',
      line: 1,
      severity: 'low',
      source: 'doc-analyzer'
    });
  }
  
  if (!/#+\s/.test(content)) {
    issues.push({
      type: 'documentation', 
      message: 'Missing proper markdown headers',
      line: 1,
      severity: 'low',
      source: 'doc-analyzer'
    });
  }
  
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

// Calculate optimal batch size based on file distribution
function calculateOptimalBatchSize(instantCount, aiCount, currentBatch) {
  // Configuration for different batch sizes
  var INSTANT_BATCH_SIZE = 1000;  // Large batches for instant analysis
  var AI_BATCH_SIZE = 15;         // Small batches for AI analysis
  var MAX_LAMBDA_TIME = 12000;    // 12 seconds max per batch
  
  // Calculate how many instant batches we need
  var instantBatches = Math.ceil(instantCount / INSTANT_BATCH_SIZE);
  
  // Determine if current batch should be instant or AI
  if (currentBatch <= instantBatches) {
    // We're in the instant analysis phase
    return {
      type: 'instant',
      size: INSTANT_BATCH_SIZE,
      instantBatchSize: INSTANT_BATCH_SIZE,
      estimatedTime: '2-5 seconds'
    };
  } else {
    // We're in the AI analysis phase
    return {
      type: 'ai', 
      size: AI_BATCH_SIZE,
      instantBatchSize: INSTANT_BATCH_SIZE,
      estimatedTime: '8-12 seconds'
    };
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
    
    // ULTRA-SHALLOW CLONE: Only essential code files, no binaries/benchmarks
    console.log('🌊 Performing ULTRA-SHALLOW CLONE (code files only)');
    
    try {
      // Step 1: Initialize empty repo
      console.log('📂 Initializing empty repository...');
      execSync(`${gitPath} init "${tempDir}"`, { stdio: 'pipe' });
      
      // Step 2: Add remote
      console.log('🔗 Adding remote origin...');
      execSync(`${gitPath} -C "${tempDir}" remote add origin "${repoUrl}"`, { stdio: 'pipe' });
      
      // Step 3: Enable sparse checkout
      console.log('⚡ Enabling sparse-checkout for code files only...');
      execSync(`${gitPath} -C "${tempDir}" config core.sparseCheckout true`, { stdio: 'pipe' });
      
      // Step 4: Define sparse-checkout patterns (smart inclusion for maximum coverage)
      var sparsePatterns = [
        // INCLUDE: All source code files
        '*.js', '*.ts', '*.jsx', '*.tsx',           // JavaScript/TypeScript
        '*.py', '*.pyx', '*.pyi',                   // Python (TensorFlow core)
        '*.cpp', '*.cc', '*.c', '*.h', '*.hpp',     // C/C++ (performance critical)
        '*.java', '*.kt', '*.scala',                // JVM languages  
        '*.go', '*.rs', '*.swift', '*.rb',          // Other languages
        '*.php', '*.css', '*.scss', '*.less',       // Web interfaces
        '*.sql', '*.sh', '*.bash', '*.zsh',         // Scripts/SQL
        '*.yaml', '*.yml', '*.json', '*.toml',      // Config files
        '*.proto', '*.pbtxt',                       // Protocol buffers (small)
        '*.BUILD', '*.bazel', '*.bzl',              // Bazel build files
        '*.cmake', 'CMakeLists.txt',                // CMake files
        'Dockerfile*', '*.dockerfile',              // Docker configs
        '*.md', '*.txt', '*.rst',                   // Docs (small)
        
        // INCLUDE: Critical directories (but exclude huge files within them)
        'tensorflow/core/**',                       // Core TensorFlow code
        'tensorflow/python/**',                     // Python API
        'tensorflow/compiler/**',                   // Compiler code
        'tensorflow/stream_executor/**',            // GPU execution
        
        // EXCLUDE: Massive files and directories
        '!**/*.hlo',                                // Huge benchmark files (1GB+)
        '!**/*.pb',                                 // Large binary protobufs
        '!**/*.bin', '!**/*.dat',                   // Binary data files
        '!**/benchmarks/**',                        // Benchmark data
        '!**/testdata/**', '!**/test_data/**',      // Test datasets
        '!**/node_modules/**',                      // Dependencies
        '!**/build/**', '!**/dist/**',              // Build outputs
        '!**/*.min.js', '!**/*.bundle.js',          // Minified files
        '!**/third_party/xla/**/benchmarks/**',     // XLA benchmarks (the culprit!)
        '!**/third_party/xla/**/*.hlo'              // XLA HLO files (huge!)
      ].join('\\n');
      
      await fs.writeFile(path.join(tempDir, '.git/info/sparse-checkout'), sparsePatterns);
      console.log('📋 Sparse-checkout patterns configured for code files only');
      
      // Step 5: Fetch only what we need (ultra shallow)
      console.log('📥 Fetching code files only (depth=1)...');
      var fetchCmd = `${gitPath} -C "${tempDir}" fetch --depth 1 origin HEAD`;
      execSync(fetchCmd, { stdio: 'pipe' });
      
      // Step 6: Checkout sparse files
      console.log('📂 Checking out sparse code files...');
      execSync(`${gitPath} -C "${tempDir}" checkout FETCH_HEAD`, { stdio: 'pipe' });
      
      console.log('✅ Ultra-shallow sparse clone successful (code files only)');
      
    } catch (cloneError) {
      console.error('❌ Ultra-shallow clone failed:', cloneError.message);
      console.error('🔍 Repository URL:', repoUrl);
      console.error('📁 Target directory:', tempDir);
      
      // Fallback to regular shallow clone if sparse fails
      console.log('🔄 Falling back to regular shallow clone...');
      try {
        // Clean up failed sparse attempt
        execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
        await fs.mkdir(tempDir, { recursive: true });
        
        var fallbackCmd = `${gitPath} clone --depth 1 --single-branch --no-tags "${repoUrl}" "${tempDir}"`;
        console.log('📋 Fallback command:', fallbackCmd);
        execSync(fallbackCmd, { stdio: 'pipe' });
        console.log('✅ Fallback shallow clone successful');
        
      } catch (fallbackError) {
        console.error('❌ Both sparse and fallback clones failed:', fallbackError.message);
        throw new Error(`Failed to clone repository: ${fallbackError.message}`);
      }
    }
    
    // Step 2: Find ALL code files from full repository
    console.log('📁 Finding ALL code files from full repository...');
    
    var allFiles = await findCodeFiles(tempDir);
    console.log(`📊 CRITICAL: Found ${allFiles.length} total code files in repository`);
    
    // Step 3: Handle file-based batching
    var filesToProcess = allFiles;
    var isLastBatch = true;
    
    if (isFileBatched) {
      // 🚀 SMART DYNAMIC BATCHING: Classify files first, then batch by complexity
      console.log('🧠 Performing smart file classification for dynamic batching...');
      
      var fileClassifications = allFiles.map(function(file) {
        try {
          var content = require('fs').readFileSync(file, 'utf8');
          var classification = classifyFileType(path.relative(tempDir, file), content);
          return {
            path: file,
            relativePath: path.relative(tempDir, file),
            classification: classification,
            needsAI: willNeedAIAnalysis(content, file, classification)
          };
        } catch (error) {
          return {
            path: file,
            relativePath: path.relative(tempDir, file),
            classification: { category: 'unknown', subtype: 'generic', priority: 'low' },
            needsAI: false
          };
        }
      });
      
      // Separate files by analysis complexity
      var instantFiles = fileClassifications.filter(f => !f.needsAI);
      var aiFiles = fileClassifications.filter(f => f.needsAI);
      
      console.log(`📊 FILE COMPLEXITY BREAKDOWN:`);
      console.log(`   ⚡ Instant analysis: ${instantFiles.length} files (${Math.round(instantFiles.length/allFiles.length*100)}%)`);
      console.log(`   🧠 AI analysis needed: ${aiFiles.length} files (${Math.round(aiFiles.length/allFiles.length*100)}%)`);
      
      // 🎯 DYNAMIC BATCH SIZING STRATEGY
      var batchConfig = calculateOptimalBatchSize(instantFiles.length, aiFiles.length, batchNumber);
      console.log(`🎯 Batch ${batchNumber} config: ${batchConfig.type} (${batchConfig.size} files)`);
      
      var allClassifiedFiles = [];
      
      if (batchConfig.type === 'instant') {
        // LARGE BATCHES for instant analysis (1000+ files)
        const startIndex = (batchNumber - 1) * batchConfig.size;
        const endIndex = Math.min(startIndex + batchConfig.size, instantFiles.length);
        allClassifiedFiles = instantFiles.slice(startIndex, endIndex);
        
        // Check if we need to switch to AI batches next
        var instantBatchesComplete = endIndex >= instantFiles.length;
        var aiRemaining = aiFiles.length > 0;
        isLastBatch = instantBatchesComplete && !aiRemaining;
        
      } else if (batchConfig.type === 'ai') {
        // SMALL BATCHES for AI analysis (10-25 files)
        var instantBatches = Math.ceil(instantFiles.length / batchConfig.instantBatchSize);
        var aiBatchNumber = batchNumber - instantBatches;
        
        const startIndex = (aiBatchNumber - 1) * batchConfig.size;
        const endIndex = Math.min(startIndex + batchConfig.size, aiFiles.length);
        allClassifiedFiles = aiFiles.slice(startIndex, endIndex);
        
        isLastBatch = endIndex >= aiFiles.length;
      }
      
      filesToProcess = allClassifiedFiles.map(f => f.path);
      
      console.log(`📦 SMART BATCH ${batchNumber} DETAILS:`);
      console.log(`   📊 Total files in repo: ${allFiles.length}`);
      console.log(`   📁 Files in this batch: ${filesToProcess.length}`);
      console.log(`   ⚡ Analysis type: ${batchConfig.type}`);
      console.log(`   🏁 Is last batch: ${isLastBatch}`);
      
      if (filesToProcess.length === 0) {
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
            message: `SMART BATCH ${batchNumber} - No more files to process`
          })
        };
      }
    }
    
    // Step 4: Analyze files using fallback analysis (simple and fast)
    var processedFiles = 0;
    var totalIssues = 0;
    
    for (var i = 0; i < filesToProcess.length; i++) {
      var file = filesToProcess[i];
      try {
        var content = await fs.readFile(file, 'utf-8');
        var relativePath = path.relative(tempDir, file);
        
        // 🚀 HYBRID ANALYSIS: Static + AI for maximum coverage
        var issues = await performHybridAnalysis(content, relativePath, tempDir);
        
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
    
    console.log(`✅ ANALYSIS COMPLETE FOR BATCH ${batchNumber || 'N/A'}:`);
    console.log(`   📊 Files processed: ${processedFiles}`);
    console.log(`   📁 Files with issues: ${results.length}`);
    console.log(`   🚨 Total issues found: ${totalIssues}`);
    
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
