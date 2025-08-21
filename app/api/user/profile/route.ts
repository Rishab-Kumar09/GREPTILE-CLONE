import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/user/profile - Get user profile
export async function GET(request: NextRequest) {
  try {
    // For now, we'll use a default user ID since we don't have authentication
    // In a real app, you'd get this from the session/token
    const defaultUserId = 'default-user';
    
    let user = await prisma.user.findFirst({
      where: { id: defaultUserId }
    });

    // If no user exists, create a default one
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: defaultUserId,
          name: 'John Doe',
          email: 'john@example.com',
          selectedIcon: '👤',
          userTitle: 'Developer'
        }
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

// POST /api/user/profile - Update user profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const defaultUserId = 'default-user';
    
    const user = await prisma.user.upsert({
      where: { id: defaultUserId },
      update: {
        name: body.name,
        email: body.email,
        profileImage: body.profileImage,
        selectedIcon: body.selectedIcon,
        userTitle: body.userTitle
      },
      create: {
        id: defaultUserId,
        name: body.name || 'John Doe',
        email: body.email || 'john@example.com',
        profileImage: body.profileImage,
        selectedIcon: body.selectedIcon || '👤',
        userTitle: body.userTitle || 'Developer'
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
} 