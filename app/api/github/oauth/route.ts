import { NextRequest, NextResponse } from 'next/server';

const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'https://master.d3dp89x98knsw0.amplifyapp.com/api/github/callback';

// GET /api/github/oauth - Initiate GitHub OAuth flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const returnTo = searchParams.get('returnTo') || '/dashboard';
    
    console.log('🔄 OAUTH: Initiating GitHub OAuth for user:', userId);
    console.log('🔄 OAUTH: Will return to:', returnTo);
    
    // Fetch GitHub credentials from internal endpoint (same pattern as callback)
    console.log('🔄 OAUTH: Fetching GitHub credentials from internal endpoint...');
    let GITHUB_CLIENT_ID;
    
    try {
      const credentialsResponse = await fetch('https://master.d3dp89x98knsw0.amplifyapp.com/api/github/get-credentials');
      const credentialsData = await credentialsResponse.json();
      
      if (credentialsData.success) {
        GITHUB_CLIENT_ID = credentialsData.clientId;
        console.log('✅ OAUTH: GitHub credentials fetched successfully');
      } else {
        console.error('❌ OAUTH: Failed to fetch GitHub credentials:', credentialsData.error);
        return NextResponse.json(
          { error: 'GitHub OAuth not configured' },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ OAUTH: Error fetching GitHub credentials:', error);
      return NextResponse.json(
        { error: 'Failed to fetch GitHub credentials' },
        { status: 500 }
      );
    }

    if (!userId) {
      console.log('❌ OAUTH ERROR: userId is required');
      return NextResponse.json(
        { error: 'User ID is required for GitHub OAuth' },
        { status: 400 }
      );
    }

    // Generate state with user ID and return URL encoded for callback
    const stateData = {
      userId: userId,
      returnTo: returnTo,
      random: Math.random().toString(36).substring(2, 15)
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    console.log('🔒 OAUTH: Generated state for user:', userId);
    
    // Create GitHub OAuth URL
    const oauthUrl = new URL('https://github.com/login/oauth/authorize');
    oauthUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
    oauthUrl.searchParams.append('redirect_uri', GITHUB_REDIRECT_URI);
    oauthUrl.searchParams.append('scope', 'repo read:user user:email');
    oauthUrl.searchParams.append('state', state);
    oauthUrl.searchParams.append('allow_signup', 'false'); // Require existing account
    
    // Force logout first, then redirect to OAuth
    const githubLogoutUrl = new URL('https://github.com/logout');
    githubLogoutUrl.searchParams.append('return_to', oauthUrl.toString());

    console.log('🔐 OAUTH: Generated logout-then-OAuth URL for fresh authentication');
    console.log('🔄 OAUTH: Will logout first, then redirect to OAuth');
    console.log('🚀 OAUTH: Automatically redirecting to:', githubLogoutUrl.toString());

    // Automatically redirect instead of returning JSON
    return NextResponse.redirect(githubLogoutUrl.toString());
  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
} 