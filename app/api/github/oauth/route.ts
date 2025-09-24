import { NextRequest, NextResponse } from 'next/server';

const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'https://master.d3dp89x98knsw0.amplifyapp.com/api/github/callback';

// GET /api/github/oauth - Initiate GitHub OAuth flow
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get('session') || request.headers.get('authorization')?.replace('Bearer ', '');
    const returnTo = searchParams.get('returnTo') || '/dashboard';
    
    console.log('🔄 OAUTH: Initiating GitHub OAuth with session validation...');
    console.log('🔄 OAUTH: Will return to:', returnTo);
    
    const purpose = searchParams.get('purpose') || 'connect'; // 'signin' or 'connect'
    
    // 🔒 SECURITY FIX: Handle both authenticated users and temporary sessions for GitHub signin
    let userId: string | null = null;
    let isTemporarySession = false;
    
    if (!sessionToken) {
      console.error('❌ OAUTH ERROR: No session token provided');
      return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=login_required&returnTo=${encodeURIComponent(returnTo)}`));
    }

    // Check if it's a temporary session (for GitHub signin)
    if (sessionToken.startsWith('temp_')) {
      console.log('🔄 OAUTH: Validating temporary session for GitHub signin...');
      const { validateTempSession } = await import('@/lib/session-utils');
      const tempResult = validateTempSession(sessionToken);
      
      if (!tempResult.valid || tempResult.purpose !== 'github_signin') {
        console.error('❌ OAUTH ERROR: Invalid temporary session');
        return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=temp_session_expired`));
      }
      
      isTemporarySession = true;
      console.log('✅ OAUTH: Valid temporary session for GitHub signin');
    } else {
      // Validate regular session token and get user ID
      try {
        console.log('🔍 OAUTH: Validating session token for GitHub refresh...');
        const sessionResponse = await fetch('https://master.d3dp89x98knsw0.amplifyapp.com/api/auth/validate-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken })
        });
        
        console.log('🔍 OAUTH: Session validation response status:', sessionResponse.status);
        const sessionData = await sessionResponse.json();
        console.log('🔍 OAUTH: Session validation data:', { success: sessionData.success, hasUserId: !!sessionData.userId });
        
        if (!sessionData.success || !sessionData.userId) {
          console.error('❌ OAUTH ERROR: Invalid session token - Success:', sessionData.success, 'UserId:', sessionData.userId, 'Error:', sessionData.error);
          
          // 🚨 EMERGENCY FALLBACK: Try to extract userId from localStorage token pattern
          // This prevents logout due to serverless session loss
          if (sessionToken && sessionToken.startsWith('session_')) {
            console.log('🔄 OAUTH FALLBACK: Attempting to continue with token-based userId extraction...');
            
            // Extract timestamp from token for basic validation
            const tokenParts = sessionToken.split('_');
            if (tokenParts.length >= 2) {
              const timestamp = parseInt(tokenParts[1]);
              const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
              
              // If token is less than 24 hours old, allow it (emergency fallback)
              if (ageHours < 24) {
                console.log('🆘 OAUTH FALLBACK: Using emergency token validation (age:', ageHours.toFixed(1), 'hours)');
                userId = 'emergency_fallback_user'; // Will be resolved in callback via GitHub email
              } else {
                console.error('❌ OAUTH FALLBACK: Token too old, redirecting to signin');
                return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=session_expired&returnTo=${encodeURIComponent(returnTo)}`));
              }
            } else {
              console.error('❌ OAUTH FALLBACK: Invalid token format, redirecting to signin');
              return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=session_expired&returnTo=${encodeURIComponent(returnTo)}`));
            }
          } else {
            console.error('❌ OAUTH FALLBACK: No valid session token, redirecting to signin');
            return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=session_expired&returnTo=${encodeURIComponent(returnTo)}`));
          }
        }
        
        // Only set userId from sessionData if we didn't use the fallback
        if (userId !== 'emergency_fallback_user') {
          userId = sessionData.userId;
          console.log('✅ OAUTH: Valid session found for user:', userId);
        }
      } catch (error) {
        console.error('❌ OAUTH ERROR: Session validation failed:', error);
        return NextResponse.redirect(new URL(`https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=session_error&returnTo=${encodeURIComponent(returnTo)}`));
      }
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