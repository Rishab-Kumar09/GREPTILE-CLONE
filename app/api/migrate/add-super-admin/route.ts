import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Adding is_super_admin column to admins table...')
    
    // Add is_super_admin column
    await prisma.$executeRaw`
      ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
    `
    console.log('✅ Added is_super_admin column')
    
    // Make R.K. the Super Admin
    await prisma.$executeRaw`
      UPDATE admins
      SET is_super_admin = TRUE
      WHERE user_email = 'rk@company.com';
    `
    console.log('✅ R.K. is now the Super Admin!')
    
    // Log admin activity
    await prisma.$executeRaw`
      INSERT INTO admin_activity (admin_user_id, action, details)
      VALUES ('SYSTEM', 'INIT_SUPER_ADMIN', 'R.K. designated as Super Admin')
    `
    console.log('✅ Logged super admin creation')
    
    return NextResponse.json({
      success: true,
      message: 'Super Admin system initialized! R.K. is now the God Mode admin.'
    })
    
  } catch (error) {
    console.error('❌ Super Admin migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

