import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Test accessing search parameters (this was causing the error)
    const { searchParams } = request.nextUrl;
    const testParam = searchParams.get('test') || 'no-param';
    
    return NextResponse.json({
      success: true,
      message: 'Dynamic rendering is working!',
      testParam,
      timestamp: new Date().toISOString(),
      searchParams: Object.fromEntries(searchParams.entries())
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Dynamic rendering failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 