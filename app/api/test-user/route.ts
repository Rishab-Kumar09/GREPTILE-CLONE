import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple database query without Prisma types to avoid errors
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Raw query to check if user table exists and has data
    const result = await prisma.$queryRaw`
      SELECT id, name, email, 
             CASE 
               WHEN "profileImage" IS NOT NULL THEN 'HAS_IMAGE' 
               ELSE 'NO_IMAGE' 
             END as image_status,
             LENGTH("profileImage") as image_size,
             "selectedIcon", "userTitle", "createdAt", "updatedAt"
      FROM "User" 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `;
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      message: 'User data found',
      users: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Database test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Could not query user table - may need migration',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 