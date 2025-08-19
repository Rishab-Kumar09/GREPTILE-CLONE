import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/repositories - Get all repositories
export async function GET() {
  try {
    const repositories = await prisma.repository.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(repositories);
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

// POST /api/repositories - Save a new repository
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const repository = await prisma.repository.upsert({
      where: { fullName: body.fullName },
      update: {
        name: body.name,
        description: body.description,
        stars: body.stars,
        forks: body.forks,
        language: body.language,
        url: body.url,
        bugs: body.bugs || 0,
        analyzing: body.analyzing || false
        // analysisResults: body.analysisResults || null // Temporarily disabled until Prisma client regenerated
      },
      create: {
        name: body.name,
        fullName: body.fullName,
        description: body.description,
        stars: body.stars,
        forks: body.forks,
        language: body.language,
        url: body.url,
        bugs: body.bugs || 0,
        analyzing: body.analyzing || false
        // analysisResults: body.analysisResults || null // Temporarily disabled until Prisma client regenerated
      }
    });

    return NextResponse.json(repository);
  } catch (error) {
    console.error('Failed to save repository:', error);
    return NextResponse.json(
      { error: 'Failed to save repository' },
      { status: 500 }
    );
  }
} 