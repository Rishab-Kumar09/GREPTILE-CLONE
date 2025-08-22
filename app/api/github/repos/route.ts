import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client'; // Changed from relative import
const prisma = new PrismaClient(); // Direct instantiation

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const username = searchParams.get('username') || 'octocat'
    
    // For demo purposes, we'll use GitHub's public API without authentication
    // In production, you'd use the user's GitHub token
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=10`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch repositories')
    }

    const repos = await response.json()
    
    // Transform the data to match our frontend interface
    const transformedRepos = repos.map((repo: any, index: number) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      language: repo.language || 'Unknown',
      lastReview: getRandomTimeAgo(),
      status: index % 3 === 0 ? 'active' : index % 3 === 1 ? 'pending' : 'inactive',
      reviews: Math.floor(Math.random() * 100) + 10,
      bugs: Math.floor(Math.random() * 20) + 1,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isPrivate: repo.private,
      description: repo.description,
      updatedAt: repo.updated_at,
      htmlUrl: repo.html_url
    }))

    return NextResponse.json(transformedRepos)
  } catch (error) {
    console.error('Error fetching repositories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}

function getRandomTimeAgo() {
  const timeOptions = ['2 hours ago', '1 day ago', '3 days ago', '1 week ago', '2 weeks ago']
  return timeOptions[Math.floor(Math.random() * timeOptions.length)]
} 