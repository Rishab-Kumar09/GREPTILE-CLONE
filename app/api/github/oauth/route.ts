import { NextRequest, NextResponse } from 'next/server';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'https://main.d2x7xjj4p1h8wm.amplifyapp.com/api/github/callback';

// GET /api/github/oauth - Initiate GitHub OAuth flow
export async function GET() {
  try {
    if (!GITHUB_CLIENT_ID) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate a random state for security
    const state = Math.random().toString(36).substring(2, 15);
    
    // GitHub OAuth URL with required scopes for repository access
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.append('redirect_uri', GITHUB_REDIRECT_URI);
    githubAuthUrl.searchParams.append('scope', 'repo read:user user:email');
    githubAuthUrl.searchParams.append('state', state);

    return NextResponse.json({
      success: true,
      authUrl: githubAuthUrl.toString(),
      state
    });
  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
} 