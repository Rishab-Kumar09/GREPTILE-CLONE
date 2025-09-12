'use client'

import { useState, useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import DashboardHeader from '@/components/DashboardHeader'

interface AnalysisResult {
  type: string
  name: string
  message?: string
  file: string
  line: number
  code: string
  description: string
  severity?: string
}

interface AnalysisStatus {
  status: string
  progress: number
  currentFile: string
  results: AnalysisResult[]
  totalFilesAnalyzed?: number
  totalFilesInRepo?: number
}

interface ChatMessage {
  id: number
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  citations: Array<{
    file: string
    line?: number
    snippet?: string
  }>
}

export default function EnterpriseAnalysisPage() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/facebook/react')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>({
    status: 'idle',
    progress: 0,
    currentFile: '',
    results: []
  })
  const [expandedFiles, setExpandedFiles] = useState<{[key: string]: boolean}>({})
  const [resultsExpanded, setResultsExpanded] = useState(true) // New: overall results collapse/expand
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)



  const groupResultsByFile = (results: AnalysisResult[]) => {
    const grouped = results.reduce((acc, result) => {
      if (!acc[result.file]) {
        acc[result.file] = {
          file: result.file,
          codeSmells: [],
          bugs: [],
          suggestions: []
        }
      }
      
      // Categorize by severity and type like Reviews page
      const severity = result.severity?.toLowerCase() || '';
      const type = result.type?.toLowerCase() || '';
      const description = result.description || '';
      
      // HIGH/CRITICAL PRIORITY -> Bugs
      if (severity === 'critical' || severity === 'high' || 
          type === 'security' || type === 'error-handling' || type === 'connectivity' ||
          description.includes('HIGH:') || description.includes('CRITICAL:') ||
          description.includes('will crash') || description.includes('vulnerability')) {
        acc[result.file].bugs.push({
          line: result.line,
          type: result.name || result.message || 'Security Issue',
          description: result.description,
          codeSnippet: result.code,
          suggestion: getAISuggestion(result.type, result.name, result.description)
        })
      } 
      // MEDIUM PRIORITY -> Code Smells
      else if (severity === 'medium' || 
               type === 'performance' || type === 'maintainability' || type === 'architecture' ||
               description.includes('MEDIUM:') ||
               description.includes('optimization') || description.includes('refactor')) {
        acc[result.file].codeSmells.push({
          line: result.line,
          type: result.name || result.message || 'Code Quality Issue',
          description: result.description,
          codeSnippet: result.code,
          suggestion: getAISuggestion(result.type, result.name, result.description)
        })
      } 
      // LOW/INFO PRIORITY -> Suggestions
      else {
        acc[result.file].suggestions.push({
          line: result.line,
          type: result.name || result.message || 'Suggestion',
          description: result.description,
          codeSnippet: result.code,
          suggestion: getAISuggestion(result.type, result.name, result.description)
        })
      }
      
      return acc
    }, {} as {[key: string]: any})

    return Object.values(grouped)
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'security': return '🔒'
      case 'function': return '⚡'
      case 'component': return '🧩'
      case 'import': return '📦'
      case 'api': return '🌐'
      case 'database': return '🗄️'
      case 'config': return '⚙️'
      case 'performance': return '🚀'
      case 'type': return '📝'
      default: return '💡'
    }
  }

  const getSeverityColor = (description: string) => {
    if (description.includes('HIGH:')) {
      return 'text-red-600 bg-red-100'
    } else if (description.includes('MEDIUM:')) {
      return 'text-yellow-600 bg-yellow-100'  
    } else {
      return 'text-blue-600 bg-blue-100'
    }
  }

  const getSeverityLevel = (description: string) => {
    if (description.includes('HIGH:')) return 'High'
    if (description.includes('MEDIUM:')) return 'Medium'
    return 'Info'
  }

  const getAISuggestion = (type: string, name: string, description: string) => {
    // Generate SPECIFIC suggestions based on the actual issue message
    if (name.includes('Hardcoded project name')) {
      return 'Use a variable or configuration for the project name. Consider moving this to an environment variable or a config file that can be easily updated without code changes.'
    }
    
    if (name.includes('Code block language identifier')) {
      return 'Change \'```\' to \'```bash\' or \'```javascript\' to specify the correct language for the code block. This improves syntax highlighting and readability.'
    }
    
    if (name.includes('Unclear instructions')) {
      return 'Specify whether the user can perform left-click or right-click actions. Add more context about the expected user interaction to avoid confusion.'
    }
    
    if (name.includes('security warning for entering IP')) {
      return 'Add a note about the security implications of entering the PC\'s IP address. Consider warning users about network security risks.'
    }
    
    if (name.includes('Hardcoded IP address')) {
      return 'Move IP addresses to environment variables or configuration files. Hardcoded IPs make the application difficult to deploy across different environments.'
    }
    
    if (name.includes('Debug statement should be removed')) {
      return 'Remove console.log, print(), or similar debug statements before deploying to production. Consider using a proper logging library with log levels instead.'
    }
    
    if (name.includes('Unresolved TODO/FIXME')) {
      return 'Address this TODO/FIXME comment by either implementing the required changes or removing the comment if it\'s no longer relevant.'
    }
    
    if (name.includes('Potential hardcoded credential')) {
      return 'Never hardcode passwords, API keys, or tokens in source code. Move these to environment variables and use a secrets management system.'
    }
    
    if (name.includes('SQL injection vulnerability')) {
      return 'Use parameterized queries or prepared statements to prevent SQL injection attacks. Never concatenate user input directly into SQL queries.'
    }
    
    if (name.includes('API call without error handling')) {
      return 'Add proper error handling with try-catch blocks or .catch() methods. Consider implementing retry logic and user-friendly error messages.'
    }
    
    if (name.includes('Using "any" type')) {
      return 'Replace "any" with specific TypeScript types to improve type safety and catch potential errors at compile time. Define interfaces for complex objects.'
    }
    
    if (name.includes('Environment variable without fallback')) {
      return 'Provide fallback values for environment variables using || or ?? operators. This prevents runtime errors when environment variables are not set.'
    }
    
    if (name.includes('Long function signature')) {
      return 'Consider breaking this long function into smaller, more focused functions. Use parameter objects for functions with many parameters.'
    }
    
    if (name.includes('Nested loop detected')) {
      return 'Optimize nested loops by using more efficient algorithms, caching results, or breaking early when possible. Consider using array methods like map, filter, or reduce.'
    }
    
    if (name.includes('Synchronous file operation')) {
      return 'Replace synchronous file operations with asynchronous alternatives (fs.readFile instead of fs.readFileSync) to avoid blocking the event loop.'
    }

    // Fallback to generic suggestions by type
    const genericSuggestions: {[key: string]: string} = {
      'function': 'Consider adding JSDoc comments to document this function\'s purpose, parameters, and return value.',
      'component': 'Ensure this component follows React best practices with proper prop types and error boundaries.',
      'import': 'Review this import to ensure it\'s necessary and consider tree-shaking to reduce bundle size.',
      'api': 'Add proper error handling, loading states, and timeout configuration for better user experience.',
      'security': 'This appears to contain sensitive information. Move secrets to environment variables.',
      'config': 'Ensure configuration values are properly validated and have fallback defaults.',
      'performance': 'This pattern might impact performance. Consider optimization techniques like memoization.',
      'type': 'Consider making types more specific and adding documentation comments.',
      'smell': 'Review this code smell and consider refactoring for better maintainability.',
      'bestpractice': 'Follow established best practices for this technology stack and coding standards.'
    }
    
    return genericSuggestions[type] || 'Review this code pattern for potential improvements in readability, maintainability, and performance.'
  }

  const sendChatMessage = async (message: string) => {
    if (!message.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date(),
      citations: []
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      const response = await fetch('/api/chat/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          repository: `${owner}/${repo}`,
          chatHistory: chatMessages.slice(-10) // Keep recent chat history for context
        })
      })

      const data = await response.json()

      if (data.success) {
        const aiMessage: ChatMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.response,
          timestamp: new Date(),
          citations: data.citations || []
        }
        setChatMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(data.error || 'Failed to get AI response')
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        citations: []
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  const shouldUseBatching = async (owner: string, repo: string) => {
    try {
      setStatus(prev => ({
        ...prev,
        progress: 20,
        currentFile: 'Analyzing repository size...'
      }))

      // Get repository info from GitHub API
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
      if (!response.ok) {
        console.warn('⚠️ Could not fetch repo info, defaulting to full analysis')
        return false
      }

      const repoInfo = await response.json()
      
      // Decision criteria for batching
      const size = repoInfo.size || 0 // Size in KB
      const stargazers = repoInfo.stargazers_count || 0
      const language = repoInfo.language || ''
      
      console.log(`📊 Repository stats:`, {
        size: `${Math.round(size / 1024)}MB`,
        stars: stargazers,
        language,
        name: `${owner}/${repo}`
      })

      // Batching criteria (multiple factors)
      const sizeThreshold = size > 50000 // >50MB
      const popularRepo = stargazers > 10000 // Popular repos tend to be large
      const knownLargeLanguages = ['Go', 'C', 'C++', 'Java', 'JavaScript', 'TypeScript'].includes(language)
      
      // Known massive repos (backup check)
      const knownMassive = [
        'kubernetes', 'tensorflow', 'microsoft', 'facebook', 'google', 
        'apache', 'nodejs', 'rust-lang', 'golang', 'dotnet'
      ].some(org => `${owner}/${repo}`.toLowerCase().includes(org))

      // 🎯 SMART BATCHING: Only batch truly large repos, let small repos use fast regex-only processing
      const shouldBatch = sizeThreshold || (popularRepo && knownLargeLanguages) || knownMassive
      
      console.log(`🤖 Batching decision: SMART ROUTING`, {
        sizeThreshold,
        popularRepo,
        knownLargeLanguages,
        knownMassive,
        finalDecision: shouldBatch,
        reasoning: shouldBatch ? 'LARGE REPO → Batched analysis' : 'SMALL REPO → Simple regex-only analysis'
      })

      return shouldBatch

    } catch (error) {
      console.error('❌ Size check failed:', error)
      // Default to simple analysis for unknown repos (fast regex-only)
      return false
    }
  }



  // 🔄 ADAPTIVE BATCH SPLITTING STRATEGY: Handle both normal repos AND massive-file repos
  const retryWithSmallerBatches = async (
    owner: string, 
    repo: string, 
    originalBatchNumber: number, 
    allResults: AnalysisResult[], 
    setTotalIssues: (callback: (prev: number) => number) => void
  ): Promise<boolean> => {
    console.log(`🔄 Attempting ADAPTIVE batch splitting for batch ${originalBatchNumber}...`);
    
    try {
      // 🧠 DETECT REPO TYPE: Check if this is a "vibe-coded" repo (few files, massive content)
      const repoInfo = await fetch(`https://api.github.com/repos/${owner}/${repo}`).then(r => r.json()).catch(() => ({}));
      const isVibeCodedRepo = repoInfo.size && repoInfo.size < 10000 && // Small repo size (<10MB)
                              (repo.toLowerCase().includes('jarvis') || 
                               repo.toLowerCase().includes('monolith') ||
                               repo.toLowerCase().includes('single'));
      
      console.log(`🎯 Repo analysis:`, {
        repoSize: `${Math.round((repoInfo.size || 0) / 1024)}MB`,
        isVibeCodedRepo,
        repoName: `${owner}/${repo}`
      });
      
      const filesPerBatch = 200;
      const startFile = (originalBatchNumber - 1) * filesPerBatch;
      
      let subBatches;
      
      if (isVibeCodedRepo) {
        // 🎯 VIBE-CODED STRATEGY: Split into NANO batches for massive files
        console.log(`🧠 Detected vibe-coded repo - using NANO batch strategy`);
        const nanoBatchSize = 1; // NANO: Only 1 file per batch for extreme cases
        // Create batches for each individual file
        subBatches = [];
        for (let j = 0; j < Math.min(filesPerBatch, 50); j++) { // Max 50 nano batches
          subBatches.push({
            start: startFile + j,
            size: nanoBatchSize,
            type: 'nano'
          });
        }
        console.log(`📦 NANO BATCHING: Splitting into ${subBatches.length} nano-batches of ${nanoBatchSize} file each`);
      } else {
        // 🎯 NORMAL STRATEGY: Split into smaller batches for regular repos
        console.log(`📊 Regular repo - using standard batch splitting`);
        const smallerBatchSize = Math.floor(filesPerBatch / 2);
        subBatches = [
          { start: startFile, size: smallerBatchSize, type: 'standard' },
          { start: startFile + smallerBatchSize, size: smallerBatchSize, type: 'standard' }
        ];
        console.log(`📦 STANDARD SPLITTING: Splitting into ${subBatches.length} smaller batches of ${smallerBatchSize} files each`);
      }
      
      console.log(`🔧 Batch splitting strategy:`, {
        originalBatch: originalBatchNumber,
        strategy: isVibeCodedRepo ? 'NANO (vibe-coded)' : 'STANDARD (normal)',
        subBatches: subBatches.length,
        filesPerSubBatch: subBatches[0]?.size
      });
      
      let overallSuccess = false;
      
      for (let i = 0; i < subBatches.length; i++) {
        const subBatch = subBatches[i];
        const batchType = subBatch.type || 'standard';
        
        console.log(`🔄 Processing ${batchType} sub-batch ${i + 1}/${subBatches.length} (files ${subBatch.start}-${subBatch.start + subBatch.size})`);
        
        try {
          // Use a special batch number to indicate this is a sub-batch
          // Format: originalBatch.subBatch (e.g., 5.1, 5.2)
          const subBatchNumber = parseFloat(`${originalBatchNumber}.${i + 1}`);
          
          const controller = new AbortController();
          // 🎯 NANO STRATEGY: Super short timeouts for single-file batches
          const timeoutDuration = batchType === 'nano' ? 20000 : 120000; // 20s for nano, 2min for standard
          const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
          
          console.log(`⏱️ Using ${timeoutDuration / 1000}s timeout for ${batchType} batch`);
          
          // 🎯 UPDATE UI STATUS for different batch types
          setStatus(prev => ({
            ...prev,
            currentFile: batchType === 'ultra-micro' ? 
              `Processing molecular batch ${i + 1}/${subBatches.length} (${subBatch.size} files, 28s timeout)...` :
              `Processing sub-batch ${i + 1}/${subBatches.length} (${subBatch.size} files)...`
          }));
          
          const response = await fetch('/api/enterprise-analysis/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              owner, 
              repo, 
              batchNumber: subBatchNumber,
              fullRepoAnalysis: true,
              customBatchSize: subBatch.size, // Tell Lambda to use smaller batch size
              customStartIndex: subBatch.start    // Tell Lambda where to start
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const issueCount = data.results?.length || 0;
              console.log(`✅ ${batchType.toUpperCase()} sub-batch ${i + 1} successful: ${issueCount} issues found`);
              
              // Add results to main collection
              if (data.results && data.results.length > 0) {
                allResults.push(...data.results);
                setTotalIssues(prev => prev + data.results.length);
              }
              
              overallSuccess = true;
              
              // 🎯 UPDATE UI STATUS with success message
              setStatus(prev => ({
                ...prev,
                currentFile: batchType === 'ultra-micro' ? 
                  `✅ Molecular batch ${i + 1}/${subBatches.length} complete: ${issueCount} issues (28s)` :
                  `✅ Sub-batch ${i + 1}/${subBatches.length} complete: ${issueCount} issues`
              }));
              
            } else {
              console.warn(`⚠️ ${batchType.toUpperCase()} sub-batch ${i + 1} failed:`, data.error);
              setStatus(prev => ({
                ...prev,
                currentFile: `⚠️ ${batchType === 'ultra-micro' ? 'Molecular batch' : 'Sub-batch'} ${i + 1} failed: ${data.error}`
              }));
            }
          } else {
            console.warn(`⚠️ ${batchType.toUpperCase()} sub-batch ${i + 1} HTTP error: ${response.status}`);
            setStatus(prev => ({
              ...prev,
              currentFile: `⚠️ ${batchType === 'ultra-micro' ? 'Molecular batch' : 'Sub-batch'} ${i + 1} HTTP error: ${response.status}`
            }));
          }
          
          // 🎯 MOLECULAR DELAYS: Short delays for rapid processing
          if (i < subBatches.length - 1) {
            const delayTime = batchType === 'ultra-micro' ? 1000 : 2000; // 1s for molecular, 2s for standard
            console.log(`⏳ Waiting ${delayTime / 1000}s before next ${batchType} batch...`);
            await new Promise(resolve => setTimeout(resolve, delayTime));
          }
          
        } catch (subBatchError) {
          console.error(`❌ Sub-batch ${i + 1} error:`, subBatchError);
          // Continue with next sub-batch even if this one fails
        }
      }
      
      const successMessage = isVibeCodedRepo ? 
        `${overallSuccess ? '✅' : '❌'} MOLECULAR batch splitting complete for vibe-coded repo` :
        `${overallSuccess ? '✅' : '❌'} Standard batch splitting complete`;
      
      console.log(successMessage);
      
      // 🎯 FINAL UI STATUS UPDATE
      setStatus(prev => ({
        ...prev,
        currentFile: overallSuccess ? 
          `✅ Batch ${originalBatchNumber} completed with ${isVibeCodedRepo ? 'molecular' : 'standard'} splitting strategy` :
          `⚠️ Batch ${originalBatchNumber} failed even with ${isVibeCodedRepo ? 'molecular' : 'standard'} splitting`
      }));
      
      return overallSuccess;
      
    } catch (error) {
      console.error(`❌ ADAPTIVE batch splitting failed for batch ${originalBatchNumber}:`, error);
      setStatus(prev => ({
        ...prev,
        currentFile: `❌ Batch ${originalBatchNumber} splitting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
      return false;
    }
  };

  const startBatchedAnalysis = async (owner: string, repo: string) => {
    console.log('🚀 Starting FILE-BASED BATCHED analysis (full repo, process in chunks)')
    
    // FILE-BASED BATCHING: Clone full repo, process files in batches
    const allResults: AnalysisResult[] = []
    let totalIssues = 0
    let batchNumber = 1
    let estimatedTotalBatches = 8 // Start with reasonable estimate, will update dynamically
    let totalFilesInRepo = 0
    let totalFilesProcessed = 0
    
    setAnalysisId(uuid())

    // Process files in batches (no directory filtering - analyze ALL files)
    while (true) {
      // Dynamic progress calculation - slower progression as we don't know exact total
      const batchProgress = Math.min((batchNumber / (batchNumber + 5)) * 90, 95) // Slower, asymptotic approach to 95%
      
      setStatus(prev => ({
        ...prev,
        progress: Math.round(batchProgress),
        currentFile: `Analyzing repository files...`
      }))

      console.log(`🔄 Processing file batch ${batchNumber}`)

                   try {
               console.log(`🔄 Starting batch ${batchNumber} with timeout handling...`);
               
               const controller = new AbortController();
               const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
               
               const response = await fetch('/api/enterprise-analysis/start', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ 
                   owner, 
                   repo, 
                   batchNumber, // Send batch number instead of directory path
                   fullRepoAnalysis: true // Flag to indicate full repo analysis
                 }),
                 signal: controller.signal
               });

               clearTimeout(timeoutId);

               if (!response.ok) {
                 throw new Error(`HTTP ${response.status}: ${response.statusText}`);
               }

               let data;
               try {
                 data = await response.json();
               } catch (jsonError) {
                 console.error(`❌ JSON parsing failed for batch ${batchNumber}:`, jsonError);
                 throw new Error(`Invalid JSON response from batch ${batchNumber}`);
               }
        console.log(`📡 File batch ${batchNumber} response:`, data)
        console.log(`🔍 FRONTEND DEBUG - isLastBatch value:`, data.isLastBatch, typeof data.isLastBatch)
        console.log(`🔍 FRONTEND DEBUG - success value:`, data.success, typeof data.success)
        console.log(`🔍 FRONTEND DEBUG - results:`, data.results?.length || 0)

        if (data.success) {
                           // Update estimated total batches based on Lambda stats
                 if (data.stats && data.stats.totalFilesInRepo) {
                   totalFilesInRepo = data.stats.totalFilesInRepo
                   const filesPerBatch = 200 // Match Lambda batch size 
                   const actualTotalBatches = Math.ceil(data.stats.totalFilesInRepo / filesPerBatch)
                   if (actualTotalBatches !== estimatedTotalBatches) {
                     estimatedTotalBatches = actualTotalBatches
                     console.log(`📊 Updated estimate: ${estimatedTotalBatches} total batches (200 files each) based on ${data.stats.totalFilesInRepo} files`)
                   }
                 }
                 
                 // Track files processed
                 if (data.stats && data.stats.filesProcessed) {
                   totalFilesProcessed += data.stats.filesProcessed
                 }
          
          // Add results if any exist
          if (data.results && data.results.length > 0) {
            allResults.push(...data.results)
            totalIssues += data.results.length
            console.log(`✅ File batch ${batchNumber} complete: ${data.results.length} issues found`)
            
            // 🤖 SEND BATCH RESULTS TO CHAT API FOR CONTEXT BUILDING
            try {
              const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
              await fetch('/api/chat/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  repository: `${owner}/${repo}`,
                  batchNumber: batchNumber,
                  batchResults: data.results,
                  isLastBatch: data.isLastBatch
                })
              })
              console.log(`📤 Sent batch ${batchNumber} results to chat context`)
            } catch (chatError) {
              console.warn(`⚠️ Failed to update chat context for batch ${batchNumber}:`, chatError)
            }
          } else {
            console.log(`✅ File batch ${batchNumber} complete: 0 issues found`)
          }
          
          // Check if this was the final batch (ALWAYS CHECK, regardless of results)
          console.log(`🚨 CHECKING isLastBatch: ${data.isLastBatch} (type: ${typeof data.isLastBatch})`)
          if (data.isLastBatch) {
            console.log(`🏁 Final batch reached - analysis complete`)
            console.log(`🛑 BREAKING OUT OF BATCH LOOP NOW!`)
            break
          } else {
            console.log(`➡️ isLastBatch is false, continuing to next batch...`)
          }
          
          batchNumber++
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } else {
          console.warn(`⚠️ File batch ${batchNumber} failed:`, data.error)
          break
        }

                   } catch (error: any) {
               console.error(`❌ File batch ${batchNumber} error:`, error);
               
               // Handle specific error types
               if (error.name === 'AbortError') {
                 console.warn(`⏰ Batch ${batchNumber} timed out after 5 minutes - attempting batch splitting...`);
                 
                 // 🔄 BATCH SPLITTING STRATEGY: Split the timed-out batch into smaller chunks
                 const success = await retryWithSmallerBatches(owner, repo, batchNumber, allResults, (callback) => {
                   totalIssues = callback(totalIssues);
                 });
                 
                 if (success) {
                   console.log(`✅ Batch ${batchNumber} successfully processed with smaller chunks`);
                 } else {
                   console.warn(`⚠️ Batch ${batchNumber} failed even with smaller chunks - skipping`);
                 }
                 
                 setStatus(prev => ({
                   ...prev,
                   currentFile: success ? `Batch ${batchNumber} completed with smaller chunks` : `Batch ${batchNumber} skipped after splitting attempts`
                 }));
                 
                 batchNumber++;
                 continue;
               }
               
               if ((error instanceof Error && error.message.includes('504')) || (error instanceof Error && error.message.includes('Gateway'))) {
                 console.warn(`🌐 Gateway timeout for batch ${batchNumber} - trying batch splitting...`);
                 
                 // 🔄 BATCH SPLITTING STRATEGY: Try splitting the batch instead of simple retry
                 const success = await retryWithSmallerBatches(owner, repo, batchNumber, allResults, (callback) => {
                   totalIssues = callback(totalIssues);
                 });
                 
                 if (success) {
                   console.log(`✅ Batch ${batchNumber} successfully processed with smaller chunks after gateway timeout`);
                   setStatus(prev => ({
                     ...prev,
                     currentFile: `Batch ${batchNumber} completed with smaller chunks`
                   }));
                 } else {
                   console.warn(`⚠️ Batch ${batchNumber} failed even with smaller chunks after gateway timeout`);
                   setStatus(prev => ({
                     ...prev,
                     currentFile: `Batch ${batchNumber} skipped after splitting attempts`
                   }));
                 }
                 
                 batchNumber++;
                 continue;
               }
               
               // For other errors, continue to next batch
               console.warn(`⚠️ Skipping batch ${batchNumber} due to error, continuing...`);
               batchNumber++;
               continue;
             }
      
                   // Safety limit to prevent infinite loops (only if isLastBatch logic fails)
             if (batchNumber > 100) {
               console.warn('⚠️ Reached maximum batch limit (100), stopping - this indicates isLastBatch logic may be broken')
               break
             }
    }

    // Final results
    console.log(`🎉 FILE-BASED BATCHED ANALYSIS COMPLETE: ${totalIssues} total issues from ${batchNumber} batches`)
    
    // Auto-expand all files
    const fileGroups = groupResultsByFile(allResults)
    const autoExpandedFiles: {[key: string]: boolean} = {}
    fileGroups.forEach(fileGroup => {
      autoExpandedFiles[fileGroup.file] = true
    })
    setExpandedFiles(autoExpandedFiles)
    
    setStatus({
      status: 'completed',
      progress: 100,
      currentFile: `FILE-BASED ANALYSIS COMPLETE: ${totalIssues} issues found from full repository`,
      results: allResults,
      totalFilesAnalyzed: totalFilesProcessed,
      totalFilesInRepo: totalFilesInRepo
    })
    
    setIsAnalyzing(false)
  }

  const startSimpleAnalysis = async (owner: string, repo: string) => {
    setStatus(prev => ({
      ...prev,
      progress: 30,
      currentFile: 'Analyzing repository...'
    }))

    try {
      console.log('🔄 Making simple REGEX-ONLY analysis API request with timeout...')
      
      // 🎯 UI-ONLY TIMEOUT: Give up after 25 seconds for small repos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
      
      const response = await fetch('/api/enterprise-analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        owner, 
        repo,
        analysisId: uuid(), // Regular analysis ID
        regexOnly: true // 🎯 REGEX-ONLY FLAG: Skip AI analysis for small repos
      }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data = await response.json()
      console.log('📡 Simple analysis response:', data)

    if (data.success) {
      setAnalysisId(data.analysisId)
      
      // Handle direct results
      if (data.results && data.results.length > 0) {
        console.log(`🎉 Got ${data.results.length} results directly from Lambda!`)
        
        // Auto-expand all files
        const fileGroups = groupResultsByFile(data.results)
        const autoExpandedFiles: {[key: string]: boolean} = {}
        fileGroups.forEach(fileGroup => {
          autoExpandedFiles[fileGroup.file] = true
        })
        setExpandedFiles(autoExpandedFiles)
        
        setStatus({
          status: 'completed',
          progress: 100,
          currentFile: data.message || 'Analysis completed!',
          results: data.results
        })
      } else {
        setStatus({
          status: 'completed',
          progress: 100,
          currentFile: 'Analysis completed - no code patterns found',
          results: []
        })
      }
      
    } else {
      setStatus({
        status: 'failed',
        progress: 0,
        currentFile: `Error: ${data.error}`,
        results: []
      })
    }
    
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('⏰ Simple analysis timed out after 25 seconds - this indicates Lambda is doing AI analysis even for small repos');
        setStatus({
          status: 'failed',
          progress: 0,
          currentFile: 'Analysis timed out - Lambda is doing unnecessary AI analysis for small repo. Regex patterns should be sufficient for repos like this.',
          results: []
        })
      } else {
        setStatus({
          status: 'failed',
          progress: 0,
          currentFile: `Error: ${error.message}`,
          results: []
        })
      }
    }
    
    setIsAnalyzing(false)
  }

  const startAnalysis = async () => {
    if (!repoUrl.includes('github.com')) {
      alert('Please enter a valid GitHub URL')
      return
    }

    setIsAnalyzing(true)
    setStatus({
      status: 'analyzing',
      progress: 50,
      currentFile: 'Calling Lambda function...',
      results: []
    })

    try {
      const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
      
      // Check if this is a large repo that needs batching
      console.log('📏 Checking if batching is needed...')
      const needsBatching = await shouldUseBatching(owner, repo)

      if (needsBatching) {
        console.log('🔄 LARGE REPO - Using batched analysis strategy')
        await startBatchedAnalysis(owner, repo)
      } else {
        console.log('🔄 SMALL REPO - Using fast regex-only analysis')
        await startSimpleAnalysis(owner, repo)
      }
      
    } catch (error) {
      console.error('❌ Analysis failed:', error)
      setStatus({
        status: 'failed',
        progress: 0,
        currentFile: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        results: []
      })
      setIsAnalyzing(false)
    }
  }

  const startFullAnalysis = async (owner: string, repo: string) => {
    setStatus(prev => ({
      ...prev,
      progress: 30,
      currentFile: 'Analyzing full repository...'
    }))

    console.log('🔄 Making full analysis API request...')
    const response = await fetch('/api/enterprise-analysis/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo })
    })

    const data = await response.json()
    console.log('📡 Full analysis response:', data)

    if (data.success) {
      setAnalysisId(data.analysisId)
      
      // Handle direct results (no polling needed)
      if (data.results && data.results.length > 0) {
        console.log(`🎉 Got ${data.results.length} results directly from Lambda!`)
        
        // Auto-expand all files like Reviews page
        const fileGroups = groupResultsByFile(data.results)
        const autoExpandedFiles: {[key: string]: boolean} = {}
        fileGroups.forEach(fileGroup => {
          autoExpandedFiles[fileGroup.file] = true
        })
        setExpandedFiles(autoExpandedFiles)
        
        setStatus({
          status: 'completed',
          progress: 100,
          currentFile: data.message || 'Analysis completed!',
          results: data.results
        })
        
        // 🤖 SEND NON-BATCHING RESULTS TO CHAT API FOR CONTEXT
        try {
          console.log(`📤 Sending ${data.results.length} non-batching results to chat context`)
          await fetch('/api/chat/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repository: `${owner}/${repo}`,
              batchNumber: 1, // Single batch for non-batching analysis
              batchResults: data.results,
              isLastBatch: true
            })
          })
          console.log(`✅ Non-batching results sent to chat context successfully`)
        } catch (chatError) {
          console.warn(`⚠️ Failed to update chat context for non-batching analysis:`, chatError)
        }
      } else if (data.status === 'completed') {
        // Lambda completed but no results
        setStatus({
          status: 'completed',
          progress: 100,
          currentFile: 'Analysis completed - no code patterns found',
          results: []
        })
        
        // 🤖 SEND EMPTY RESULTS TO CHAT API FOR CONTEXT (so AI knows analysis was done)
        try {
          console.log(`📤 Sending empty results to chat context (analysis completed with no issues)`)
          await fetch('/api/chat/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repository: `${owner}/${repo}`,
              batchNumber: 1,
              batchResults: [], // Empty but analysis was done
              isLastBatch: true
            })
          })
          console.log(`✅ Empty results sent to chat context successfully`)
        } catch (chatError) {
          console.warn(`⚠️ Failed to update chat context for empty analysis:`, chatError)
        }
      } else {
        // No results - show error
        setStatus({
          status: 'failed',
          progress: 0,
          currentFile: data.error || 'No results returned',
          results: []
        })
      }
      
    } else {
      setStatus({
        status: 'failed',
        progress: 0,
        currentFile: `Error: ${data.error}`,
        results: []
      })
    }
    
    setIsAnalyzing(false)
  }




  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader currentPage="enterprise-analysis" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            Quick Analysis
          </h1>
          <p className="text-gray-600">
            Competitor-inspired analysis: Incremental, Priority-based, and Streaming Results
          </p>
        </div>

        {/* Analysis Strategy Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-500">⚡</span>
              <h3 className="font-semibold text-gray-900">Incremental Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Like Greptile - Only analyze changed files since last scan
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">🕒</span>
              <span className="text-gray-500">30 seconds - 2 minutes</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-500">🎯</span>
              <h3 className="font-semibold text-gray-900">Priority Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Like SonarQube - Critical files first, stream results
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-600">🕒</span>
              <span className="text-gray-500">2-5 minutes</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-500">🔍</span>
              <h3 className="font-semibold text-gray-900">Full Analysis</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Complete analysis with background processing
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600">🕒</span>
              <span className="text-gray-500">5-30 minutes</span>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isAnalyzing}
              />
            </div>
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Start Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Analysis Progress */}
        {(isAnalyzing || status.status !== 'idle') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Progress</h2>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{status.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                status.status === 'completed' ? 'bg-green-500' :
                status.status === 'failed' ? 'bg-red-500' :
                'bg-blue-500 animate-pulse'
              }`}></div>
              <span>{status.currentFile || 'Processing...'}</span>
            </div>
          </div>
        )}

        {/* AI Summary */}
        {status.results.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>🤖</span>
              AI-Generated Analysis Summary
            </h3>
            <p className="text-gray-700">
              This analysis identified <strong>{status.results.length} issues</strong> across <strong>{groupResultsByFile(status.results).length} files</strong> in the repository. 
              The AI Orchestra Manager intelligently analyzed the repository and prioritized critical issues.
              Key areas requiring attention include potential security vulnerabilities, performance optimizations, 
              and code quality improvements that could enhance application stability and maintainability.
            </p>
          </div>
        )}

        {/* Analysis Stats */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {status.results.filter((r: any) => 
                    r.severity === 'critical' || r.severity === 'high'
                  ).length}
                </div>
                <div className="text-sm text-gray-500">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {status.results.filter((r: any) => 
                    r.severity === 'medium'
                  ).length}
                </div>
                <div className="text-sm text-gray-500">Medium Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {status.results.filter((r: any) => 
                    r.severity === 'low' || r.severity === 'info' || r.severity === 'informational'
                  ).length}
                </div>
                <div className="text-sm text-gray-500">Informational</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{status.results.length}</div>
                <div className="text-sm text-gray-500">Total Issues</div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section - EXACT Reviews Page Format with Overall Collapse */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Overall Results Header with Collapse/Expand */}
            <div 
              className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => setResultsExpanded(!resultsExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <svg 
                    className={`w-5 h-5 transform transition-transform ${resultsExpanded ? 'rotate-90' : ''}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <h2 className="text-xl font-bold text-gray-900">Analysis Results</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {status.results.length} issues found
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {resultsExpanded ? 'Click to collapse' : 'Click to expand'}
                </span>
              </div>
            </div>

            {/* Collapsible Results Content */}
            {resultsExpanded && (
              <div className="p-4 space-y-4">
                {groupResultsByFile(status.results).map((fileResult, fileIndex) => (
              <div key={fileIndex} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <span className="text-yellow-600 text-lg">📁</span>
                    <h3 className="text-lg font-semibold text-gray-900">{fileResult.file}</h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                      {(fileResult.bugs?.length || 0) + (fileResult.codeSmells?.length || 0) + (fileResult.suggestions?.length || 0)} issues
                    </span>
                  </div>
                </div>

                <div className="p-6">
                    {/* Bugs - High Priority Issues */}
                    {fileResult.bugs?.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center mb-3">
                          <span className="text-red-600 text-lg mr-2">🔥</span>
                          <h6 className="font-medium text-red-700">Bugs ({fileResult.bugs.length}):</h6>
                        </div>
                        {fileResult.bugs.map((bug: any, bugIndex: number) => (
                          <div key={bugIndex} className="mb-4 last:mb-0">
                            <h6 className="font-medium text-red-800 mb-2">Line {bug.line}: {bug.type}</h6>
                            {bug.codeSnippet && (
                              <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono mb-2 overflow-x-auto">
                                <span className="text-gray-400">Line {bug.line}:</span> {bug.codeSnippet}
                              </div>
                            )}
                            <p className="text-red-700 text-sm mb-2">{bug.description}</p>
                            {bug.suggestion && (
                              <p className="text-red-600 text-sm italic flex items-start">
                                <span className="mr-1">💡</span>
                                <span>{bug.suggestion}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Code Smells - EXACT Reviews Page Format */}
                    {fileResult.codeSmells?.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center mb-3">
                          <span className="text-yellow-600 text-lg mr-2">💡</span>
                          <h6 className="font-medium text-yellow-700">Code Smells ({fileResult.codeSmells.length}):</h6>
                        </div>
                        {fileResult.codeSmells.map((smell: any, smellIndex: number) => (
                          <div key={smellIndex} className="mb-4 last:mb-0">
                            <h6 className="font-medium text-yellow-800 mb-2">Line {smell.line}: {smell.type}</h6>
                            {smell.codeSnippet && (
                              <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono mb-2 overflow-x-auto">
                                <span className="text-gray-400">Line {smell.line}:</span> {smell.codeSnippet}
                              </div>
                            )}
                            <p className="text-yellow-700 text-sm mb-2">{smell.description}</p>
                            {smell.suggestion && (
                              <p className="text-yellow-600 text-sm italic flex items-start">
                                <span className="mr-1">💡</span>
                                <span>{smell.suggestion}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggestions - Other Issues */}
                    {fileResult.suggestions?.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center mb-3">
                          <span className="text-blue-600 text-lg mr-2">⚡</span>
                          <h6 className="font-medium text-blue-700">Suggestions ({fileResult.suggestions.length}):</h6>
                        </div>
                        {fileResult.suggestions.map((suggestion: any, suggestionIndex: number) => (
                          <div key={suggestionIndex} className="mb-4 last:mb-0">
                            <h6 className="font-medium text-blue-800 mb-2">Line {suggestion.line}: {suggestion.type}</h6>
                            {suggestion.codeSnippet && (
                              <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono mb-2 overflow-x-auto">
                                <span className="text-gray-400">Line {suggestion.line}:</span> {suggestion.codeSnippet}
                              </div>
                            )}
                            <p className="text-blue-700 text-sm mb-2">{suggestion.description}</p>
                            {suggestion.suggestion && (
                              <p className="text-blue-600 text-sm italic flex items-start">
                                <span className="mr-1">💡</span>
                                <span>{suggestion.suggestion}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Chat Section - Like Reviews Page */}
        {status.results.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span>🤖</span>
                AI Assistant
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Get answers with file citations and line references
              </p>
            </div>
            
            {/* Chat Messages */}
            <div className="max-h-80 overflow-y-auto p-4 space-y-4">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      
                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600 mb-1">📎 Sources:</p>
                          {msg.citations.map((citation, idx) => (
                            <div key={idx} className="text-xs bg-gray-50 rounded p-2 mb-1">
                              <div className="font-mono text-blue-600">
                                {citation.file}
                                {citation.line && `:${citation.line}`}
                              </div>
                              {citation.snippet && (
                                <div className="mt-1 bg-gray-900 text-gray-100 p-1 rounded text-xs font-mono">
                                  {citation.snippet}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-xs opacity-75 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Start a conversation about this repository</p>
                  <p className="text-xs mt-1">Ask about specific files, functions, or code patterns</p>
                </div>
              )}
              
              {/* Loading indicator */}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !chatLoading) {
                      sendChatMessage(chatInput)
                    }
                  }}
                  placeholder="Ask about this code... (e.g., 'How does authentication work?')"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  disabled={chatLoading}
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Try: "Fix the bug at line 1" or "How to resolve the security issue?" or "Show me exact code replacement"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}