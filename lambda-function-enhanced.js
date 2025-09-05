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

// 🚀 GREPTILE KILLER: HYBRID ANALYSIS ENGINE
async function performHybridAnalysis(content, filePath, tempDir) {
  console.log(`🔥 HYBRID ANALYSIS: ${filePath}`);
  
  var allIssues = [];
  var ext = path.extname(filePath).toLowerCase();
  var startTime = Date.now();
  
  try {
    // PHASE 1: ⚡ LIGHTNING-FAST STATIC ANALYSIS (0.1-0.5 seconds)
    console.log(`⚡ Phase 1: Static analysis for ${filePath}`);
    var staticIssues = await performRealAnalysis(content, filePath, tempDir);
    
    if (staticIssues && staticIssues.length > 0) {
      staticIssues.forEach(function(issue) {
        issue.source = 'static';
        issue.confidence = 'high'; // Static analysis is always confident
      });
      allIssues = allIssues.concat(staticIssues);
      console.log(`⚡ Static found ${staticIssues.length} issues`);
    }
    
    // PHASE 2: 🧠 SMART AI ANALYSIS (1-3 seconds, selective)
    var shouldUseAI = decideShouldUseAI(content, filePath, staticIssues);
    
    if (shouldUseAI && OPENAI_API_KEY) {
      console.log(`🧠 Phase 2: AI analysis for ${filePath}`);
      var aiIssues = await performAIAnalysis(content, filePath);
      
      if (aiIssues && aiIssues.length > 0) {
        // Deduplicate and enhance AI issues
        var uniqueAIIssues = deduplicateIssues(staticIssues, aiIssues);
        
        uniqueAIIssues.forEach(function(issue) {
          issue.source = 'ai';
          issue.confidence = 'medium'; // AI might have false positives
          issue.explanation = `AI detected: ${issue.message}`;
        });
        
        allIssues = allIssues.concat(uniqueAIIssues);
        console.log(`🧠 AI found ${uniqueAIIssues.length} additional issues`);
      }
    } else {
      console.log(`⏭️ Skipping AI analysis: ${!shouldUseAI ? 'not needed' : 'no API key'}`);
    }
    
    // PHASE 3: 🎯 PRIORITY SCORING & RANKING
    allIssues = prioritizeIssues(allIssues, content, filePath);
    
    var analysisTime = Date.now() - startTime;
    console.log(`🔥 HYBRID COMPLETE: ${allIssues.length} total issues in ${analysisTime}ms`);
    
    return allIssues;
    
  } catch (error) {
    console.error(`❌ Hybrid analysis failed for ${filePath}:`, error.message);
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

// Keep the old function for compatibility
async function generateCustomRules(repoContext) {
  console.log('🔥 Using HYBRID analysis engine (Static + AI)');
  return null; // Signal to use hybrid analysis
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
      const filesPerBatch = 50;
      console.log(`⚡ Fast batch size: ${filesPerBatch} files per batch`);
      
      const startIndex = (batchNumber - 1) * filesPerBatch;
      const endIndex = startIndex + filesPerBatch;
      
      filesToProcess = allFiles.slice(startIndex, endIndex);
      isLastBatch = endIndex >= allFiles.length || filesToProcess.length === 0;
      
      console.log(`📦 BATCH ${batchNumber} DETAILS:`);
      console.log(`   📊 Total files in repo: ${allFiles.length}`);
      console.log(`   📁 Files in this batch: ${filesToProcess.length}`);
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
            message: `FILE BATCH ${batchNumber} - No more files to process`
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
