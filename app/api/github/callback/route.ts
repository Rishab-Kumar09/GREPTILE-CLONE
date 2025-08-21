import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// GET /api/github/callback - Handle GitHub OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard?error=github_auth_failed', request.url));
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      console.error('GitHub OAuth credentials not configured');
      return NextResponse.redirect(new URL('/dashboard?error=github_config_missing', request.url));
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('GitHub token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/dashboard?error=github_token_failed', request.url));
    }

    // Get user information from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    if (!userData.login) {
      console.error('Failed to get GitHub user data:', userData);
      return NextResponse.redirect(new URL('/dashboard?error=github_user_failed', request.url));
    }

    // Store GitHub connection info in database
    // For now, we'll store the token directly (later we'll move to AWS Secrets Manager)
    await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET 
        "githubConnected" = true,
        "githubUsername" = ${userData.login},
        "githubAvatarUrl" = ${userData.avatar_url},
        "githubTokenRef" = ${tokenData.access_token},
        "updatedAt" = NOW()
      WHERE id = 'default-user'
    `;

    // Redirect back to dashboard with success
    return NextResponse.redirect(new URL('/dashboard?github=connected', request.url));

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?error=github_callback_failed', request.url));
  }
} 