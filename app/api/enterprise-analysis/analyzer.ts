import { execSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

export class EnterpriseAnalyzer {
  private tempDir: string
  private BATCH_SIZE = 10  // Process 10 files at once!
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

      // SUPER FAST CLONE
      console.log(`🚀 Turbo cloning ${repoUrl}...`)
      await this.fastClone(repoUrl)
      await this.updateStatus(analysisId, { 
        progress: 25,
        currentFile: 'Repository cloned, starting turbo analysis...'
      })

      // Get all files but split by type for parallel processing
      const filesByType = {
        typescript: execSync(
          `cd ${this.tempDir} && git ls-files "*.ts" "*.tsx"`,
          { stdio: 'pipe' }
        ).toString().split('\n').filter(Boolean),
        javascript: execSync(
          `cd ${this.tempDir} && git ls-files "*.js" "*.jsx"`,
          { stdio: 'pipe' }
        ).toString().split('\n').filter(Boolean)
      }

      // Process each file type in parallel
      const results = await Promise.all(
        Object.entries(filesByType).map(([type, files]) =>
          this.processFileType(type, files, analysisId)
        )
      )

      // Complete
      await this.updateStatus(analysisId, {
        status: 'completed',
        progress: 100,
        currentFile: 'Analysis complete',
        results: results.flat().filter(Boolean)
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

  private async processFileType(type: string, files: string[], analysisId: string) {
    const results = []
    
    // Process files in larger batches
    for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
      const batch = files.slice(i, i + this.BATCH_SIZE)
      
      // Update status with first file in batch
      await this.updateStatus(analysisId, {
        currentFile: batch[0],
        progress: Math.min(25 + ((i / files.length) * 75), 99)
      })

      // Process entire batch in parallel
      const batchPromises = batch.map(file => this.analyzeFile(file))
      const batchResults = await Promise.all(batchPromises)
      
      results.push(...batchResults.flat())
    }

    return results
  }

  private async fastClone(repoUrl: string) {
    // MAXIMUM SPEED CLONE
    execSync(
      `git clone --depth 1 --filter=blob:none --no-checkout ${repoUrl} ${this.tempDir}`,
      { stdio: 'pipe' }
    )
    
    // Parallel checkout by file type
    await Promise.all([
      execSync(`cd ${this.tempDir} && git checkout HEAD --quiet -- "*.ts" "*.tsx"`, { stdio: 'pipe' }),
      execSync(`cd ${this.tempDir} && git checkout HEAD --quiet -- "*.js" "*.jsx"`, { stdio: 'pipe' })
    ])
  }

  private async analyzeFile(file: string) {
    // Run ALL pattern searches in parallel
    const searches = Object.entries(this.PATTERNS).map(async ([type, patterns]) => {
      const results = await Promise.all(
        patterns.map(pattern =>
          this.searchPattern(file, type, pattern)
        )
      )
      return results.flat()
    })

    const results = await Promise.all(searches)
    return results.flat()
  }

  private async searchPattern(file: string, type: string, pattern: string) {
    try {
      const output = execSync(
        `cd ${this.tempDir} && rg -n "${pattern}" "${file}"`,
        { stdio: 'pipe' }
      ).toString()

      if (output.trim()) {
        return [{
          type,
          pattern,
          match: output,
          timestamp: Date.now()
        }]
      }
    } catch (error) {
      // No matches is okay
    }
    return []
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