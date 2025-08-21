import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// GET /api/github/repositories - Fetch user's GitHub repositories
export async function GET() {
  try {
    // Get user's GitHub connection info
    const result = await prisma.$queryRaw`
      SELECT "githubConnected", "githubTokenRef", "githubUsername" 
      FROM "UserProfile" 
      WHERE id = 'default-user' 
      LIMIT 1
    ` as any[];

    if (result.length === 0 || !result[0].githubConnected || !result[0].githubTokenRef) {
      return NextResponse.json({
        success: false,
        error: 'GitHub not connected',
        connected: false
      });
    }

    const { githubTokenRef, githubUsername } = result[0];

    // Fetch repositories from GitHub API
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
      headers: {
        'Authorization': `Bearer ${githubTokenRef}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone/1.0'
      }
    });

    if (!response.ok) {
      console.error('GitHub API error:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch repositories from GitHub',
        connected: true
      });
    }

    const repos = await response.json();

    // Transform GitHub repos to our format
    const transformedRepos = repos.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      language: repo.language || 'Unknown',
      url: repo.html_url,
      bugs: Math.floor(Math.random() * 20) + 1, // Mock analysis data for now
      analyzing: false,
      isPrivate: repo.private,
      updatedAt: repo.updated_at,
      createdAt: repo.created_at
    }));

    return NextResponse.json({
      success: true,
      connected: true,
      repositories: transformedRepos,
      username: githubUsername
    });

  } catch (error) {
    console.error('GitHub repositories fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      connected: false
    }, { status: 500 });
  }
} 