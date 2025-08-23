import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/profile - Get user profile
export async function GET() {
  try {
    // Use raw query to avoid Prisma type issues
    const result = await prisma.$queryRaw`
      SELECT * FROM "UserProfile" WHERE id = 'default-user' LIMIT 1
    `;
    
    const profiles = result as any[];
    
    if (profiles.length > 0) {
      return NextResponse.json({
        success: true,
        profile: profiles[0]
      });
    } else {
      // Create empty profile - user will fill in their own data
      await prisma.$executeRaw`
        INSERT INTO "UserProfile" (id, "selectedIcon", "createdAt", "updatedAt")
        VALUES ('default-user', '👤', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      
      return NextResponse.json({
        success: true,
        profile: {
          id: 'default-user',
          name: null,
          email: null, // Optional field
          selectedIcon: '👤',
          userTitle: null,
          profileImage: null,
          githubConnected: false,
          githubUsername: null,
          githubAvatarUrl: null
        }
      });
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
    const { name, email, profileImage, selectedIcon, userTitle } = await request.json();
    
    // Try to update with email field first, fallback without email if it fails
    try {
      await prisma.$executeRaw`
        INSERT INTO "UserProfile" (id, name, email, "profileImage", "selectedIcon", "userTitle", "createdAt", "updatedAt")
        VALUES ('default-user', ${name}, ${email || null}, ${profileImage}, ${selectedIcon}, ${userTitle}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = ${name},
          email = ${email || null},
          "profileImage" = ${profileImage},
          "selectedIcon" = ${selectedIcon},
          "userTitle" = ${userTitle},
          "updatedAt" = NOW()
      `;
    } catch (emailError) {
      console.log('Email field not available in database, saving without email:', emailError);
      // Fallback: save without email field
      await prisma.$executeRaw`
        INSERT INTO "UserProfile" (id, name, "profileImage", "selectedIcon", "userTitle", "createdAt", "updatedAt")
        VALUES ('default-user', ${name}, ${profileImage}, ${selectedIcon}, ${userTitle}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = ${name},
          "profileImage" = ${profileImage},
          "selectedIcon" = ${selectedIcon},
          "userTitle" = ${userTitle},
          "updatedAt" = NOW()
      `;
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