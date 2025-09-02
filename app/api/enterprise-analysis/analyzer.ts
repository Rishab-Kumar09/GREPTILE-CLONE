import { execSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

export class EnterpriseAnalyzer {
  private tempDir: string

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp', uuid())
    fs.mkdirSync(this.tempDir, { recursive: true })
  }

  async start(repoUrl: string, analysisId: string) {
    try {
      // 1. Start analysis
      await this.updateStatus(analysisId, {
        status: 'analyzing',
        progress: 0,
        currentFile: 'Starting analysis...'
      })

      // 2. Fast clone with NO UNNEEDED FILES
      console.log(`🚀 Smart cloning ${repoUrl}...`)
      await this.fastClone(repoUrl)
      
      // 3. PARALLEL SEARCH - Much faster!
      console.log(`🔍 Running parallel analysis...`)
      const results = await this.parallelSearch()
      
      // 4. Save & Complete
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
    // MUCH faster clone:
    // --depth 1: Only latest commit
    // --filter=blob:none: Don't download file contents yet
    // --no-checkout: Don't check out files
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

  private async parallelSearch() {
    const patterns = {
      security: ['password', 'token', 'secret', 'auth'],
      api: ['router\\.', 'app\\.(get|post|put|delete)', 'api'],
      performance: ['useEffect.*\\[\\]', 'memo\\(', 'useMemo'],
      accessibility: ['role=', 'aria-']
    }

    // Run ALL searches in parallel!
    const searchPromises = Object.entries(patterns).flatMap(([type, typePatterns]) =>
      typePatterns.map(pattern => this.searchPattern(type, pattern))
    )

    const results = await Promise.all(searchPromises)
    return results.flat()
  }

  private async searchPattern(type: string, pattern: string) {
    try {
      const output = execSync(
        `cd ${this.tempDir} && rg -n --type ts --type tsx --type js --type jsx "${pattern}"`,
        { stdio: 'pipe' }
      ).toString()

      return output.split('\n')
        .filter(line => line.trim())
        .map(match => ({
          type,
          pattern,
          match,
          timestamp: Date.now()
        }))
    } catch (error) {
      // No matches found is okay
      return []
    }
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