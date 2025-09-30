import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Starting media columns migration...')
    
    // Add image_type, image_data, and video_url columns to issue_reports
    await prisma.$executeRaw`
      ALTER TABLE issue_reports
      ADD COLUMN IF NOT EXISTS image_type TEXT,
      ADD COLUMN IF NOT EXISTS image_data TEXT,
      ADD COLUMN IF NOT EXISTS video_url TEXT
    `
    
    console.log('✅ Added image_type, image_data, video_url columns')
    
    return NextResponse.json({
      success: true,
      message: 'Media columns added to issue_reports table',
      columnsAdded: ['image_type', 'image_data', 'video_url']
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

