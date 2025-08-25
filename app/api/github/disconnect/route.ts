import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/github/disconnect - Disconnect GitHub from a user
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    console.log('🔄 DISCONNECT: Disconnecting GitHub for user:', userId);
    
    // Disconnect GitHub from user profile
    const updateResult = await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET 
        "githubConnected" = false,
        "githubUsername" = NULL,
        "githubAvatarUrl" = NULL,
        "githubTokenRef" = NULL,
        "updatedAt" = NOW()
      WHERE id = ${userId}
    `;
    
    console.log('📊 DISCONNECT: Database update result - rows affected:', updateResult);
    
    if (updateResult === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ DISCONNECT: Successfully disconnected GitHub from user:', userId);
    
    return NextResponse.json({
      success: true,
      message: `GitHub disconnected from user ${userId}`
    });
    
  } catch (error) {
    console.error('❌ DISCONNECT ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect GitHub' },
      { status: 500 }
    );
  }
}
