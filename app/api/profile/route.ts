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
      // Create default profile
      await prisma.$executeRaw`
        INSERT INTO "UserProfile" (id, name, "selectedIcon", "userTitle", "createdAt", "updatedAt")
        VALUES ('default-user', 'R.K.', '👤', 'Developer', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      
      return NextResponse.json({
        success: true,
        profile: {
          id: 'default-user',
          name: 'R.K.',
          selectedIcon: '👤',
          userTitle: 'Developer',
          profileImage: null
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
    const { name, profileImage, selectedIcon, userTitle } = await request.json();
    
    // Use raw query to update profile
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