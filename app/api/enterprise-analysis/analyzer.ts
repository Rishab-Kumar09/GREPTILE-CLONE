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
      await this.updateStatus(analysisId, { 
        progress: 25,
        currentFile: 'Repository cloned, analyzing files...'
      })

      // 3. PARALLEL SEARCH - Much faster!
      console.log(`🔍 Running parallel analysis...`)
      const results = await this.parallelSearch((file) => {
        // Update current file but no counts
        this.updateStatus(analysisId, {
          currentFile: file,
          progress: 50  // Keep simple progress
        })
      })
      
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

  private async parallelSearch(onFile: (file: string) => void) {
    const patterns = {
      security: ['password', 'token', 'secret', 'auth'],
      api: ['router\\.', 'app\\.(get|post|put|delete)', 'api'],
      performance: ['useEffect.*\\[\\]', 'memo\\(', 'useMemo'],
      accessibility: ['role=', 'aria-']
    }

    // Run ALL searches in parallel!
    const searchPromises = Object.entries(patterns).flatMap(([type, typePatterns]) =>
      typePatterns.map(pattern => this.searchPattern(type, pattern, onFile))
    )

    const results = await Promise.all(searchPromises)
    return results.flat()
  }

  private async searchPattern(type: string, pattern: string, onFile: (file: string) => void) {
    try {
      // Get list of files to search
      const files = execSync(
        `cd ${this.tempDir} && git ls-files "*.ts" "*.tsx" "*.js" "*.jsx"`,
        { stdio: 'pipe' }
      ).toString().split('\n').filter(Boolean)

      // Search each file (but don't show counts)
      const results = []
      for (const file of files) {
        onFile(file)  // Show current file
        try {
          const output = execSync(
            `cd ${this.tempDir} && rg -n "${pattern}" "${file}"`,
            { stdio: 'pipe' }
          ).toString()

          if (output.trim()) {
            results.push({
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
      return results
    } catch (error) {
      console.warn(`Search failed for pattern ${pattern}:`, error)
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