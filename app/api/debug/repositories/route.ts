import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 DEBUG: Fetching all repositories from database...')
    
    const repositories = await prisma.$queryRaw`
      SELECT * FROM "Repository" ORDER BY "createdAt" DESC
    ` as any[]
    
    console.log(`🔍 DEBUG: Found ${repositories.length} repositories`)
    
    // Analyze each repository structure
    const analysis = repositories.map(repo => ({
      fullName: repo.fullName,
      name: repo.name,
      hasUrl: !!repo.url,
      urlValue: repo.url,
      stars: repo.stars,
      forks: repo.forks,
      language: repo.language,
      bugs: repo.bugs,
      hasAnalysisResults: !!repo.analysisResults,
      createdAt: repo.createdAt
    }))
    
    return NextResponse.json({
      success: true,
      totalRepositories: repositories.length,
      repositories: analysis,
      nodeGoatRepo: analysis.find(r => r.fullName.includes('NodeGoat')),
      otherRepos: analysis.filter(r => !r.fullName.includes('NodeGoat'))
    })
  } catch (error) {
    console.error('🔍 DEBUG: Error fetching repositories:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 