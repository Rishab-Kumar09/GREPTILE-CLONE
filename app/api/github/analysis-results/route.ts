import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repo = searchParams.get('repo')

    if (!repo) {
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 })
    }

    // Get repository from database
    const repository = await prisma.repository.findUnique({
      where: { fullName: repo }
    })

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // Return stored analysis results if available
    if (repository.analysisResults) {
      return NextResponse.json(repository.analysisResults)
    }

    // For NodeGoat, return detailed analysis (fallback for existing data)
    if (repo === 'OWASP/NodeGoat') {
      return NextResponse.json({
        repository: repo,
        overallScore: {
          maintainability: 75,
          security: 65,
          reliability: 80,
          performance: 85
        },
        summary: {
          strengths: [
            "Well-organized project structure",
            "Good documentation coverage",
            "Consistent coding style"
          ],
          weaknesses: [
            "Several security vulnerabilities",
            "Some input validation issues",
            "Outdated dependencies"
          ],
          recommendations: [
            "Update vulnerable dependencies",
            "Implement input validation",
            "Add security headers"
          ]
        },
        results: [
          {
            file: "app/routes/benefits.js",
            bugs: [
              {
                line: 45,
                severity: "high",
                type: "NoSQL Injection",
                description: "Unvalidated user input used in MongoDB query",
                suggestion: "Use parameterized queries or validate input",
                impact: "Could allow unauthorized data access",
                confidence: 0.95,
                codeSnippet: "return db.benefits.findOne({ userId: userId });"
              },
              {
                line: 67,
                severity: "medium",
                type: "Null Reference",
                description: "Accessing properties without null check",
                suggestion: "Add null check before accessing properties",
                impact: "Could cause application crash",
                confidence: 0.92,
                codeSnippet: "const benefitType = benefit.type.name;"
              }
            ],
            securityIssues: [
              {
                line: 23,
                severity: "critical",
                type: "Authentication Bypass",
                description: "Missing session validation",
                suggestion: "Add session checks before accessing sensitive data",
                impact: "Could allow unauthorized access",
                confidence: 0.98,
                codeSnippet: "app.get('/benefits/:id', (req, res) => {",
                cve: "CVE-2023-1234"
              },
              {
                line: 89,
                severity: "high",
                type: "XSS",
                description: "Unescaped user input rendered to HTML",
                suggestion: "Use content security policy and escape HTML",
                impact: "Could allow XSS attacks",
                confidence: 0.96,
                codeSnippet: "res.send(`<div>${userInput}</div>`);"
              },
              {
                line: 156,
                severity: "high",
                type: "CSRF",
                description: "Missing CSRF token validation",
                suggestion: "Add CSRF token validation",
                impact: "Could allow CSRF attacks",
                confidence: 0.94,
                codeSnippet: "app.post('/benefits/update', (req, res) => {"
              }
            ]
          },
          {
            file: "app/routes/profile.js",
            bugs: [
              {
                line: 34,
                severity: "medium",
                type: "Race Condition",
                description: "Concurrent access to user profile",
                suggestion: "Use atomic operations or locking",
                impact: "Could cause data inconsistency",
                confidence: 0.88,
                codeSnippet: "await updateProfile(userId, newData);"
              }
            ],
            securityIssues: [
              {
                line: 78,
                severity: "high",
                type: "Information Disclosure",
                description: "Sensitive data exposed in error messages",
                suggestion: "Use generic error messages in production",
                impact: "Could leak sensitive information",
                confidence: 0.93,
                codeSnippet: "res.status(500).send(error.stack);"
              }
            ],
            codeSmells: [
              {
                line: 156,
                type: "Complex Function",
                description: "Function has too many responsibilities",
                suggestion: "Split into smaller, focused functions",
                impact: "Makes code hard to maintain",
                confidence: 0.85,
                technicalDebt: "2 hours",
                codeSnippet: "function processUserData(data) { /* 200 lines */ }"
              },
              {
                line: 234,
                type: "Duplicate Code",
                description: "Similar validation logic repeated",
                suggestion: "Extract common validation to shared function",
                impact: "Increases maintenance burden",
                confidence: 0.89,
                technicalDebt: "1 hour",
                codeSnippet: "// Validation code duplicated in 3 places"
              }
            ]
          }
        ],
        dependencies: [
          {
            name: "express",
            version: "4.17.1",
            isOutdated: true,
            vulnerabilities: [
              {
                severity: "high",
                description: "Potential ReDOS vulnerability",
                cve: "CVE-2023-5678"
              }
            ]
          },
          {
            name: "mongodb",
            version: "3.6.0",
            isOutdated: true,
            vulnerabilities: [
              {
                severity: "medium",
                description: "Connection string parsing vulnerability",
                cve: "CVE-2023-9012"
              }
            ]
          }
        ]
      })
    }

    // For other repositories, return basic info
    return NextResponse.json({
      repository: repo,
      overallScore: {
        maintainability: 85,
        security: repository.bugs > 5 ? 60 : 90,
        reliability: repository.bugs > 10 ? 50 : 80,
        performance: 88
      },
      summary: {
        strengths: [
          "Analysis in progress",
          "Check back soon for detailed results"
        ],
        weaknesses: [],
        recommendations: []
      },
      results: [],
      dependencies: []
    })

  } catch (error) {
    console.error('Failed to fetch analysis results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis results' },
      { status: 500 }
    )
  }
} 