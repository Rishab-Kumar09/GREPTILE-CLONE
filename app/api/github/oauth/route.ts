import { NextRequest, NextResponse } from 'next/server';

const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'https://master.d3dp89x98knsw0.amplifyapp.com/api/github/callback';

// GET /api/github/oauth - Initiate GitHub OAuth flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get('session') || request.headers.get('authorization')?.replace('Bearer ', '');
    let userId = searchParams.get('userId'); // BACK TO SIMPLE: Direct userId parameter
    const returnTo = searchParams.get('returnTo') || '/dashboard';
    
    console.log('🔄 OAUTH: Initiating GitHub OAuth...');
    console.log('🔄 OAUTH: Will return to:', returnTo);
    
    const purpose = searchParams.get('purpose') || 'connect'; // 'signin' or 'connect'
    
    // 🔒 Handle both authenticated users and temporary sessions for GitHub signin
    let isTemporarySession = false;
    
    // For GitHub refresh (connect), we ONLY need userId - no complex session validation
    if (purpose === 'connect' && userId) {
      console.log('🔄 OAUTH: GitHub refresh with direct userId - SIMPLE MODE');
      // Skip all session validation for refresh - just use the userId directly
    } else if (!sessionToken && !userId) {
      console.error('❌ OAUTH ERROR: No session token or userId provided');
      return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=login_required&returnTo=${encodeURIComponent(returnTo)}`));
    }

    console.log('🔍 OAUTH: Parameters - userId:', userId, 'sessionToken:', sessionToken ? 'present' : 'none');

    // Check if it's a temporary session (for GitHub signin)
    if (sessionToken && sessionToken.startsWith('temp_')) {
      console.log('🔄 OAUTH: Validating temporary session for GitHub signin...');
      const { validateTempSession } = await import('@/lib/session-utils');
      const tempResult = validateTempSession(sessionToken);
      
      if (!tempResult.valid || tempResult.purpose !== 'github_signin') {
        console.error('❌ OAUTH ERROR: Invalid temporary session');
        return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=temp_session_expired`));
      }
      
      isTemporarySession = true;
      console.log('✅ OAUTH: Valid temporary session for GitHub signin');
    } else if (sessionToken && !userId) {
      // Only do session validation for signin flows when no direct userId provided
      console.log('🔍 OAUTH: Session validation needed for signin flow...');
      
      try {
        const sessionResponse = await fetch('https://master.d3dp89x98knsw0.amplifyapp.com/api/auth/validate-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken })
        });
        
        const sessionData = await sessionResponse.json();
        
        if (sessionData.success && sessionData.userId) {
          userId = sessionData.userId;
          console.log('✅ OAUTH: Session validation successful for user:', userId);
        } else {
          console.error('❌ OAUTH: Session validation failed, redirecting to signin');
          return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=session_expired&returnTo=${encodeURIComponent(returnTo)}`));
        }
      } catch (error) {
        console.error('❌ OAUTH: Session validation error:', error);
        return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=session_error&returnTo=${encodeURIComponent(returnTo)}`));
      }
    }
    
    // At this point we should have userId either from direct parameter or session validation
    if (!userId && !isTemporarySession) {
      console.error('❌ OAUTH: No userId available after validation');
      return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=no_user_id&returnTo=${encodeURIComponent(returnTo)}`));
    }
    
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

    // userId is now validated from session above

    // Generate state with user info and session type for callback
    const stateData = {
      userId: userId, // null for temporary sessions
      returnTo: returnTo,
      isTemporarySession: isTemporarySession,
      purpose: purpose,
      sessionToken: isTemporarySession ? sessionToken : undefined, // Include temp session for callback
      random: Math.random().toString(36).substring(2, 15)
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    console.log('🔒 OAUTH: Generated state for', isTemporarySession ? 'GitHub signin' : `authenticated user: ${userId}`);
    
    // Create GitHub OAuth URL with parameters to force fresh authentication
    const oauthUrl = new URL('https://github.com/login/oauth/authorize');
    oauthUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
    oauthUrl.searchParams.append('redirect_uri', GITHUB_REDIRECT_URI);
    oauthUrl.searchParams.append('scope', 'repo read:user user:email');
    oauthUrl.searchParams.append('state', state);
    oauthUrl.searchParams.append('allow_signup', 'false'); // Require existing account
    
    // Add cache-busting parameter to force fresh authentication
    oauthUrl.searchParams.append('_t', Date.now().toString());

    console.log('🔐 OAUTH: Generated direct OAuth URL for authentication');
    console.log('🚀 OAUTH: Automatically redirecting to:', oauthUrl.toString());

    // Directly redirect to OAuth (GitHub will handle login if needed)
    return NextResponse.redirect(oauthUrl.toString());
  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
} 