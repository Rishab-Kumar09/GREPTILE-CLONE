'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SignInSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const sessionToken = searchParams.get('session')
    
    if (sessionToken) {
      console.log('✅ SIGNIN SUCCESS: Received session token from GitHub OAuth')
      
      // Store session token
      localStorage.setItem('sessionToken', sessionToken)
      
      // Get user data from session
      fetch('/api/auth/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Store user data for UI display
          const userData = {
            id: data.userId,
            email: data.email,
            name: data.userId.startsWith('github-') ? data.userId.replace('github-', '') : data.userId
          }
          localStorage.setItem('currentUser', JSON.stringify(userData))
          console.log('✅ SIGNIN SUCCESS: User session established:', userData.name)
          
          // Redirect to dashboard
          router.push('/dashboard')
        } else {
          console.error('❌ SIGNIN SUCCESS: Failed to validate session')
          router.push('/auth/signin?error=session_validation_failed')
        }
      })
      .catch(error => {
        console.error('❌ SIGNIN SUCCESS: Error validating session:', error)
        router.push('/auth/signin?error=session_validation_error')
      })
    } else {
      console.error('❌ SIGNIN SUCCESS: No session token provided')
      router.push('/auth/signin?error=no_session_token')
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in successful!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Setting up your account...
          </p>
        </div>
        
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    </div>
  )
}
