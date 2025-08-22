import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function POST(request: Request) {
  try {
    const { testRepo } = await request.json()
    
    if (!openai) {
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API key not configured',
        hasOpenAI: false
      })
    }

    // Test different repository formats
    const testCases = [
      {
        name: 'NodeGoat Format',
        owner: 'OWASP',
        repo: 'NodeGoat',
        repoUrl: 'https://github.com/OWASP/NodeGoat'
      },
      {
        name: 'GitHub API Format', 
        owner: testRepo?.owner || 'Drishti',
        repo: testRepo?.repo || 'test',
        repoUrl: testRepo?.repoUrl || 'https://github.com/Drishti/test'
      }
    ]

    const results = []

    for (const testCase of testCases) {
      try {
        console.log(`Testing: ${testCase.name} - ${testCase.owner}/${testCase.repo}`)
        
        // Test GitHub API access
        const repoInfoResponse = await fetch(`https://api.github.com/repos/${testCase.owner}/${testCase.repo}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Greptile-Clone'
          }
        })

        results.push({
          testCase: testCase.name,
          owner: testCase.owner,
          repo: testCase.repo,
          repoUrl: testCase.repoUrl,
          githubApiStatus: repoInfoResponse.status,
          githubApiOk: repoInfoResponse.ok,
          error: repoInfoResponse.ok ? null : `GitHub API failed: ${repoInfoResponse.status}`
        })

      } catch (error) {
        results.push({
          testCase: testCase.name,
          owner: testCase.owner,
          repo: testCase.repo,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      hasOpenAI: true,
      openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      testResults: results
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 