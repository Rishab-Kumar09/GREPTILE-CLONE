import { execSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import path from 'path'
import fs from 'fs'
import { prisma } from '@/lib/prisma'

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

      // SUPER FAST CLONE
      console.log(`🚀 Turbo cloning ${repoUrl}...`)
      await this.fastClone(repoUrl)
      await this.updateStatus(analysisId, { 
        progress: 25,
        currentFile: 'Repository cloned, analyzing...'
      })

      // PARALLEL ANALYSIS - NO COUNTING!
      console.log(`⚡ Running parallel analysis...`)
      
      // Run ripgrep once for each pattern type in parallel
      const results = await Promise.all(
        Object.entries(this.PATTERNS).map(async ([type, patterns]) => {
          // Join patterns with | for single ripgrep run
          const patternString = patterns.join('|')
          
          try {
            // Search all files at once!
            const output = execSync(
              `cd ${this.tempDir} && rg -n "${patternString}" --type ts --type tsx --type js --type jsx`,
              { stdio: 'pipe' }
            ).toString()

            // Process results
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

      // Complete
      await this.updateStatus(analysisId, {
        status: 'completed',
        progress: 100,
        currentFile: 'Analysis complete',
        results: results.flat()
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
    // MAXIMUM SPEED CLONE
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