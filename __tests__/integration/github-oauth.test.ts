import { NextRequest } from 'next/server'

// Mock Prisma
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
}

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

// Mock GitHub API
global.fetch = jest.fn()

describe('GitHub OAuth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GITHUB_CLIENT_ID = 'test-client-id'
    process.env.GITHUB_CLIENT_SECRET = 'test-client-secret'
  })

  describe('OAuth Initiation Flow', () => {
    it('should initiate OAuth with correct parameters', async () => {
      const { GET } = require('../../app/api/github/oauth/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/oauth?userId=test-user')

      const response = await GET(request)

      expect(response.status).toBe(302)
      
      const location = response.headers.get('location')
      expect(location).toContain('github.com/login/oauth/authorize')
      expect(location).toContain('client_id=test-client-id')
      expect(location).toContain('scope=repo%20user%3Aemail')
      expect(location).toContain('state=')
      expect(location).toContain('allow_signup=false')
    })

    it('should include userId in state parameter', async () => {
      const { GET } = require('../../app/api/github/oauth/route')
      
      const request = new NextRequest('http://localhost:3000/api/github/oauth?userId=test-user-123')

      const response = await GET(request)
      const location = response.headers.get('location')
      
      // Extract state parameter
      const stateMatch = location.match(/state=([^&]+)/)
      expect(stateMatch).toBeTruthy()
      
      const state = decodeURIComponent(stateMatch[1])
      const stateData = JSON.parse(state)
      
      expect(stateData.userId).toBe('test-user-123')
      expect(stateData.timestamp).toBeDefined()
    })
  })

  describe('OAuth Callback Flow', () => {
    it('should handle successful OAuth callback', async () => {
      // Mock GitHub token exchange
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'access_token=github-token&token_type=bearer',
        })
        // Mock GitHub user API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            login: 'testuser',
            id: 12345,
            avatar_url: 'https://github.com/avatar.png',
            name: 'Test User',
            email: 'test@example.com',
          }),
        })

      // Mock user profile exists
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
      })

      // Mock no existing GitHub connections
      mockPrisma.$queryRaw.mockResolvedValue([])

      // Mock successful profile update
      mockPrisma.userProfile.update.mockResolvedValue({
        id: 'test-user',
        githubConnected: true,
        githubUsername: 'testuser',
      })

      const { GET } = require('../../app/api/github/callback/route')
      
      const state = JSON.stringify({ userId: 'test-user', timestamp: Date.now() })
      const encodedState = encodeURIComponent(state)
      
      const request = new NextRequest(
        `http://localhost:3000/api/github/callback?code=oauth-code&state=${encodedState}`
      )

      const response = await GET(request)

      expect(response.status).toBe(302) // Redirect to dashboard
      expect(response.headers.get('location')).toContain('/dashboard')

      // Verify GitHub token exchange was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: expect.stringContaining('client_id=test-client-id'),
        })
      )

      // Verify user profile was updated
      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'test-user' },
        data: expect.objectContaining({
          githubConnected: true,
          githubUsername: 'testuser',
          githubTokenRef: 'github-token',
        }),
      })
    })

    it('should handle OAuth callback with invalid state', async () => {
      const { GET } = require('../../app/api/github/callback/route')
      
      const request = new NextRequest(
        'http://localhost:3000/api/github/callback?code=oauth-code&state=invalid-state'
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid state parameter')
    })

    it('should handle OAuth callback without code', async () => {
      const { GET } = require('../../app/api/github/callback/route')
      
      const state = JSON.stringify({ userId: 'test-user', timestamp: Date.now() })
      const encodedState = encodeURIComponent(state)
      
      const request = new NextRequest(
        `http://localhost:3000/api/github/callback?state=${encodedState}`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No authorization code received')
    })

    it('should handle GitHub API errors during callback', async () => {
      // Mock failed GitHub token exchange
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'error=invalid_request',
      })

      const { GET } = require('../../app/api/github/callback/route')
      
      const state = JSON.stringify({ userId: 'test-user', timestamp: Date.now() })
      const encodedState = encodeURIComponent(state)
      
      const request = new NextRequest(
        `http://localhost:3000/api/github/callback?code=invalid-code&state=${encodedState}`
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to exchange code for token')
    })
  })

  describe('Multi-User GitHub Sharing', () => {
    it('should allow multiple users to connect to same GitHub account', async () => {
      // Mock GitHub token exchange and user API
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'access_token=github-token&token_type=bearer',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            login: 'shareduser',
            id: 12345,
            avatar_url: 'https://github.com/avatar.png',
          }),
        })

      // Mock user profile exists
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'user2',
        name: 'User 2',
      })

      // Mock existing GitHub connection to another user
      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'user1',
        name: 'User 1',
        githubUsername: 'shareduser',
      }])

      // Mock successful profile update
      mockPrisma.userProfile.update.mockResolvedValue({
        id: 'user2',
        githubConnected: true,
        githubUsername: 'shareduser',
      })

      const { GET } = require('../../app/api/github/callback/route')
      
      const state = JSON.stringify({ userId: 'user2', timestamp: Date.now() })
      const encodedState = encodeURIComponent(state)
      
      const request = new NextRequest(
        `http://localhost:3000/api/github/callback?code=oauth-code&state=${encodedState}`
      )

      const response = await GET(request)

      expect(response.status).toBe(302) // Should still succeed
      
      // Should update the second user's profile despite existing connection
      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'user2' },
        data: expect.objectContaining({
          githubConnected: true,
          githubUsername: 'shareduser',
        }),
      })
    })
  })
})
