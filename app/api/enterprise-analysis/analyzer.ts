import { execSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

export class EnterpriseAnalyzer {
  private tempDir: string
  private BATCH_SIZE = 5  // Process 5 files at once
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

      // Fast clone
      console.log(`🚀 Smart cloning ${repoUrl}...`)
      await this.fastClone(repoUrl)
      await this.updateStatus(analysisId, { 
        progress: 25,
        currentFile: 'Repository cloned, starting analysis...'
      })

      // Get all files to analyze
      const files = execSync(
        `cd ${this.tempDir} && git ls-files "*.ts" "*.tsx" "*.js" "*.jsx"`,
        { stdio: 'pipe' }
      ).toString().split('\n').filter(Boolean)

      // Process files in parallel batches
      const results = []
      for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
        const batch = files.slice(i, i + this.BATCH_SIZE)
        
        // Update status with first file in batch
        await this.updateStatus(analysisId, {
          currentFile: batch[0],
          progress: Math.min(25 + ((i / files.length) * 75), 99)  // 25-99%
        })

        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(file => this.analyzeFile(file))
        )

        results.push(...batchResults.flat())
      }

      // Complete
      await this.updateStatus(analysisId, {
        status: 'completed',
        progress: 100,
        currentFile: 'Analysis complete',
        results: results.filter(Boolean)  // Remove empty results
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
    // Super fast clone
    execSync(
      `git clone --depth 1 --filter=blob:none --no-checkout ${repoUrl} ${this.tempDir}`,
      { stdio: 'pipe' }
    )
    
    // Only get what we need
    execSync(
      `cd ${this.tempDir} && git checkout HEAD --quiet -- "*.ts" "*.tsx" "*.js" "*.jsx"`,
      { stdio: 'pipe' }
    )
  }

  private async analyzeFile(file: string) {
    // Search all patterns in parallel for this file
    const results = await Promise.all(
      Object.entries(this.PATTERNS).map(async ([type, patterns]) => {
        const fileResults = []
        for (const pattern of patterns) {
          try {
            const output = execSync(
              `cd ${this.tempDir} && rg -n "${pattern}" "${file}"`,
              { stdio: 'pipe' }
            ).toString()

            if (output.trim()) {
              fileResults.push({
                type,
                pattern,
                match: output,
                timestamp: Date.now()
              })
            }
          } catch (error) {
            // No matches in this file is okay
          }
        }
        return fileResults
      })
    )

    return results.flat()
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