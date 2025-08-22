import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// GET /api/github/callback - Handle GitHub OAuth callback
export async function GET(request: NextRequest) {
  try {
    // DEBUG: Log all environment variables
    console.log('🔍 CALLBACK DEBUG - Environment Variables:');
    console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? 'Present' : 'Missing');
    console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? 'Present' : 'Missing');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('All env keys:', Object.keys(process.env).filter(key => key.includes('GITHUB')));
    
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    console.log('🔍 CALLBACK DEBUG - Request Data:');
    console.log('Code received:', code ? 'Present' : 'Missing');
    console.log('State received:', state ? 'Present' : 'Missing');

    if (!code) {
      console.log('❌ CALLBACK ERROR: No authorization code received');
      console.log('URL params:', Object.fromEntries(searchParams.entries()));
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_auth_failed'));
    }

    console.log('✅ CALLBACK: Authorization code received');

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      console.error('❌ CALLBACK ERROR: GitHub OAuth credentials not configured');
      console.error('GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID ? 'Present' : 'Missing');
      console.error('GITHUB_CLIENT_SECRET:', GITHUB_CLIENT_SECRET ? 'Present' : 'Missing');
      console.error('Raw env GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID);
      console.error('Raw env GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '[REDACTED]' : 'Missing');
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_config_missing'));
    }

    console.log('✅ CALLBACK: GitHub credentials found, proceeding with token exchange');

    // Exchange code for access token
    console.log('🔄 CALLBACK: Exchanging code for access token...');
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

    console.log('📡 CALLBACK: Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.json();
    console.log('📡 CALLBACK: Token data received:', tokenData.error ? `Error: ${tokenData.error}` : 'Success');

    if (tokenData.error || !tokenData.access_token) {
      console.error('❌ CALLBACK ERROR: GitHub token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_token_failed'));
    }

    console.log('✅ CALLBACK: Access token received successfully');

    // Get user information from GitHub
    console.log('🔄 CALLBACK: Fetching user data from GitHub...');
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    console.log('📡 CALLBACK: User response status:', userResponse.status);
    const userData = await userResponse.json();
    console.log('👤 CALLBACK: User data received:', userData.login ? `@${userData.login}` : 'No login found');

    if (!userData.login) {
      console.error('❌ CALLBACK ERROR: Failed to get GitHub user data:', userData);
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_user_failed'));
    }

    console.log('✅ CALLBACK: User data validated, saving to database...');

    // Store GitHub connection info in database
    // For now, we'll store the token directly (later we'll move to AWS Secrets Manager)
    console.log('💾 CALLBACK: Updating database with GitHub connection...');
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

    console.log('✅ CALLBACK SUCCESS: Database updated, redirecting to dashboard');
    console.log(`🎉 CALLBACK: User @${userData.login} successfully connected to GitHub!`);

    // Redirect back to dashboard with success
    return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?github=connected'));

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_callback_failed'));
  }
} 