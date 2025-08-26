# Greptile Clone - Integration Tests

This directory contains comprehensive integration tests for the Greptile Clone application, covering the entire user workflow and critical functionality.

## Test Structure

```
__tests__/
├── integration/           # End-to-end integration tests
│   ├── user-flow.test.tsx         # Complete user journey tests
│   ├── github-oauth.test.ts       # GitHub OAuth integration
│   └── repository-analysis.test.ts # Repository analysis workflow
├── api/                   # API endpoint tests
│   ├── auth.test.ts              # Authentication API tests
│   └── github.test.ts            # GitHub API integration tests
└── components/            # Component unit tests (future)
```

## Test Coverage

### 🔐 Authentication Flow
- **User Registration**: Sign up with email/password validation
- **User Sign In**: Login with credentials validation
- **Error Handling**: Invalid credentials, duplicate emails
- **Session Management**: localStorage integration

### 🐙 GitHub Integration
- **OAuth Initiation**: Correct OAuth parameters and state management
- **OAuth Callback**: Token exchange, user data retrieval, profile updates
- **Multi-User Sharing**: Multiple users connecting to same GitHub account
- **Error Handling**: Invalid codes, API failures, network issues

### 📊 Repository Management
- **Repository Fetching**: User-specific repository loading
- **Repository Analysis**: Multi-batch code analysis workflow
- **Analysis Results**: Storage and retrieval of analysis data
- **Error Recovery**: Graceful handling of analysis failures

### 🔧 API Endpoints
- **Authentication APIs**: `/api/auth/signup`, `/api/auth/signin`
- **GitHub APIs**: `/api/github/oauth`, `/api/github/callback`, `/api/github/repositories`
- **Analysis APIs**: `/api/github/analyze-repository-batch`, `/api/github/analysis-results`
- **Parameter Validation**: Required parameters, error responses

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Integration Tests Only
```bash
npm run test:integration
```

### API Tests Only
```bash
npm run test:api
```

### CI/CD Pipeline
```bash
npm run test:ci
```

## Test Configuration

### Jest Configuration (`jest.config.js`)
- **Environment**: jsdom for React component testing
- **Setup**: Custom setup file with mocks and utilities
- **Coverage**: Comprehensive coverage reporting
- **Timeout**: 30 seconds for integration tests

### Test Setup (`jest.setup.js`)
- **Mocks**: localStorage, fetch, console, window.location
- **Cleanup**: Automatic mock reset between tests
- **DOM Testing**: @testing-library/jest-dom matchers

## Key Testing Patterns

### 1. API Mocking
```typescript
// Mock Prisma database calls
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))
```

### 2. User Interaction Testing
```typescript
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.type(screen.getByLabelText(/email/i), 'test@example.com')
await user.click(screen.getByRole('button', { name: /sign up/i }))
```

### 3. Integration Flow Testing
```typescript
// Test complete OAuth flow
it('should handle successful OAuth callback', async () => {
  // Mock GitHub API responses
  global.fetch.mockResolvedValueOnce(/* token response */)
  global.fetch.mockResolvedValueOnce(/* user data response */)
  
  // Execute callback
  const response = await GET(request)
  
  // Verify database updates
  expect(mockPrisma.userProfile.update).toHaveBeenCalled()
})
```

## Test Data Management

### User Test Data
```typescript
const testUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  githubConnected: false,
}
```

### Repository Test Data
```typescript
const testRepo = {
  id: 'repo1',
  name: 'test-repo',
  fullName: 'testuser/test-repo',
  bugs: 5,
  analyzing: false,
}
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

1. **Pre-deployment Testing**: Run before each deployment
2. **Pull Request Validation**: Ensure new changes don't break existing functionality
3. **Coverage Reporting**: Maintain high test coverage standards
4. **Performance Monitoring**: Track test execution time

## Best Practices

### ✅ Do's
- Mock external dependencies (GitHub API, OpenAI, Prisma)
- Test complete user workflows, not just individual functions
- Use descriptive test names that explain the scenario
- Clean up mocks between tests
- Test both success and error scenarios

### ❌ Don'ts
- Don't make real API calls in tests
- Don't rely on external services being available
- Don't test implementation details, test behavior
- Don't skip error handling tests
- Don't use hardcoded timeouts

## Contributing to Tests

When adding new features:

1. **Add corresponding tests** for new API endpoints
2. **Update integration tests** if user flows change
3. **Mock new external dependencies**
4. **Maintain test coverage** above 80%
5. **Update this documentation** with new test patterns

## Debugging Tests

### Common Issues
1. **Mock not working**: Check import path and module name
2. **Async test failures**: Ensure proper await/waitFor usage
3. **DOM not found**: Verify component rendering and selectors
4. **Network errors**: Check fetch mock setup

### Debug Commands
```bash
# Run specific test file
npm test -- user-flow.test.tsx

# Run with verbose output
npm test -- --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

This comprehensive test suite ensures the Greptile Clone application maintains high quality and reliability across all user workflows and integrations.
