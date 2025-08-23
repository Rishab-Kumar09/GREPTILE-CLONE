import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🧹 Starting force cleanup for problematic repositories...')
    
    // Get all repositories
    const allRepos = await prisma.repository.findMany()
    
    console.log(`📊 Found ${allRepos.length} total repositories in database`)
    
    // Log all repositories for debugging
    allRepos.forEach(repo => {
      console.log(`📋 Repository: ${repo.fullName} (ID: ${repo.id}, bugs: ${repo.bugs}, analyzing: ${repo.analyzing})`)
    })
    
    // Find repositories with 0 bugs and not analyzing (likely incomplete/broken entries)
    const problematicRepos = allRepos.filter(repo => 
      repo.bugs === 0 && repo.analyzing === false && 
      (repo.fullName === 'Rishab-Kumar09/twitter-blog' || repo.fullName.includes('twitter-blog'))
    )
    
    console.log(`🔍 Found ${problematicRepos.length} problematic repositories to remove`)
    
    let removedCount = 0
    
    // Remove problematic repositories
    for (const repo of problematicRepos) {
      try {
        await prisma.repository.delete({
          where: { id: repo.id }
        })
        console.log(`🗑️ Removed problematic repository: ${repo.fullName} (ID: ${repo.id})`)
        removedCount++
      } catch (deleteError) {
        console.error(`❌ Failed to delete ${repo.fullName}:`, deleteError)
      }
    }
    
    // Also remove any repositories with null or undefined critical fields
    const invalidRepos = allRepos.filter(repo => 
      !repo.fullName || !repo.name || repo.fullName.trim() === '' || repo.name.trim() === ''
    )
    
    for (const repo of invalidRepos) {
      try {
        await prisma.repository.delete({
          where: { id: repo.id }
        })
        console.log(`🗑️ Removed invalid repository: ${repo.fullName || 'UNNAMED'} (ID: ${repo.id})`)
        removedCount++
      } catch (deleteError) {
        console.error(`❌ Failed to delete invalid repo:`, deleteError)
      }
    }
    
    console.log(`✅ Force cleanup complete! Removed ${removedCount} problematic repositories`)
    
    // Get updated count
    const remainingRepos = await prisma.repository.findMany()
    
    return NextResponse.json({
      success: true,
      message: `Force cleanup completed. Removed ${removedCount} problematic repositories`,
      removedCount,
      remainingRepositories: remainingRepos.length,
      remainingRepos: remainingRepos.map(r => ({ fullName: r.fullName, bugs: r.bugs, analyzing: r.analyzing }))
    })
    
  } catch (error) {
    console.error('❌ Error during force cleanup:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to perform force cleanup'
    }, { status: 500 })
  }
} 