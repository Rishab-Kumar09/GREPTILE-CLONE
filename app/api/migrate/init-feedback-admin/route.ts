import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    
    console.log('🔧 Starting feedback system migration...')
    
    // Step 1: Create admins table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        user_email TEXT NOT NULL,
        user_name TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by TEXT
      )
    `
    console.log('✅ Created admins table')
    
    // Step 2: Create issue_reports table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS issue_reports (
        id SERIAL PRIMARY KEY,
        issue_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT DEFAULT 'bug',
        reported_by_user_id TEXT NOT NULL,
        reported_by_email TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✅ Created issue_reports table')
    
    // Step 3: Create issue_signoffs table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS issue_signoffs (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES issue_reports(id),
        signed_off_by TEXT NOT NULL,
        signed_off_at TIMESTAMP DEFAULT NOW(),
        admin_notes TEXT,
        UNIQUE(report_id)
      )
    `
    console.log('✅ Created issue_signoffs table')
    
    // Step 4: Create admin_activity table (audit log)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS admin_activity (
        id SERIAL PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_id TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✅ Created admin_activity table')
    
    // Step 5: Find R.K.'s user ID from UserProfile table
    const rkUser = await prisma.$queryRaw<Array<{ id: string; email: string; name: string }>>`
      SELECT id, email, name FROM "UserProfile" 
      WHERE email = 'rk@company.com' 
      LIMIT 1
    `
    
    if (rkUser.length === 0) {
      throw new Error('R.K. user not found in database')
    }
    
    const userId = rkUser[0].id
    console.log('✅ Found R.K. user:', userId)
    
    // Step 6: Make R.K. the first admin (SUPER ADMIN)
    await prisma.$executeRaw`
      INSERT INTO admins (user_id, user_email, user_name, is_active, created_by)
      VALUES (${userId}, 'rk@company.com', 'R.K.', true, 'SYSTEM_INIT')
      ON CONFLICT (user_id) DO NOTHING
    `
    console.log('✅ R.K. is now an admin!')
    
    // Step 7: Log admin creation
    await prisma.$executeRaw`
      INSERT INTO admin_activity (admin_user_id, action, details)
      VALUES ('SYSTEM', 'INIT_ADMIN', 'R.K. made first admin')
    `
    console.log('✅ Logged admin creation')
    
    return NextResponse.json({
      success: true,
      message: 'Feedback system initialized! R.K. is now an admin.',
      adminUserId: userId,
      tablesCreated: [
        'admins',
        'issue_reports',
        'issue_signoffs',
        'admin_activity'
      ]
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
