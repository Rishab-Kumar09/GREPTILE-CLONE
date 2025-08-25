import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/migrate/disconnect-test-user - Emergency fix to disconnect test-company-com from GitHub
export async function GET() {
  try {
    console.log('🚨 EMERGENCY MIGRATION: Disconnecting test-company-com from GitHub...');
    
    // Disconnect test-company-com from GitHub
    const updateResult = await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET 
        "githubConnected" = false,
        "githubUsername" = NULL,
        "githubAvatarUrl" = NULL,
        "githubTokenRef" = NULL,
        "updatedAt" = NOW()
      WHERE id = 'test-company-com'
    `;
    
    console.log('📊 MIGRATION: Rows affected:', updateResult);
    
    // Verify the disconnection
    const verifyResult = await prisma.$queryRaw`
      SELECT id, name, "githubConnected", "githubUsername" 
      FROM "UserProfile" 
      WHERE id = 'test-company-com'
    ` as any[];
    
    return NextResponse.json({
      success: true,
      message: 'test-company-com disconnected from GitHub',
      rowsAffected: updateResult,
      verification: verifyResult[0] || null
    });
    
  } catch (error) {
    console.error('❌ MIGRATION ERROR:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to disconnect test-company-com',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
