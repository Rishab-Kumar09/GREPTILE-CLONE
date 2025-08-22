import { NextResponse } from 'next/server';

// Internal endpoint to provide GitHub credentials
// This route can access environment variables, callback route cannot
export async function GET() {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'GitHub credentials not found'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      clientId,
      clientSecret
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get credentials'
    }, { status: 500 });
  }
} 