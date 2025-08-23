import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/profile - Get user profile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    console.log('🔍 PROFILE GET: Looking for user:', userId);
    
    // Use raw query to avoid Prisma type issues
    const result = await prisma.$queryRaw`
      SELECT * FROM "UserProfile" WHERE id = ${userId} LIMIT 1
    `;
    
    const profiles = result as any[];
    
    if (profiles.length > 0) {
      console.log('✅ PROFILE GET: Found user profile');
      return NextResponse.json({
        success: true,
        profile: profiles[0]
      });
    } else {
      console.log('❌ PROFILE GET: User profile not found');
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// POST /api/profile - Update profile
export async function POST(request: NextRequest) {
  try {
    const { userId, name, email, profileImage, selectedIcon, userTitle } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    console.log('🔄 PROFILE UPDATE: Updating user:', userId);
    
    // Try to update with email field first, fallback without email if it fails
    try {
      await prisma.$executeRaw`
        INSERT INTO "UserProfile" (id, name, email, "profileImage", "selectedIcon", "userTitle", "createdAt", "updatedAt")
        VALUES (${userId}, ${name}, ${email || null}, ${profileImage}, ${selectedIcon}, ${userTitle}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = ${name},
          email = ${email || null},
          "profileImage" = ${profileImage},
          "selectedIcon" = ${selectedIcon},
          "userTitle" = ${userTitle},
          "updatedAt" = NOW()
      `;
      console.log('✅ PROFILE UPDATE: Updated with email field');
    } catch (emailError) {
      console.log('Email field not available in database, saving without email:', emailError);
      // Fallback: save without email field
      await prisma.$executeRaw`
        INSERT INTO "UserProfile" (id, name, "profileImage", "selectedIcon", "userTitle", "createdAt", "updatedAt")
        VALUES (${userId}, ${name}, ${profileImage}, ${selectedIcon}, ${userTitle}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = ${name},
          "profileImage" = ${profileImage},
          "selectedIcon" = ${selectedIcon},
          "userTitle" = ${userTitle},
          "updatedAt" = NOW()
      `;
      console.log('✅ PROFILE UPDATE: Updated without email field');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
} 