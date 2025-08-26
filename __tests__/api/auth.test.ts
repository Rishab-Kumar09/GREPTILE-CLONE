import { NextRequest } from 'next/server'

// Mock Prisma
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
}

// Mock the Prisma import
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}))

describe('Authentication API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/auth/signup', () => {
    it('should create a new user with valid data', async () => {
      // Mock user doesn't exist
      mockPrisma.userProfile.findUnique.mockResolvedValue(null)
      
      // Mock successful user creation
      mockPrisma.userProfile.create.mockResolvedValue({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        githubConnected: false,
      })

      const { POST } = require('../../app/api/auth/signup/route')
      
      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
    })

    it('should reject signup with existing email', async () => {
      // Mock user already exists
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      })

      const { POST } = require('../../app/api/auth/signup/route')
      
      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('already exists')
    })
  })

  describe('POST /api/auth/signin', () => {
    it('should authenticate user with valid credentials', async () => {
      // Mock user exists with password
      mockPrisma.$queryRaw.mockResolvedValue([{
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        githubConnected: false,
      }])

      const { POST } = require('../../app/api/auth/signin/route')
      
      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
    })

    it('should reject signin with invalid email', async () => {
      // Mock user doesn't exist
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { POST } = require('../../app/api/auth/signin/route')
      
      const request = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'password123'
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toContain('No account found')
    })
  })
})
