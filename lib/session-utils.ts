// Session utility functions
// Separated from route files to avoid Next.js export conflicts

// Global session storage type
declare global {
  var userSessions: Map<string, { userId: string; email: string; timestamp: number }>
}

// Helper function to create session
export async function createSession(userId: string, email: string): Promise<string> {
  // Initialize global sessions if not exists
  if (!global.userSessions) {
    global.userSessions = new Map()
  }

  const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  
  global.userSessions.set(sessionToken, {
    userId,
    email,
    timestamp: Date.now()
  })
  
  console.log('✅ SESSION: Created new session for user:', userId)
  return sessionToken
}

// Helper function to destroy session
export async function destroySession(sessionToken: string): Promise<void> {
  if (global.userSessions) {
    global.userSessions.delete(sessionToken)
  }
  console.log('🗑️ SESSION: Destroyed session')
}

// Helper function to validate session
export async function validateSession(sessionToken: string): Promise<{ success: boolean; userId?: string; email?: string; error?: string }> {
  if (!global.userSessions) {
    return { success: false, error: 'No sessions initialized' }
  }

  const session = global.userSessions.get(sessionToken)
  
  if (!session) {
    return { success: false, error: 'Invalid session token' }
  }

  // Sessions never expire - just log age for monitoring
  console.log('✅ SESSION: Never-expiring session found (age:', Math.floor((Date.now() - session.timestamp) / (1000 * 60 * 60)), 'hours)')

  return {
    success: true,
    userId: session.userId,
    email: session.email
  }
}
