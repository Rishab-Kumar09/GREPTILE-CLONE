import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/migrate-github-fields - Add GitHub fields to UserProfile table
export async function POST() {
  try {
    console.log('🔄 Adding GitHub fields to UserProfile table...');

    // Add GitHub fields to existing table
    await prisma.$executeRaw`
      ALTER TABLE "UserProfile" 
      ADD COLUMN IF NOT EXISTS "githubConnected" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "githubUsername" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "githubAvatarUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "githubTokenRef" TEXT;
    `;

    console.log('✅ GitHub fields added successfully');

    return NextResponse.json({
      success: true,
      message: 'GitHub fields added to UserProfile table'
    });
  } catch (error) {
    console.error('❌ GitHub fields migration error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add GitHub fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 