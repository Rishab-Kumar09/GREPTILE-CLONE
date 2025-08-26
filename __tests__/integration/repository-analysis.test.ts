import { NextRequest } from 'next/server'

// Mock Prisma
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
  },
  repository: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

// Mock Octokit
const mockOctokit = {
  rest: {
    repos: {
      getContent: jest.fn(),
    },
  },
}

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit),
}))

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
}

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => mockOpenAI),
}))

describe('Repository Analysis Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Repository Analysis Workflow', () => {
    it('should analyze repository and store results', async () => {
      // Mock user with GitHub connection
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'test-user',
        githubTokenRef: 'github-token',
        githubUsername: 'testuser',
      })

      // Mock repository exists
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: 'repo1',
        userId: 'test-user',
        fullName: 'testuser/test-repo',
        analyzing: false,
      })

      // Mock GitHub API - repository structure
      mockOctokit.rest.repos.getContent
        .mockResolvedValueOnce({
          data: [
            { name: 'src', type: 'dir' },
            { name: 'package.json', type: 'file' },
            { name: 'README.md', type: 'file' },
          ]
        })
        .mockResolvedValueOnce({
          data: [
            { name: 'index.js', type: 'file' },
            { name: 'utils.js', type: 'file' },
          ]
        })
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(`
              function riskyFunction() {
                eval(userInput); // Security vulnerability
                var unused = "test"; // Code smell
              }
            `).toString('base64')
          }
        })
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(`
              function buggyFunction() {
                if (condition = true) { // Assignment instead of comparison
                  return undefined.property; // Potential null reference
                }
              }
            `).toString('base64')
          }
        })

      // Mock OpenAI analysis response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              bugs: [
                {
                  line: 2,
                  severity: 'high',
                  description: 'Assignment in condition instead of comparison',
                  suggestion: 'Use === for comparison'
                }
              ],
              securityIssues: [
                {
                  line: 1,
                  severity: 'critical',
                  description: 'Use of eval() with user input',
                  suggestion: 'Avoid eval(), use safer alternatives'
                }
              ],
              codeSmells: [
                {
                  line: 3,
                  severity: 'low',
                  description: 'Unused variable',
                  suggestion: 'Remove unused variable'
                }
              ]
            })
          }
        }]
      })

      // Mock repository update
      mockPrisma.repository.update.mockResolvedValue({
        id: 'repo1',
        bugs: 2,
        analyzing: false,
        analysisResults: {
          summary: {
            totalBugs: 1,
            totalSecurityIssues: 1,
            totalCodeSmells: 1,
            totalFilesProcessed: 2
          },
          allResults: expect.any(Array)
        }
      })

      const { POST } = require('../../app/api/github/analyze-repository-batch/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/analyze-repository-batch', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          owner: 'testuser',
          repo: 'test-repo',
          batchIndex: 0,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results).toBeDefined()
      expect(data.summary.totalBugs).toBe(1)
      expect(data.summary.totalSecurityIssues).toBe(1)
      expect(data.summary.totalCodeSmells).toBe(1)

      // Verify repository was updated with analysis results
      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId_fullName: {
            userId: 'test-user',
            fullName: 'testuser/test-repo'
          }
        }),
        data: expect.objectContaining({
          bugs: expect.any(Number),
          analyzing: false,
          analysisResults: expect.any(Object)
        })
      })
    })

    it('should handle analysis errors gracefully', async () => {
      // Mock user with GitHub connection
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'test-user',
        githubTokenRef: 'github-token',
        githubUsername: 'testuser',
      })

      // Mock repository exists
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: 'repo1',
        userId: 'test-user',
        fullName: 'testuser/test-repo',
        analyzing: false,
      })

      // Mock GitHub API error
      mockOctokit.rest.repos.getContent.mockRejectedValue(new Error('Repository not found'))

      const { POST } = require('../../app/api/github/analyze-repository-batch/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/analyze-repository-batch', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          owner: 'testuser',
          repo: 'test-repo',
          batchIndex: 0,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Repository not found')
    })

    it('should handle multi-batch analysis', async () => {
      // Mock user and repository
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'test-user',
        githubTokenRef: 'github-token',
      })

      mockPrisma.repository.findUnique.mockResolvedValue({
        id: 'repo1',
        userId: 'test-user',
        fullName: 'testuser/large-repo',
        analyzing: true,
      })

      // Mock large repository structure (more than batch size)
      const largeFileList = Array.from({ length: 15 }, (_, i) => ({
        name: `file${i}.js`,
        type: 'file'
      }))

      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: largeFileList
      })

      // Mock file contents
      mockOctokit.rest.repos.getContent.mockImplementation(({ path }) => {
        if (path.endsWith('.js')) {
          return Promise.resolve({
            data: {
              content: Buffer.from('console.log("test");').toString('base64')
            }
          })
        }
      })

      // Mock OpenAI responses
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              bugs: [],
              securityIssues: [],
              codeSmells: []
            })
          }
        }]
      })

      const { POST } = require('../../app/api/github/analyze-repository-batch/route')
      
      // First batch
      const request1 = new NextRequest('http://localhost:3000/api/github/analyze-repository-batch', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          owner: 'testuser',
          repo: 'large-repo',
          batchIndex: 0,
        }),
      })

      const response1 = await POST(request1)
      const data1 = await response1.json()

      expect(response1.status).toBe(200)
      expect(data1.hasMoreBatches).toBe(true)
      expect(data1.nextBatchIndex).toBe(1)

      // Second batch
      const request2 = new NextRequest('http://localhost:3000/api/github/analyze-repository-batch', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          owner: 'testuser',
          repo: 'large-repo',
          batchIndex: 1,
        }),
      })

      const response2 = await POST(request2)
      const data2 = await response2.json()

      expect(response2.status).toBe(200)
      expect(data2.hasMoreBatches).toBe(false) // Should be the last batch
    })
  })

  describe('Analysis Results Retrieval', () => {
    it('should retrieve stored analysis results', async () => {
      const mockAnalysisResults = {
        summary: {
          totalBugs: 3,
          totalSecurityIssues: 1,
          totalCodeSmells: 2,
          totalFilesProcessed: 5
        },
        allResults: [
          {
            file: 'index.js',
            bugs: [{ line: 10, description: 'Potential null reference' }],
            securityIssues: [],
            codeSmells: [{ line: 5, description: 'Unused variable' }]
          }
        ]
      }

      mockPrisma.repository.findUnique.mockResolvedValue({
        id: 'repo1',
        userId: 'test-user',
        fullName: 'testuser/test-repo',
        analysisResults: mockAnalysisResults
      })

      const { GET } = require('../../app/api/github/analysis-results/route')
      
      const request = new NextRequest(
        'http://localhost:3000/api/github/analysis-results?repo=testuser/test-repo&userId=test-user'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.totalBugs).toBe(3)
      expect(data.allResults).toHaveLength(1)
      expect(data.allResults[0].file).toBe('index.js')
    })

    it('should return 404 for non-existent repository', async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null)

      const { GET } = require('../../app/api/github/analysis-results/route')
      
      const request = new NextRequest(
        'http://localhost:3000/api/github/analysis-results?repo=nonexistent/repo&userId=test-user'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('Repository not found')
    })
  })
})
