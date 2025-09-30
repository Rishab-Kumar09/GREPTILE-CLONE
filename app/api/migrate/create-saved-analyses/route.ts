import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Creating saved_analyses table...')
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS saved_analyses (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        analysis_id TEXT NOT NULL,
        repo_url TEXT NOT NULL,
        title TEXT NOT NULL,
        results JSONB NOT NULL,
        chat_messages JSONB,
        total_issues INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    
    console.log('✅ Created saved_analyses table')
    
    // Create index for faster queries
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_saved_analyses_user_id ON saved_analyses(user_id)
    `
    
    console.log('✅ Created index on user_id')
    
    return NextResponse.json({
      success: true,
      message: 'saved_analyses table created successfully'
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

