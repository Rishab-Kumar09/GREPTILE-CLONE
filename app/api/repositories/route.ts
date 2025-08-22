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
    console.log('📊 API: Received repository data:', body);
    
    // Clean and validate the data
    const repoData = {
      name: body.name || '',
      fullName: body.fullName || '',
      description: body.description || null,
      stars: parseInt(body.stars) || 0,
      forks: parseInt(body.forks) || 0,
      language: body.language || null,
      url: body.url || '',
      bugs: parseInt(body.bugs) || 0,
      analyzing: Boolean(body.analyzing) || false,
      analysisResults: body.analysisResults || null
    };

    console.log('🔧 API: Cleaned repository data:', repoData);
    
    const repository = await prisma.repository.upsert({
      where: { fullName: repoData.fullName },
      update: {
        name: repoData.name,
        description: repoData.description,
        stars: repoData.stars,
        forks: repoData.forks,
        language: repoData.language,
        url: repoData.url,
        bugs: repoData.bugs,
        analyzing: repoData.analyzing,
        analysisResults: repoData.analysisResults
      },
      create: {
        name: repoData.name,
        fullName: repoData.fullName,
        description: repoData.description,
        stars: repoData.stars,
        forks: repoData.forks,
        language: repoData.language,
        url: repoData.url,
        bugs: repoData.bugs,
        analyzing: repoData.analyzing,
        analysisResults: repoData.analysisResults
      }
    });

    console.log('✅ API: Repository saved successfully:', repository.fullName);
    return NextResponse.json(repository);
  } catch (error) {
    console.error('❌ API: Failed to save repository:', error);
    return NextResponse.json(
      { error: 'Failed to save repository', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 