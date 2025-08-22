import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Note: GitHub credentials will be fetched from internal endpoint
// due to AWS Amplify environment variable scoping issue

// GET /api/github/callback - Handle GitHub OAuth callback
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 CALLBACK STARTED - Full request URL:', request.url);
    console.log('🚀 CALLBACK STARTED - NextURL:', request.nextUrl.toString());
    
    // WORKAROUND: Fetch GitHub credentials from internal endpoint
    // because this route can't access environment variables
    console.log('🔄 CALLBACK: Fetching GitHub credentials from internal endpoint...');
    let GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET;
    
    try {
      const credentialsResponse = await fetch('https://master.d3dp89x98knsw0.amplifyapp.com/api/github/get-credentials');
      const credentialsData = await credentialsResponse.json();
      
      if (credentialsData.success) {
        GITHUB_CLIENT_ID = credentialsData.clientId;
        GITHUB_CLIENT_SECRET = credentialsData.clientSecret;
        console.log('✅ CALLBACK: GitHub credentials fetched successfully');
      } else {
        console.error('❌ CALLBACK: Failed to fetch GitHub credentials:', credentialsData.error);
        return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_config_missing'));
      }
    } catch (error) {
      console.error('❌ CALLBACK: Error fetching GitHub credentials:', error);
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_config_missing'));
    }
    
    // DEBUG: Log all environment variables
    console.log('🔍 CALLBACK DEBUG - Environment Variables:');
    console.log('GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID ? 'Present' : 'Missing');
    console.log('GITHUB_CLIENT_SECRET:', GITHUB_CLIENT_SECRET ? 'Present' : 'Missing');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    console.log('🔍 CALLBACK: Attempting to get search parameters...');
    const { searchParams } = request.nextUrl;
    console.log('✅ CALLBACK: Search parameters obtained successfully');
    
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    console.log('🔍 CALLBACK DEBUG - Request Data:');
    console.log('Code received:', code ? 'Present' : 'Missing');
    console.log('State received:', state ? 'Present' : 'Missing');
    console.log('All search params:', Object.fromEntries(searchParams.entries()));

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
        code: code,
      }),
    });
    
    console.log('📡 CALLBACK: Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.json();
    console.log('📡 CALLBACK: Token data received:', tokenData.error ? `Error: ${tokenData.error}` : 'Success');

    if (tokenData.error || !tokenData.access_token) {
      console.error('❌ CALLBACK ERROR: Failed to exchange code for token:', tokenData);
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
    console.error('🚨 CALLBACK FATAL ERROR:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });
    return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?error=github_callback_failed'));
  }
} 