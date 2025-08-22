import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Callback environment test',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? 'Present' : 'Missing',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? 'Present' : 'Missing',
        DATABASE_URL: process.env.DATABASE_URL ? 'Present' : 'Missing',
        allGithubKeys: Object.keys(process.env).filter(key => key.includes('GITHUB')),
        allEnvKeys: Object.keys(process.env).length,
        timestamp: new Date().toISOString()
      },
      searchParamsTest: {
        canAccessSearchParams: true,
        testParam: request.nextUrl.searchParams.get('test') || 'no-test-param'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Environment test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 