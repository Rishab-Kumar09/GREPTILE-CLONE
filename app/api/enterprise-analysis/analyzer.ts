import { execSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

interface AnalysisResult {
  type: string
  match: string
  timestamp: number
}

export class EnterpriseAnalyzer {
  private tempDir: string
  private PATTERNS = {
    security: ['password', 'token', 'secret', 'auth'],
    api: ['router\\.', 'app\\.(get|post|put|delete)', 'api'],
    performance: ['useEffect.*\\[\\]', 'memo\\(', 'useMemo'],
    accessibility: ['role=', 'aria-']
  }

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', uuid())
    fs.mkdirSync(this.tempDir, { recursive: true })
  }

  async start(repoUrl: string, analysisId: string) {
    try {
      await this.updateStatus(analysisId, {
        status: 'analyzing',
        progress: 0,
        currentFile: 'Starting analysis...'
      })

      // 1. Fast clone
      console.log(`🚀 Cloning ${repoUrl}...`)
      await this.fastClone(repoUrl)
      await this.updateStatus(analysisId, { 
        progress: 25,
        currentFile: 'Repository cloned, starting parallel analysis...'
      })

      // 2. Get all files at once
      const allFiles = execSync(
        `cd ${this.tempDir} && git ls-files "*.ts" "*.tsx" "*.js" "*.jsx"`,
        { stdio: 'pipe' }
      ).toString().split('\n').filter(Boolean)

      // 3. REAL PARALLEL PROCESSING
      // Split files into chunks of 20 for parallel processing
      const chunks = []
      for (let i = 0; i < allFiles.length; i += 20) {
        chunks.push(allFiles.slice(i, i + 20))
      }

      console.log(`🚀 Processing ${chunks.length} chunks in parallel...`)
      const results: AnalysisResult[] = []  // Specify type!

      // Process chunks in parallel
      await Promise.all(chunks.map(async (chunk, chunkIndex) => {
        // Update status with first file in chunk
        await this.updateStatus(analysisId, {
          currentFile: chunk[0],
          progress: Math.min(25 + ((chunkIndex / chunks.length) * 75), 99)
        })

        // Run ripgrep on all files in chunk at once
        const chunkResults = await Promise.all(
          Object.entries(this.PATTERNS).map(async ([type, patterns]) => {
            const patternString = patterns.join('|')
            const fileString = chunk.join(' ')

            try {
              const output = execSync(
                `cd ${this.tempDir} && rg -n "${patternString}" ${fileString}`,
                { stdio: 'pipe' }
              ).toString()

              return output.split('\n')
                .filter(Boolean)
                .map(match => ({
                  type,
                  match,
                  timestamp: Date.now()
                }))
            } catch (error) {
              // No matches is okay
              return []
            }
          })
        )

        results.push(...chunkResults.flat())
      }))

      // Complete
      await this.updateStatus(analysisId, {
        status: 'completed',
        progress: 100,
        currentFile: 'Analysis complete',
        results
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
    // Fast clone
    execSync(
      `git clone --depth 1 --filter=blob:none --no-checkout ${repoUrl} ${this.tempDir}`,
      { stdio: 'pipe' }
    )
    
    // Get all code files at once
    execSync(
      `cd ${this.tempDir} && git checkout HEAD --quiet -- "*.ts" "*.tsx" "*.js" "*.jsx"`,
      { stdio: 'pipe' }
    )
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