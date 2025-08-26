import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignUp from '../../app/auth/signup/page'
import SignIn from '../../app/auth/signin/page'
import Dashboard from '../../app/dashboard/page'
import Repositories from '../../app/dashboard/repositories/page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/dashboard',
}))

describe('User Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset localStorage
    localStorage.clear()
    
    // Reset fetch mock
    global.fetch = jest.fn()
  })

  describe('User Registration Flow', () => {
    it('should allow user to sign up with valid credentials', async () => {
      const user = userEvent.setup()

      // Mock successful signup API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            githubConnected: false,
          }
        }),
      })

      render(<SignUp />)

      // Fill out signup form
      await user.type(screen.getByLabelText(/full name/i), 'Test User')
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')

      // Submit form (click the main Submit button, not the GitHub button)
      await user.click(screen.getByRole('button', { name: /^sign up$/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123'
          }),
        })
      })

      // Check if user data is stored in localStorage
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'currentUser',
        expect.stringContaining('test@example.com')
      )
    })

    it('should show error for duplicate email', async () => {
      const user = userEvent.setup()

      // Mock error response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'User with this email already exists'
        }),
      })

      render(<SignUp />)

      await user.type(screen.getByLabelText(/full name/i), 'Test User')
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /^sign up$/i }))

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument()
      })
    })
  })

  describe('User Sign In Flow', () => {
    it('should allow user to sign in with valid credentials', async () => {
      const user = userEvent.setup()

      // Mock successful signin response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'existing-user-id',
            name: 'Existing User',
            email: 'existing@example.com',
            githubConnected: true,
          }
        }),
      })

      render(<SignIn />)

      await user.type(screen.getByLabelText(/email/i), 'existing@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'existing@example.com',
            password: 'password123'
          }),
        })
      })

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'currentUser',
        expect.stringContaining('existing@example.com')
      )
    })

    it('should show error for invalid credentials', async () => {
      const user = userEvent.setup()

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'No account found with this email'
        }),
      })

      render(<SignIn />)

      await user.type(screen.getByLabelText(/email/i), 'nonexistent@example.com')
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
      await user.click(screen.getByRole('button', { name: /^sign in$/i }))

      await waitFor(() => {
        expect(screen.getByText(/no account found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Dashboard Integration', () => {
    beforeEach(() => {
      // Mock logged-in user
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        githubConnected: true,
      }))
    })

    it('should load dashboard with user data', async () => {
      // Mock GitHub stats API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repositoryCount: 3,
          totalBugs: 15,
          totalReviews: 2,
          githubConnected: true,
          githubUsername: 'testuser',
        }),
      })

      render(<Dashboard />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/github/stats?userId=test-user'
        )
      })

      // Should display user stats
      expect(screen.getByText('3')).toBeInTheDocument() // Repository count
    })
  })

  describe('Repository Management Integration', () => {
    beforeEach(() => {
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        githubConnected: true,
      }))
    })

    it('should load and display repositories', async () => {
      // Mock repositories API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            id: 'repo1',
            name: 'test-repo',
            fullName: 'testuser/test-repo',
            description: 'Test repository',
            bugs: 5,
            analyzing: false,
          }
        ]),
      })

      render(<Repositories />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/repositories?userId=test-user'
        )
      })

      expect(screen.getByText('test-repo')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument() // Bug count
    })

    it('should handle GitHub connection refresh', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      })

      render(<Repositories />)

      const refreshButton = screen.getByText(/refresh github/i)
      
      // Mock window.location.href assignment
      const originalLocation = window.location
      delete window.location
      window.location = { href: '' }

      fireEvent.click(refreshButton)

      // Should redirect to OAuth endpoint
      expect(window.location.href).toContain('/api/github/oauth?userId=test-user')

      // Restore window.location
      window.location = originalLocation
    })
  })
})
