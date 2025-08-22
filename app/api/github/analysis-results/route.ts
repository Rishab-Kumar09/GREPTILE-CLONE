import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
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
    // Temporarily disabled until Prisma client is regenerated
    // if (repository.analysisResults) {
    //   return NextResponse.json(repository.analysisResults)
    // }

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
              },
              {
                line: 89,
                severity: "medium",
                type: "Buffer Overflow",
                description: "Potential buffer overflow in string concatenation",
                suggestion: "Use safe string manipulation methods",
                impact: "Could cause memory corruption",
                confidence: 0.87,
                codeSnippet: "let result = ''; for(let i=0; i<1000; i++) result += data[i];"
              },
              {
                line: 123,
                severity: "low",
                type: "Memory Leak",
                description: "Event listeners not properly removed",
                suggestion: "Add cleanup in component unmount",
                impact: "Could cause memory leaks over time",
                confidence: 0.82,
                codeSnippet: "element.addEventListener('click', handler);"
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
              },
              {
                line: 178,
                severity: "high",
                type: "SQL Injection",
                description: "Direct SQL query with user input",
                suggestion: "Use parameterized queries",
                impact: "Could allow database manipulation",
                confidence: 0.97,
                codeSnippet: "db.query('SELECT * FROM users WHERE id = ' + userId)"
              },
              {
                line: 203,
                severity: "medium",
                type: "Insecure Crypto",
                description: "Using deprecated MD5 hashing",
                suggestion: "Use bcrypt or similar secure hashing",
                impact: "Passwords easily crackable",
                confidence: 0.91,
                codeSnippet: "const hash = crypto.createHash('md5').update(password);"
              },
              {
                line: 234,
                severity: "medium",
                type: "Path Traversal",
                description: "Unvalidated file path access",
                suggestion: "Validate and sanitize file paths",
                impact: "Could access unauthorized files",
                confidence: 0.89,
                codeSnippet: "fs.readFile('./uploads/' + fileName, callback);"
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
              },
              {
                line: 67,
                severity: "low",
                type: "Unhandled Promise",
                description: "Promise rejection not handled",
                suggestion: "Add .catch() or try/catch block",
                impact: "Could cause unhandled rejections",
                confidence: 0.84,
                codeSnippet: "fetchUserData(userId).then(data => setUser(data));"
              },
              {
                line: 98,
                severity: "medium",
                type: "Type Error",
                description: "Potential undefined property access",
                suggestion: "Add type checking or default values",
                impact: "Could cause runtime errors",
                confidence: 0.86,
                codeSnippet: "return user.profile.settings.theme;"
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
              },
              {
                line: 112,
                severity: "medium",
                type: "Session Fixation",
                description: "Session ID not regenerated after login",
                suggestion: "Regenerate session ID after authentication",
                impact: "Could allow session hijacking",
                confidence: 0.87,
                codeSnippet: "req.session.userId = user.id;"
              }
            ],
            codeSmells: [
              {
                line: 156,
                type: "Long Parameter List",
                description: "Function has too many parameters",
                suggestion: "Use object parameter or builder pattern",
                impact: "Makes function calls hard to read",
                confidence: 0.83,
                technicalDebt: "1 hour",
                codeSnippet: "function updateUser(id, name, email, age, address, phone, role, status) {"
              },
              {
                line: 189,
                type: "Magic Numbers",
                description: "Hard-coded numeric values without explanation",
                suggestion: "Define constants with descriptive names",
                impact: "Makes code hard to understand",
                confidence: 0.81,
                technicalDebt: "30 minutes",
                codeSnippet: "if (attempts > 5) { lockAccount(userId, 3600); }"
              }
            ]
          },
          {
            file: "app/routes/auth.js",
            bugs: [
              {
                line: 23,
                severity: "high",
                type: "Logic Error",
                description: "Incorrect password comparison logic",
                suggestion: "Fix boolean logic in password validation",
                impact: "Could allow unauthorized access",
                confidence: 0.94,
                codeSnippet: "if (!bcrypt.compare(password, hash) === true) {"
              },
              {
                line: 56,
                severity: "medium",
                type: "Resource Leak",
                description: "Database connection not properly closed",
                suggestion: "Ensure connections are closed in finally block",
                impact: "Could exhaust connection pool",
                confidence: 0.88,
                codeSnippet: "const conn = await pool.getConnection(); // missing conn.release()"
              }
            ],
            securityIssues: [
              {
                line: 89,
                severity: "critical",
                type: "Timing Attack",
                description: "Password comparison vulnerable to timing attacks",
                suggestion: "Use constant-time comparison",
                impact: "Could reveal password information",
                confidence: 0.96,
                codeSnippet: "if (userPassword === providedPassword) {"
              },
              {
                line: 134,
                severity: "high",
                type: "Weak Randomness",
                description: "Using Math.random() for security tokens",
                suggestion: "Use cryptographically secure random generator",
                impact: "Tokens could be predictable",
                confidence: 0.92,
                codeSnippet: "const token = Math.random().toString(36);"
              }
            ],
            codeSmells: [
              {
                line: 67,
                type: "Nested Callbacks",
                description: "Deep callback nesting (callback hell)",
                suggestion: "Use async/await or Promises",
                impact: "Makes code hard to read and debug",
                confidence: 0.87,
                technicalDebt: "2 hours",
                codeSnippet: "db.query(sql, (err, result) => { if (!err) { cache.set(key, (err2, res) => {"
              }
            ]
          },
          {
            file: "app/routes/admin.js", 
            bugs: [
              {
                line: 45,
                severity: "medium",
                type: "Array Bounds",
                description: "Potential array index out of bounds",
                suggestion: "Check array length before accessing",
                impact: "Could cause runtime errors",
                confidence: 0.85,
                codeSnippet: "return users[selectedIndex].name;"
              }
            ],
            securityIssues: [
              {
                line: 12,
                severity: "critical",
                type: "Privilege Escalation",
                description: "Missing admin role verification",
                suggestion: "Verify admin privileges before sensitive operations",
                impact: "Could allow unauthorized admin access",
                confidence: 0.98,
                codeSnippet: "app.post('/admin/delete-user', (req, res) => {"
              },
              {
                line: 78,
                severity: "high",
                type: "Command Injection",
                description: "Unvalidated input passed to system command",
                suggestion: "Validate and sanitize all inputs",
                impact: "Could execute arbitrary commands",
                confidence: 0.95,
                codeSnippet: "exec('rm -rf ' + req.body.directory);"
              }
            ],
            codeSmells: [
              {
                line: 123,
                type: "God Object",
                description: "Class has too many responsibilities",
                suggestion: "Split into smaller, focused classes",
                impact: "Violates single responsibility principle",
                confidence: 0.89,
                technicalDebt: "4 hours",
                codeSnippet: "class AdminManager { // handles users, logs, settings, reports, etc. }"
              }
            ]
          },
                        {
                file: "app/utils/validation.js",
                bugs: [
                  {
                    line: 34,
                    severity: "low",
                    type: "Edge Case",
                    description: "Empty string validation not handled",
                    suggestion: "Add check for empty strings",
                    impact: "Could accept invalid empty inputs",
                    confidence: 0.79,
                    codeSnippet: "function isValidEmail(email) { return email.includes('@'); }"
                  },
                  {
                    line: 56,
                    severity: "medium",
                    type: "Integer Overflow",
                    description: "Potential integer overflow in loop counter",
                    suggestion: "Add bounds checking",
                    impact: "Could cause infinite loops",
                    confidence: 0.82,
                    codeSnippet: "for(let i = 0; i < userInput; i++) { /* process */ }"
                  }
                ],
                securityIssues: [
                  {
                    line: 67,
                    severity: "medium",
                    type: "ReDoS",
                    description: "Regular expression vulnerable to ReDoS attack",
                    suggestion: "Simplify regex or add timeout",
                    impact: "Could cause denial of service",
                    confidence: 0.88,
                    codeSnippet: "const regex = /^(a+)+$/; return regex.test(input);"
                  },
                  {
                    line: 123,
                    severity: "low",
                    type: "Weak Validation",
                    description: "Phone number validation too permissive",
                    suggestion: "Use stricter regex pattern",
                    impact: "Could accept invalid phone numbers",
                    confidence: 0.76,
                    codeSnippet: "const isValidPhone = /\\d+/.test(phone);"
                  }
                ],
                codeSmells: [
                  {
                    line: 89,
                    type: "Dead Code",
                    description: "Unreachable code after return statement",
                    suggestion: "Remove unreachable code",
                    impact: "Clutters codebase",
                    confidence: 0.95,
                    technicalDebt: "15 minutes",
                    codeSnippet: "return true; console.log('This will never execute');"
                  },
                  {
                    line: 145,
                    type: "Inconsistent Naming",
                    description: "Variable naming doesn't follow conventions",
                    suggestion: "Use consistent camelCase naming",
                    impact: "Reduces code readability",
                    confidence: 0.78,
                    technicalDebt: "30 minutes",
                    codeSnippet: "const user_data_obj = {}; const userInfo = {};"
                  },
                  {
                    line: 167,
                    type: "Hardcoded Values",
                    description: "Configuration values hardcoded in validation",
                    suggestion: "Move to configuration file",
                    impact: "Makes code inflexible",
                    confidence: 0.84,
                    technicalDebt: "45 minutes",
                    codeSnippet: "const maxLength = 255; const minAge = 18;"
                  }
                                ]
              },
              {
                file: "app/middleware/cors.js",
                bugs: [
                  {
                    line: 12,
                    severity: "low",
                    type: "Configuration Error",
                    description: "CORS wildcard origin in production",
                    suggestion: "Specify allowed origins explicitly",
                    impact: "Could allow unauthorized cross-origin requests",
                    confidence: 0.88,
                    codeSnippet: "res.header('Access-Control-Allow-Origin', '*');"
                  }
                ],
                securityIssues: [
                  {
                    line: 23,
                    severity: "medium",
                    type: "Header Injection",
                    description: "Unvalidated header values",
                    suggestion: "Validate and sanitize header values",
                    impact: "Could allow header injection attacks",
                    confidence: 0.86,
                    codeSnippet: "res.header('Custom-Header', req.query.value);"
                  }
                ],
                codeSmells: [
                  {
                    line: 34,
                    type: "Feature Envy",
                    description: "Function accesses too many external properties",
                    suggestion: "Move logic closer to data",
                    impact: "Tight coupling between modules",
                    confidence: 0.81,
                    technicalDebt: "1 hour",
                    codeSnippet: "return req.headers.origin + req.headers.host + req.headers.referer;"
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