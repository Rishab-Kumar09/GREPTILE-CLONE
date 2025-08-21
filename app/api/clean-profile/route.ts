import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Clear hardcoded data from existing profile
    await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET name = NULL, "userTitle" = NULL
      WHERE id = 'default-user' AND (name = 'R.K.' OR "userTitle" = 'Developer')
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Profile data cleaned - removed hardcoded values',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Profile cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 