import { execSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

export class EnterpriseAnalyzer {
  private tempDir: string
  private results: any[] = []

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', uuid())
    fs.mkdirSync(this.tempDir, { recursive: true })
  }

  async start(repoUrl: string, analysisId: string) {
    try {
      // 1. Update status to analyzing
      await this.updateStatus(analysisId, {
        status: 'analyzing',
        progress: 0,
        currentFile: 'Starting analysis...' // Generic message
      })

      // 2. Fast clone
      console.log(`🚀 Cloning ${repoUrl}...`)
      await this.fastClone(repoUrl)
      await this.updateStatus(analysisId, { 
        progress: 25,
        currentFile: 'Repository cloned' // No file details
      })

      // 3. Search patterns
      console.log(`🔍 Analyzing patterns...`)
      const searcher = new ParallelSearcher(this.tempDir)
      
      // 4. Collect all results
      for await (const result of searcher.search()) {
        this.results.push(result)
      }
      await this.updateStatus(analysisId, { 
        progress: 75,
        currentFile: 'Analysis in progress' // Generic status
      })

      // 5. Save results in existing status table
      await this.updateStatus(analysisId, {
        status: 'completed',
        progress: 100,
        currentFile: 'Analysis complete', // Simple completion message
        results: this.results
      })

      console.log(`✅ Analysis complete!`)
    } catch (error) {
      console.error('Analysis failed:', error)
      await this.updateStatus(analysisId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      this.cleanup()
    }
  }

  private async fastClone(repoUrl: string) {
    execSync(`git clone --depth 1 --filter=blob:none ${repoUrl} ${this.tempDir}`, {
      stdio: 'pipe'
    })
  }

  private async updateStatus(analysisId: string, update: any) {
    try {
      await prisma.analysisStatus.update({
        where: { id: analysisId },
        data: update
      })
    } catch (error) {
      console.error('Status update failed:', error)
    }
  }

  private cleanup() {
    fs.rmSync(this.tempDir, { recursive: true, force: true })
  }
}

class ParallelSearcher {
  constructor(private repoPath: string) {}

  async *search() {
    const patterns = {
      security: [
        'password',
        'token',
        'secret',
        'auth',
      ],
      api: [
        'router\\.',
        'app\\.(get|post|put|delete)',
        'api',
      ],
      performance: [
        'useEffect.*\\[\\]',
        'memo\\(',
        'useMemo',
      ],
      accessibility: [
        'role=',
        'aria-',
      ]
    }

    for (const [type, typePatterns] of Object.entries(patterns)) {
      for (const pattern of typePatterns) {
        try {
          const results = execSync(
            `rg -n --type ts --type tsx --type js --type jsx "${pattern}" ${this.repoPath}`,
            { stdio: 'pipe' }
          ).toString()

          for (const line of results.split('\n')) {
            if (line.trim()) {
              yield {
                type,
                pattern,
                match: line,
                timestamp: Date.now()
              }
            }
          }
        } catch (error) {
          // ripgrep returns non-zero exit code if no matches found
          if (error instanceof Error && !error.message.includes('No such file or directory')) {
            console.warn(`Search failed for pattern ${pattern}:`, error)
          }
        }
      }
    }
  }
}