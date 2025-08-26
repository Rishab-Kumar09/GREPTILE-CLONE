import { NextRequest } from 'next/server'

// Mock Prisma
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  repository: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  $queryRaw: jest.fn(),
}

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

// Mock GitHub API
const mockOctokit = {
  rest: {
    repos: {
      listForAuthenticatedUser: jest.fn(),
      get: jest.fn(),
    },
    users: {
      getAuthenticated: jest.fn(),
    },
  },
}

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit),
}))

describe('GitHub API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/github/repositories', () => {
    it('should fetch user repositories with valid userId', async () => {
      // Mock user with GitHub connection
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'test-user',
        githubTokenRef: 'github-token',
        githubUsername: 'testuser',
      })

      // Mock repository data
      mockPrisma.repository.findMany.mockResolvedValue([
        {
          id: 'repo1',
          name: 'test-repo',
          fullName: 'testuser/test-repo',
          description: 'Test repository',
          bugs: 5,
          analyzing: false,
        }
      ])

      const { GET } = require('../../app/api/github/repositories/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/repositories?userId=test-user')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data[0]).toHaveProperty('name', 'test-repo')
    })

    it('should return 400 for missing userId', async () => {
      const { GET } = require('../../app/api/github/repositories/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/repositories')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('User ID is required')
    })

    it('should return 404 for user without GitHub connection', async () => {
      // Mock user without GitHub connection
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'test-user',
        githubTokenRef: null,
        githubUsername: null,
      })

      const { GET } = require('../../app/api/github/repositories/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/repositories?userId=test-user')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('GitHub account not connected')
    })
  })

  describe('GET /api/github/stats', () => {
    it('should return GitHub stats for connected user', async () => {
      // Mock user profile with repositories
      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'test-user',
        githubConnected: true,
        githubUsername: 'testuser',
        repositoryCount: 3,
        totalBugs: 15,
        totalReviews: 2,
      }])

      const { GET } = require('../../app/api/github/stats/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/stats?userId=test-user')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('repositoryCount', 3)
      expect(data).toHaveProperty('totalBugs', 15)
      expect(data).toHaveProperty('githubConnected', true)
    })

    it('should return 400 for missing userId', async () => {
      const { GET } = require('../../app/api/github/stats/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/stats')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('User ID is required')
    })
  })

  describe('GET /api/github/oauth', () => {
    it('should redirect to GitHub OAuth with valid userId', async () => {
      const { GET } = require('../../app/api/github/oauth/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/oauth?userId=test-user')

      const response = await GET(request)

      expect(response.status).toBe(302) // Redirect status
      expect(response.headers.get('location')).toContain('github.com/login/oauth/authorize')
    })

    it('should return 400 for missing userId', async () => {
      const { GET } = require('../../app/api/github/oauth/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/oauth')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('User ID is required')
    })
  })
})
