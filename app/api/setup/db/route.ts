import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // Create the HealthCheck table manually using raw SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "HealthCheck" (
        "id" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
      );
    `
    
    // Test the connection
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database tables created successfully' 
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
} 