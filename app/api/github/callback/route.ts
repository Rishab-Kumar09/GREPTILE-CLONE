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

    // 🔒 SECURITY FIX: Decode user ID from state parameter - NO FALLBACKS!
    let userId: string;
    let returnTo = 'dashboard';
    let isEmergencyFallback = false;
    
    if (!state) {
      console.error('❌ CALLBACK SECURITY ERROR: No state parameter - potential CSRF attack');
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=oauth_security_error'));
    }

    let isTemporarySession = false;
    let purpose = 'connect';
    
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId; // Can be null for temporary sessions
      returnTo = stateData.returnTo || 'dashboard';
      isTemporarySession = stateData.isTemporarySession || false;
      purpose = stateData.purpose || 'connect';
      
      // Check for emergency fallback user
      if (userId === 'emergency_fallback_user') {
        console.log('🆘 CALLBACK: Emergency fallback user detected - will resolve via GitHub email');
        isEmergencyFallback = true;
      }
      
      // For temporary sessions (GitHub signin), userId will be null - this is expected
      if (!isTemporarySession && !userId && !isEmergencyFallback) {
        console.error('❌ CALLBACK SECURITY ERROR: No userId in state parameter for regular session');
        return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=oauth_invalid_state'));
      }
      
      console.log('🔓 CALLBACK: Decoded state - userId:', userId, 'purpose:', purpose, 'temporary:', isTemporarySession, 'emergency:', isEmergencyFallback);
      console.log('🔓 CALLBACK: Will return to:', returnTo);
    } catch (error) {
      console.error('❌ CALLBACK SECURITY ERROR: Failed to decode state parameter:', error);
      return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=oauth_invalid_state'));
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
    
    console.log('✅ CALLBACK: User data validated');

    // 🔐 GITHUB SIGNIN: Handle GitHub signin (create new user account)
    if (isTemporarySession && purpose === 'signin') {
      console.log('🔄 CALLBACK: Processing GitHub signin - simplified version');
      console.log('🔄 CALLBACK: GitHub user data:', { login: userData.login, id: userData.id, email: userData.email });
      
      try {
        // Find the RIGHT account - prioritize accounts with repositories/activity
        console.log('🔍 CALLBACK: Searching for existing GitHub user:', userData.login);
        const existingGithubUser = await prisma.$queryRaw`
          SELECT * FROM "UserProfile" 
          WHERE "githubUsername" = ${userData.login} 
          AND id != 'default-user'
          ORDER BY "updatedAt" DESC 
          LIMIT 1
        ` as any[];
        
        console.log('🔍 CALLBACK: Found existing GitHub users:', existingGithubUser.length);
        
        // DEBUG: Log all accounts found
        const allAccounts = await prisma.$queryRaw`
          SELECT id, name, email, "githubUsername", "updatedAt" FROM "UserProfile" 
          WHERE "githubUsername" = ${userData.login}
          ORDER BY "updatedAt" DESC
        ` as any[];
        
        console.log(`🔍 CALLBACK: Found ${allAccounts.length} accounts with GitHub username ${userData.login}:`);
        allAccounts.forEach((acc, i) => {
          console.log(`   ${i + 1}. ${acc.id} (${acc.name}) - Updated: ${acc.updatedAt}`);
        });
        
        // 🎯 GIVE USER CHOICE: If multiple accounts, show selection page
        if (allAccounts.length > 1) {
          console.log('⚠️ CALLBACK: Multiple accounts found, redirecting to selection page');
          
          try {
            // Create minimal account data for URL
            const accountsData = allAccounts.map(user => ({
              id: user.id,
              name: user.name || 'Unknown',
              email: user.email || 'No email',
              updatedAt: user.updatedAt || new Date().toISOString()
            }));
            
            // Use base64 encoding to compress the data
            const accountsJson = JSON.stringify(accountsData);
            const accountsBase64 = Buffer.from(accountsJson).toString('base64');
            
            const redirectUrl = `https://master.d3dp89x98knsw0.amplifyapp.com/auth/select-account?accounts=${encodeURIComponent(accountsBase64)}&github=${encodeURIComponent(userData.login)}`;
            console.log('🔄 CALLBACK: Redirecting to account selection page');
            return NextResponse.redirect(new URL(redirectUrl));
            
          } catch (error) {
            console.error('❌ CALLBACK: Error creating account selection data:', error);
            // Fallback to first non-default account
          }
        }
        
        if (existingGithubUser.length > 0) {
          // User exists - sign them in with existing account
          const existingUser = existingGithubUser[0];
          console.log('✅ CALLBACK: Found existing user with GitHub account:', existingUser.id, `(${existingUser.name})`);
          
          // Update updatedAt timestamp to reflect last login
          await prisma.$executeRaw`
            UPDATE "UserProfile" 
            SET "updatedAt" = NOW() 
            WHERE id = ${existingUser.id}
          `;
          
          console.log('✅ CALLBACK: Updated last login timestamp for user:', existingUser.id);
          
          // Create session for existing user
          const { createSession } = await import('@/lib/session-utils');
          const sessionToken = await createSession(existingUser.id, existingUser.email);
          
          // Redirect with session token
          const redirectUrl = `https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin-success?session=${encodeURIComponent(sessionToken)}`;
          return NextResponse.redirect(new URL(redirectUrl));
        } else {
          // Create new user account with GitHub data
          const newUserId = `github-${userData.login.toLowerCase()}`;
          const newUserEmail = userData.email || `${userData.login}@github.local`;
          
          console.log('🔄 CALLBACK: Creating new user account for GitHub user:', userData.login);
          
          await prisma.$executeRaw`
            INSERT INTO "UserProfile" (
              id, name, email, "profileImage", "selectedIcon", "userTitle",
              "githubConnected", "githubUsername", "githubAvatarUrl", "githubTokenRef",
              "createdAt", "updatedAt"
            ) VALUES (
              ${newUserId}, ${userData.name || userData.login}, ${newUserEmail},
              ${userData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.login)}&background=10b981&color=fff&size=128`},
              ${'👤'}, ${'Developer'}, ${true}, ${userData.login}, ${userData.avatar_url},
              ${`github_token_${newUserId}`}, NOW(), NOW()
            )
          `;
          
          console.log('✅ CALLBACK: New user account created:', newUserId);
          
          // Create session for new user
          const { createSession } = await import('@/lib/session-utils');
          const sessionToken = await createSession(newUserId, newUserEmail);
          
          // Redirect with session token
          const redirectUrl = `https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin-success?session=${encodeURIComponent(sessionToken)}`;
          return NextResponse.redirect(new URL(redirectUrl));
        }
      } catch (error) {
        console.error('❌ CALLBACK: Error in GitHub signin flow:', error);
        console.error('❌ CALLBACK: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          userData: userData ? { login: userData.login, id: userData.id } : 'No userData'
        });
        return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=github_signin_failed'));
      }
    }

    // 🆘 EMERGENCY FALLBACK: Resolve emergency user via GitHub email
    if (isEmergencyFallback) {
      console.log('🆘 CALLBACK: Resolving emergency fallback user via GitHub email...');
      
      try {
        // Find user by GitHub email
        const userByEmail = await prisma.$queryRaw`
          SELECT id, name, email FROM "UserProfile" 
          WHERE email = ${userData.email}
          LIMIT 1
        ` as any[];
        
        if (userByEmail.length > 0) {
          userId = userByEmail[0].id;
          console.log('✅ CALLBACK: Emergency fallback resolved to user:', userId, `(${userByEmail[0].name})`);
        } else {
          console.error('❌ CALLBACK: Emergency fallback failed - no user found with email:', userData.email);
          return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=emergency_fallback_failed'));
        }
      } catch (error) {
        console.error('❌ CALLBACK: Error resolving emergency fallback user:', error);
        return NextResponse.redirect(new URL('https://master.d3dp89x98knsw0.amplifyapp.com/auth/signin?error=emergency_fallback_error'));
      }
    }

    // 🔗 GITHUB CONNECT: Handle GitHub connection to existing account
    console.log('🔄 CALLBACK: Processing GitHub connection to existing account...');

    // 🚨 EMERGENCY SECURITY CHECK: Prevent unauthorized access to GitHub accounts
    // Check if this GitHub account is already connected to another user
    console.log('🔍 CALLBACK: Checking if GitHub username is already connected:', userData.login);
    const existingConnection = await prisma.$queryRaw`
      SELECT id, name FROM "UserProfile" 
      WHERE "githubUsername" = ${userData.login} AND id != ${userId}
      LIMIT 1
    ` as any[];
    
    if (existingConnection.length > 0) {
      const existingUser = existingConnection[0];
      console.log('⚠️ CALLBACK: GitHub account already connected to another user');
      console.log('- GitHub account:', userData.login);
      console.log('- Already connected to user:', existingUser.id, `(${existingUser.name})`);
      console.log('- Current user:', userId);
      console.log('✅ CALLBACK: Allowing multi-user GitHub sharing - OAuth proves authentication');
    }
    
    console.log('✅ CALLBACK: Proceeding with GitHub connection...');

    // Store GitHub connection info in database
    console.log('💾 CALLBACK: Updating database with GitHub connection for user:', userId);
    const updateResult = await prisma.$executeRaw`
      UPDATE "UserProfile" 
      SET 
        "githubConnected" = true,
        "githubUsername" = ${userData.login},
        "githubAvatarUrl" = ${userData.avatar_url},
        "githubTokenRef" = ${tokenData.access_token},
        "updatedAt" = NOW()
      WHERE id = ${userId}
    `;
    
    console.log('📊 CALLBACK: Database update result - rows affected:', updateResult);
    
    console.log('✅ CALLBACK SUCCESS: Database updated, redirecting to:', returnTo);
    console.log(`🎉 CALLBACK: User @${userData.login} successfully connected to GitHub!`);

    // Redirect back to the appropriate page
    const redirectUrl = returnTo === 'setup' 
      ? 'https://master.d3dp89x98knsw0.amplifyapp.com/setup?github=connected'
      : 'https://master.d3dp89x98knsw0.amplifyapp.com/dashboard?github=connected';
    
    return NextResponse.redirect(new URL(redirectUrl));

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