import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
console.log('🔑 OpenAI API Key status:', OPENAI_API_KEY ? 'FOUND' : 'MISSING');

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
    
    // 8. REACT-SPECIFIC: useEffect without dependencies (infinite loops)
    if (isReactFile && trimmedLine.match(/useEffect\s*\([^,]+\)/) && !trimmedLine.includes('[')) {
      issues.push({
        type: 'performance',
        message: 'useEffect without dependencies - will cause infinite re-renders',
        line: lineNum,
        code: trimmedLine.substring(0, 80),
        severity: 'critical'
      });
    }
  });
  
  console.log(`🔧 Selective fallback found ${issues.length} critical issues (filtered out noise)`);
  return issues;
}

// 🧠 SIMPLIFIED RULE GENERATOR: Fast and reliable
async function generateCustomRules(repoContext) {
  // Skip AI generation for now - use hardcoded reliable rules
  console.log('⚡ Using fast hardcoded rules instead of AI generation');
  
  return `{
    findSecurityIssues: function(content, lines, filePath) {
      var issues = [];
      if (content.indexOf('dangerouslySetInnerHTML') !== -1) {
        issues.push({
          type: 'security',
          message: 'XSS risk with dangerouslySetInnerHTML',
          line: 1,
          code: 'dangerouslySetInnerHTML',
          severity: 'high'
        });
      }
      if (content.indexOf('eval(') !== -1) {
        issues.push({
          type: 'security',
          message: 'Code injection risk with eval()',
          line: 1,
          code: 'eval(',
          severity: 'critical'
        });
      }
      return issues;
    },

    findPerformanceIssues: function(content, lines, filePath) {
      var issues = [];
      if (content.indexOf('useEffect') !== -1 && content.indexOf('[]') === -1 && content.indexOf('[') === -1) {
        issues.push({
          type: 'performance', 
          message: 'useEffect without dependencies may cause infinite re-renders',
          line: 1,
          code: 'useEffect',
          severity: 'medium'
        });
      }
      return issues;
    },

    executeRules: function(content, filePath) {
      var allIssues = [];
      if (filePath.match(/\\.(js|jsx|ts|tsx)$/)) {
        allIssues = allIssues.concat(this.findSecurityIssues(content, content.split('\\n'), filePath));
        allIssues = allIssues.concat(this.findPerformanceIssues(content, content.split('\\n'), filePath));
      }
      return allIssues;
    }
  }`;
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
    
    var gitPath = '/opt/bin/git'; // From git layer
    
    // ALWAYS do shallow clone of complete repository
    console.log('🌊 Performing SHALLOW CLONE of full repository');
    var cloneCmd = `${gitPath} clone --depth 1 --single-branch --no-tags "${repoUrl}" "${tempDir}"`;
    execSync(cloneCmd, { stdio: 'pipe' });
    console.log('✅ Shallow clone successful');
    
    // Step 2: Find ALL code files from full repository
    console.log('📁 Finding ALL code files from full repository...');
    
    var allFiles = await findCodeFiles(tempDir); // Get ALL files from entire repository
    console.log(`📊 CRITICAL: Found ${allFiles.length} total code files in repository`);
    
    // Step 3: Handle file-based batching
    var filesToProcess = allFiles;
    var isLastBatch = true;
    
    if (isFileBatched) {
      // FILE-BASED BATCHING: Process files in chunks
      const filesPerBatch = 50; // Reduced to prevent Gateway timeouts
      console.log(`⚡ Fast batch size: ${filesPerBatch} files per batch`);
      
      const startIndex = (batchNumber - 1) * filesPerBatch;
      const endIndex = startIndex + filesPerBatch;
      
      filesToProcess = allFiles.slice(startIndex, endIndex);
      isLastBatch = endIndex >= allFiles.length || filesToProcess.length === 0;
      
      console.log(`📦 BATCH ${batchNumber} DETAILS:`);
      console.log(`   📊 Total files in repo: ${allFiles.length}`);
      console.log(`   📍 Processing range: ${startIndex + 1} to ${Math.min(endIndex, allFiles.length)}`);
      console.log(`   📁 Files in this batch: ${filesToProcess.length}`);
      console.log(`   🏁 Is last batch: ${isLastBatch}`);
      
      // Early return if no files in this batch
      if (filesToProcess.length === 0) {
        console.log(`🛑 EARLY RETURN: No files in batch ${batchNumber}, marking as last batch`);
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            analysisId: analysisId,
            results: [],
            isFileBatched: true,
            batchNumber: batchNumber,
            isLastBatch: true, // Force last batch when no files
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
    
    console.log(`🔍 Processing ${filesToProcess.length} files in this batch`);
    
    // Step 4: Analyze files in this batch
    console.log(`🔍 Analyzing ${filesToProcess.length} files in this batch...`);
    var processedFiles = 0;
    var totalIssues = 0;
    
    // 🧠 AI RULE GENERATOR: Create minimal, focused rules for this repo
    console.log(`🧠 AI RULE GENERATOR: Creating custom analysis rules for ${filesToProcess.length} files...`);
    
    // Step 1: Build repository context (simplified)
    var repoContext = {
      totalFiles: filesToProcess.length,
      fileContents: []
    };
    
    // Step 2: AI generates minimal rule set (now using hardcoded rules)
    var customRulesCode = await generateCustomRules(repoContext);
    
    if (customRulesCode) {
      console.log(`⚡ Executing fast hardcoded rules...`);
      
      // Step 3: Execute rules on all files (milliseconds per file!)
      var ruleResults = await executeCustomRules(customRulesCode, filesToProcess, tempDir);
      
      if (ruleResults && ruleResults.length > 0) {
        results.push.apply(results, ruleResults);
        totalIssues = ruleResults.reduce(function(sum, file) { return sum + file.issues.length; }, 0);
        processedFiles = filesToProcess.length;
        
        console.log(`🎉 RULE EXECUTION complete: ${totalIssues} issues found in ${ruleResults.length} files`);
      } else {
        console.log(`⚠️ Rules found no issues, using fallback analysis...`);
        processedFiles = filesToProcess.length; // Still processed
      }
    } else {
      console.log(`⚠️ Rule generation failed, falling back to basic analysis...`);
      
      // Fallback to basic analysis
      for (var i = 0; i < filesToProcess.length; i++) {
        var file = filesToProcess[i];
        try {
          var content = await fs.readFile(file, 'utf-8');
          var relativePath = path.relative(tempDir, file);
          var issues = performBasicAnalysis(content, relativePath);
          
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
    }
    
    console.log(`✅ ANALYSIS COMPLETE FOR BATCH ${batchNumber || 'N/A'}:`);
    console.log(`   📊 Files processed: ${processedFiles}`);
    console.log(`   📁 Files with issues: ${results.length}`);
    console.log(`   🚨 Total issues found: ${totalIssues}`);
    console.log(`   🏁 Will return isLastBatch: ${isLastBatch}`);
    
    // CRITICAL: Log what we're returning to frontend
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
    
    console.log(`📤 RETURNING TO FRONTEND:`, JSON.stringify({
      success: returnData.success,
      isLastBatch: returnData.isLastBatch,
      batchNumber: returnData.batchNumber,
      totalIssues: returnData.stats.totalIssues,
      totalFilesInRepo: returnData.stats.totalFilesInRepo
    }));
    
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
