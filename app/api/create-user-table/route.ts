import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Create UserProfile table using raw SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "UserProfile" (
        id TEXT PRIMARY KEY DEFAULT 'default-user',
        name TEXT,
        "profileImage" TEXT,
        "selectedIcon" TEXT DEFAULT '👤',
        "userTitle" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    // Just create the table structure - no hardcoded data insertion
    
    return NextResponse.json({
      success: true,
      message: 'UserProfile table created successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Table creation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 