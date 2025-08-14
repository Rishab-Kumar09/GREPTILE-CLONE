import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// POST /api/migrate/trigger
// Triggers database schema creation after deployment
export async function POST(request: NextRequest) {
  try {
    // Temporary: Skip authentication for testing
    // const authHeader = request.headers.get('authorization');
    // const expectedToken = process.env.MIGRATION_SECRET || 'your-secret-key';
    
    // if (authHeader !== `Bearer ${expectedToken}`) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    console.log('🚀 Starting post-deployment database setup...');

    // Initialize Prisma client
    const prisma = new PrismaClient();
    
    try {
      // 1. Test database connection
      console.log('🔍 Testing database connection...');
      await prisma.$connect();
      
      // 2. Create HealthCheck table if it doesn't exist
      console.log('🗄️ Setting up database schema...');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "HealthCheck" (
          id SERIAL PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'ok',
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // 3. Insert a test record
      await prisma.$executeRaw`
        INSERT INTO "HealthCheck" (status) 
        VALUES ('migration_successful') 
        ON CONFLICT DO NOTHING;
      `;
      
      // 4. Verify the setup worked
      const testQuery = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "HealthCheck"`;
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