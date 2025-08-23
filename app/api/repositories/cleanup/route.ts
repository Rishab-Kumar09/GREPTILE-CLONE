import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🧹 Starting duplicate repository cleanup...')
    
    // Get all repositories
    const allRepos = await prisma.repository.findMany({
      orderBy: { createdAt: 'asc' } // Keep the oldest one
    })
    
    console.log(`📊 Found ${allRepos.length} total repositories`)
    
    // Group by fullName
    const repoGroups = allRepos.reduce((groups: any, repo) => {
      if (!groups[repo.fullName]) {
        groups[repo.fullName] = []
      }
      groups[repo.fullName].push(repo)
      return groups
    }, {})
    
    let duplicatesRemoved = 0
    
    // Remove duplicates (keep the first/oldest one)
    for (const [fullName, repos] of Object.entries(repoGroups) as [string, any[]][]) {
      if (repos.length > 1) {
        console.log(`🔍 Found ${repos.length} duplicates for ${fullName}`)
        
        // Keep the first one, delete the rest
        const toDelete = repos.slice(1)
        
        for (const repo of toDelete) {
          await prisma.repository.delete({
            where: { id: repo.id }
          })
          console.log(`🗑️ Deleted duplicate: ${repo.fullName} (ID: ${repo.id})`)
          duplicatesRemoved++
        }
      }
    }
    
    console.log(`✅ Cleanup complete! Removed ${duplicatesRemoved} duplicate repositories`)
    
    return NextResponse.json({
      success: true,
      message: `Removed ${duplicatesRemoved} duplicate repositories`,
      duplicatesRemoved,
      totalRepositories: allRepos.length - duplicatesRemoved
    })
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup duplicates'
    }, { status: 500 })
  }
} 