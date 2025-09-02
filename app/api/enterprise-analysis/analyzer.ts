import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

interface AnalysisResult {
  file: string
  type: 'security' | 'bug' | 'smell' | 'api' | 'auth' | 'performance' | 'accessibility'
  message: string
  line: number
  code?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

export class EnterpriseAnalyzer {
  private tempDir: string
  private analysisId: string
  private repoUrl: string
  private results: AnalysisResult[] = []

  // Define patterns for analysis
  private PATTERNS = {
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
  }

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', `analysis-${Date.now()}`)
  }

  async start(repoUrl: string, analysisId: string) {
    this.repoUrl = repoUrl
    this.analysisId = analysisId
    
    try {
      console.log(`🚀 Starting analysis for ${repoUrl}`)
      
      await this.updateProgress(5, 'Initializing...')
      
      // 1. Clone repository
      await this.fastClone()
      await this.updateProgress(25, 'Repository cloned, scanning files...')
      
      // 2. Find all relevant files
      const files = await this.getAllFiles()
      await this.updateProgress(50, 'Files found, analyzing...')
      
      // 3. Analyze files in parallel batches
      await this.analyzeFiles(files)
      await this.updateProgress(90, 'Analysis complete, saving results...')
      
      // 4. Save all results
      await this.saveResults()
      await this.updateProgress(100, 'Analysis completed!')
      
      console.log(`✅ Analysis completed: ${this.results.length} issues found`)
      
    } catch (error) {
      console.error('Analysis failed:', error)
      await this.updateStatus({
        status: 'failed',
        progress: 0,
        currentFile: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      // Clean up
      await this.cleanup()
    }
  }

  private async fastClone(): Promise<void> {
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true })
      
      // Shallow clone for speed
      const cloneCmd = `git clone --depth 1 "${this.repoUrl}" "${this.tempDir}"`
      console.log(`📥 Cloning: ${cloneCmd}`)
      
      execSync(cloneCmd, { stdio: 'pipe' })
      console.log(`✅ Clone successful`)
      
    } catch (error) {
      console.error('Clone failed:', error)
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async getAllFiles(): Promise<string[]> {
    try {
      // Get all text files (not just JS/TS)
      const findCmd = process.platform === 'win32' 
        ? `dir /s /b "${this.tempDir}\\*.js" "${this.tempDir}\\*.ts" "${this.tempDir}\\*.jsx" "${this.tempDir}\\*.tsx" "${this.tempDir}\\*.json" "${this.tempDir}\\*.md"`
        : `find "${this.tempDir}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \\)`
      
      const output = execSync(findCmd, { stdio: 'pipe', encoding: 'utf-8' })
      const files = output.split('\n')
        .filter(Boolean)
        .filter(file => !file.includes('node_modules'))
        .filter(file => !file.includes('.git'))
        .slice(0, 100) // Limit for demo
      
      console.log(`📁 Found ${files.length} files to analyze`)
      return files
      
    } catch (error) {
      console.warn('File search failed, trying alternative approach:', error)
      
      // Fallback: manual directory traversal
      return await this.findFilesRecursively(this.tempDir)
    }
  }

  private async findFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const items = await fs.readdir(dir, { withFileTypes: true })
      
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue
        
        const fullPath = path.join(dir, item.name)
        
        if (item.isDirectory()) {
          const subFiles = await this.findFilesRecursively(fullPath)
          files.push(...subFiles)
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase()
          if (['.js', '.ts', '.jsx', '.tsx', '.json', '.md'].includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dir}:`, error)
    }
    
    return files.slice(0, 100) // Limit for demo
  }

  private async analyzeFiles(files: string[]): Promise<void> {
    console.log(`🔍 Analyzing ${files.length} files in parallel...`)
    
    // Process files in chunks of 10 for parallel processing
    const chunkSize = 10
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize)
      
      // Process chunk in parallel
      const chunkPromises = chunk.map(file => this.analyzeFile(file))
      await Promise.all(chunkPromises)
      
      // Update progress
      const progress = 50 + ((i + chunkSize) / files.length) * 40
      await this.updateProgress(Math.min(90, progress), `Analyzed ${Math.min(i + chunkSize, files.length)}/${files.length} files`)
    }
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const relativePath = path.relative(this.tempDir, filePath)
      const lines = content.split('\n')
      
      // Analyze content for patterns
      lines.forEach((line, index) => {
        const lineNum = index + 1
        const trimmedLine = line.trim()
        
        // Security patterns
        if (trimmedLine.includes('password') && trimmedLine.includes('=')) {
          this.results.push({
            file: relativePath,
            type: 'security',
            message: 'Potential hardcoded password detected',
            line: lineNum,
            code: trimmedLine,
            severity: 'high'
          })
        }
        
        if (trimmedLine.includes('console.log')) {
          this.results.push({
            file: relativePath,
            type: 'smell',
            message: 'Console statement found - remove before production',
            line: lineNum,
            code: trimmedLine,
            severity: 'low'
          })
        }
        
        if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
          this.results.push({
            file: relativePath,
            type: 'smell',
            message: 'TODO comment found',
            line: lineNum,
            code: trimmedLine,
            severity: 'medium'
          })
        }
        
        if (trimmedLine.includes('fetch(') || trimmedLine.includes('axios')) {
          this.results.push({
            file: relativePath,
            type: 'api',
            message: 'API call detected - verify error handling',
            line: lineNum,
            code: trimmedLine,
            severity: 'medium'
          })
        }
      })
      
    } catch (error) {
      console.warn(`Failed to analyze ${filePath}:`, error)
    }
  }

  private async saveResults(): Promise<void> {
    if (this.results.length === 0) {
      console.log('No issues found')
      return
    }
    
    // Group results by file
    const resultsByFile = this.results.reduce((acc, result) => {
      if (!acc[result.file]) {
        acc[result.file] = []
      }
      acc[result.file].push(result)
      return acc
    }, {} as Record<string, AnalysisResult[]>)
    
    // Convert to expected format
    const formattedResults = Object.entries(resultsByFile).map(([file, issues]) => ({
      file,
      issues: issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        line: issue.line,
        message: issue.message,
        code: issue.code
      }))
    }))
    
    // Save to database
    await this.updateStatus({
      status: 'completed',
      progress: 100,
      currentFile: 'Analysis completed!',
      results: formattedResults
    })
    
    console.log(`💾 Saved ${formattedResults.length} files with issues`)
  }

  private async updateProgress(progress: number, currentFile: string): Promise<void> {
    await this.updateStatus({
      status: 'analyzing',
      progress: Math.round(progress),
      currentFile
    })
  }

  private async updateStatus(update: any): Promise<void> {
    try {
      if (!process.env.DATABASE_URL) {
        console.log(`📊 Status Update [${this.analysisId}]:`, update)
        return
      }
      
      await prisma.analysisStatus.update({
        where: { id: this.analysisId },
        data: {
          ...update,
          updatedAt: new Date()
        }
      })
      
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.tempDir && this.tempDir.includes('tmp')) {
        const rmCmd = process.platform === 'win32' 
          ? `rmdir /s /q "${this.tempDir}"`
          : `rm -rf "${this.tempDir}"`
        
        execSync(rmCmd, { stdio: 'ignore' })
        console.log(`🧹 Cleaned up ${this.tempDir}`)
      }
    } catch (error) {
      console.warn('Cleanup failed:', error)
    }
  }
}