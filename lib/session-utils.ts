// Session utility functions
// Separated from route files to avoid Next.js export conflicts

// Global session storage types
declare global {
  var userSessions: Map<string, { userId: string; email: string; timestamp: number }>
  var tempSessions: Map<string, { purpose: string; timestamp: number }>
}

// Helper function to create session
export async function createSession(userId: string, email: string): Promise<string> {
  // Initialize global sessions if not exists
  if (!global.userSessions) {
    console.log('🔄 CREATE SESSION: Initializing global session storage')
    global.userSessions = new Map()
  }

  const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  
  global.userSessions.set(sessionToken, {
    userId,
    email,
    timestamp: Date.now()
  })
  
  console.log('✅ CREATE SESSION: Created new session for user:', userId)
  console.log('🔍 CREATE SESSION: Total sessions now:', global.userSessions.size)
  console.log('🔍 CREATE SESSION: Session token preview:', sessionToken.substring(0, 15) + '...')
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
  console.log('🔍 VALIDATE SESSION: Starting validation for token:', sessionToken?.substring(0, 10) + '...')
  console.log('🔍 VALIDATE SESSION: Global sessions initialized?', !!global.userSessions)
  console.log('🔍 VALIDATE SESSION: Total sessions in memory:', global.userSessions?.size || 0)
  
  if (!global.userSessions) {
    console.log('❌ VALIDATE SESSION: No sessions initialized - this is a serverless cold start issue')
    return { success: false, error: 'No sessions initialized' }
  }

  const session = global.userSessions.get(sessionToken)
  
  if (!session) {
    console.log('❌ VALIDATE SESSION: Session not found in memory')
    console.log('🔍 VALIDATE SESSION: Available session tokens:', Array.from(global.userSessions.keys()).map(key => key.substring(0, 10) + '...'))
    return { success: false, error: 'Invalid session token' }
  }

  // Sessions never expire - just log age for monitoring
  const ageHours = Math.floor((Date.now() - session.timestamp) / (1000 * 60 * 60))
  console.log('✅ VALIDATE SESSION: Never-expiring session found for user:', session.userId, '(age:', ageHours, 'hours)')

  return {
    success: true,
    userId: session.userId,
    email: session.email
  }
}

// Helper function to validate and consume temporary session
export function validateTempSession(tempSession: string): { valid: boolean; purpose?: string } {
  if (!global.tempSessions || !tempSession) {
    return { valid: false }
  }

  const session = global.tempSessions.get(tempSession)
  if (!session) {
    return { valid: false }
  }

  // Check if expired (10 minutes)
  const age = Date.now() - session.timestamp
  const maxAge = 10 * 60 * 1000 // 10 minutes
  
  if (age > maxAge) {
    global.tempSessions.delete(tempSession)
    return { valid: false }
  }

  // Consume the session (one-time use)
  global.tempSessions.delete(tempSession)
  
  return { valid: true, purpose: session.purpose }
}
