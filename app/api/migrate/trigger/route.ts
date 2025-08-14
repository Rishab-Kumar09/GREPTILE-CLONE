import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// POST /api/migrate/trigger
// Triggers database schema creation after deployment
export async function POST(request: NextRequest) {
  try {
    // No authentication needed for simple database setup

    console.log('🚀 Starting post-deployment database setup...');

    // Initialize Prisma client
    const prisma = new PrismaClient();
    
    try {
      // 1. Test database connection
      console.log('🔍 Testing database connection...');
      await prisma.$connect();
      
      // 2. Create tables if they don't exist
      console.log('🗄️ Setting up database schema...');
      
      // Create HealthCheck table
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "HealthCheck" (
          id TEXT PRIMARY KEY DEFAULT 'hc_' || substr(md5(random()::text), 0, 25),
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // Create Repository table
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "Repository" (
          id TEXT PRIMARY KEY DEFAULT 'repo_' || substr(md5(random()::text), 0, 25),
          name TEXT NOT NULL,
          "fullName" TEXT UNIQUE NOT NULL,
          description TEXT,
          stars INTEGER DEFAULT 0,
          forks INTEGER DEFAULT 0,
          language TEXT,
          url TEXT NOT NULL,
          bugs INTEGER DEFAULT 0,
          analyzing BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // 3. Insert a test record
      await prisma.$executeRaw`
        INSERT INTO "HealthCheck" ("createdAt") 
        VALUES (CURRENT_TIMESTAMP) 
        ON CONFLICT DO NOTHING;
      `;
      
      // 4. Verify the setup worked
      const testQuery = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "HealthCheck"`;
      console.log('✅ Database setup verified:', testQuery);
      
      await prisma.$disconnect();

      console.log('✅ Database setup completed successfully!');

      return NextResponse.json({
        success: true,
        message: 'Database setup completed successfully',
        timestamp: new Date().toISOString(),
        verification: testQuery
      });

    } catch (dbError) {
      await prisma.$disconnect();
      throw dbError;
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Database setup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 