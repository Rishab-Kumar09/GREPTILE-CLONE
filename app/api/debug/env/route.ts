import { NextResponse } from 'next/server';

// GET /api/debug/env - Debug environment variables
export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    githubClientId: process.env.GITHUB_CLIENT_ID ? 'Present' : 'Missing',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ? 'Present' : 'Missing',
    databaseUrl: process.env.DATABASE_URL ? 'Present' : 'Missing',
    allGithubKeys: Object.keys(process.env).filter(key => key.includes('GITHUB')),
    timestamp: new Date().toISOString()
  });
} 