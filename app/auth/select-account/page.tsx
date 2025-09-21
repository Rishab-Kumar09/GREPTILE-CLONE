'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface UserAccount {
  id: string
  name: string
  email: string
  profileImage: string
  updatedAt: string
}

function SelectAccountContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    const accountsData = searchParams.get('accounts')
    const githubUsername = searchParams.get('github')
    
    if (accountsData) {
      try {
        // Decode base64 data
        const accountsJson = atob(decodeURIComponent(accountsData))
        const parsedAccounts = JSON.parse(accountsJson)
        
        // Add profile images and fix dates
        const accountsWithImages = parsedAccounts.map((acc: any) => ({
          ...acc,
          profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.name || 'User')}&background=10b981&color=fff&size=128`,
          updatedAt: acc.updatedAt || new Date().toISOString()
        }))
        
        setAccounts(accountsWithImages)
        setLoading(false)
      } catch (error) {
        console.error('Failed to parse accounts data:', error)
        router.push('/auth/signin?error=account_selection_failed')
      }
    } else {
      console.error('No accounts data provided')
      router.push('/auth/signin?error=no_accounts_data')
    }
  }, [searchParams, router])

  const selectAccount = async (accountId: string) => {
    setSelecting(accountId)
    
    try {
      const response = await fetch('/api/auth/select-github-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId,
          githubUsername: searchParams.get('github')
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Store session token
        localStorage.setItem('sessionToken', data.sessionToken)
        localStorage.setItem('currentUser', JSON.stringify(data.user))
        
        console.log('✅ ACCOUNT SELECTION: Selected account:', data.user.name)
        router.push('/dashboard')
      } else {
        alert(data.error || 'Failed to select account')
        setSelecting(null)
      }
    } catch (error) {
      console.error('Error selecting account:', error)
      alert('Failed to select account. Please try again.')
      setSelecting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Choose your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Multiple accounts found with your GitHub username. Please select which one to sign in to:
          </p>
        </div>

        <div className="space-y-3">
          {accounts.map((account, index) => (
            <button
              key={account.id}
              onClick={() => selectAccount(account.id)}
              disabled={selecting !== null}
              className={`w-full flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                selecting === account.id ? 'bg-blue-50 border-blue-300' : 'border-gray-300'
              } ${selecting !== null && selecting !== account.id ? 'opacity-50' : ''}`}
            >
              <img
                src={account.profileImage}
                alt={account.name}
                className="w-12 h-12 rounded-full mr-4"
              />
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900">{account.name}</div>
                  {index === 0 && (
                    <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">{account.email}</div>
                <div className="text-xs text-gray-400">
                  Last updated: {new Date(account.updatedAt).toLocaleDateString()}
                </div>
              </div>
              {selecting === account.id && (
                <div className="ml-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/auth/signin')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SelectAccount() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    }>
      <SelectAccountContent />
    </Suspense>
  )
}
