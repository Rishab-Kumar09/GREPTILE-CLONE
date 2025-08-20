import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Try to count repositories
    const count = await prisma.repository.count();
    
    // Get a sample repository if any exist
    const sample = await prisma.repository.findFirst();
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      repositoryCount: count,
      sampleRepository: sample,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Database connection test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 