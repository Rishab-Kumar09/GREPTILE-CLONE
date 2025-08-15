'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      slack: false,
      webhooks: true
    },
    reviewSettings: {
      autoReview: true,
      severity: 'medium',
      languages: ['typescript', 'python', 'javascript']
    }
  })
  
  // Profile settings (synced with localStorage)
  const [userName, setUserName] = useState('John Doe')
  const [userEmail, setUserEmail] = useState('john@example.com')
  const [userCompany, setUserCompany] = useState('Acme Inc.')
  const [userTimezone, setUserTimezone] = useState('UTC-8 (Pacific Time)')
  const [selectedIcon, setSelectedIcon] = useState('👤')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  
  // Load profile settings on mount
  useEffect(() => {
    loadProfileSettings()
    loadOtherSettings()
  }, [])

  // Load notification and review settings from localStorage
  const loadOtherSettings = () => {
    try {
      const savedNotifications = localStorage.getItem('notificationSettings')
      const savedReviewSettings = localStorage.getItem('reviewSettings')
      
      if (savedNotifications) {
        const notifications = JSON.parse(savedNotifications)
        setSettings(prev => ({ ...prev, notifications }))
      }
      
      if (savedReviewSettings) {
        const reviewSettings = JSON.parse(savedReviewSettings)
        setSettings(prev => ({ ...prev, reviewSettings }))
      }
    } catch (error) {
      console.error('Error loading other settings:', error)
    }
  }
  
  const [verificationStatus, setVerificationStatus] = useState<{
    status: 'idle' | 'checking' | 'success' | 'error'
    message?: string
    details?: any
  }>({ status: 'idle' })

  // Load profile settings from localStorage
  const loadProfileSettings = () => {
    try {
      const savedName = localStorage.getItem('userName')
      const savedEmail = localStorage.getItem('userEmail') 
      const savedCompany = localStorage.getItem('userCompany')
      const savedTimezone = localStorage.getItem('userTimezone')
      const savedIcon = localStorage.getItem('selectedIcon')
      const savedImage = localStorage.getItem('profileImage')
      
      if (savedName) setUserName(savedName)
      if (savedEmail) setUserEmail(savedEmail)
      if (savedCompany) setUserCompany(savedCompany)
      if (savedTimezone) setUserTimezone(savedTimezone)
      if (savedIcon) setSelectedIcon(savedIcon)
      if (savedImage) setProfileImage(savedImage)
    } catch (error) {
      console.error('Error loading profile settings:', error)
    }
  }

  // Save profile settings to localStorage
  const saveProfileSettings = () => {
    try {
      localStorage.setItem('userName', userName)
      localStorage.setItem('userEmail', userEmail)
      localStorage.setItem('userCompany', userCompany)
      localStorage.setItem('userTimezone', userTimezone)
      localStorage.setItem('selectedIcon', selectedIcon)
      if (profileImage) {
        localStorage.setItem('profileImage', profileImage)
      } else {
        localStorage.removeItem('profileImage')
      }
      return true
    } catch (error) {
      console.error('Error saving profile settings:', error)
      return false
    }
  }

  // Load profile settings on mount
  useEffect(() => {
    loadProfileSettings()
  }, [])

  const verifyOpenAIKey = async () => {
    setVerificationStatus({ status: 'checking' })
    
    try {
      const response = await fetch('/api/ai/verify')
      const data = await response.json()
      
      if (data.success) {
        setVerificationStatus({
          status: 'success',
          message: data.message,
          details: data.details
        })
      } else {
        setVerificationStatus({
          status: 'error',
          message: data.error,
          details: data.details
        })
      }
    } catch (error) {
      setVerificationStatus({
        status: 'error',
        message: 'Failed to verify OpenAI connection',
        details: 'Network error or server unavailable'
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🦎</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Greptile Clone</span>
              </Link>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/dashboard/repositories" className="text-gray-600 hover:text-gray-900">
                Repositories
              </Link>
              <Link href="/dashboard/reviews" className="text-gray-600 hover:text-gray-900">
                Reviews
              </Link>
              <Link href="/dashboard/settings" className="text-primary-600 font-medium">
                Settings
              </Link>
            </nav>

            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="text-lg">{selectedIcon}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account and AI review preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'general' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'notifications' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Notifications
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'reviews' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                AI Reviews
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'billing' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Billing
              </button>
              <button
                onClick={() => setActiveTab('integrations')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'integrations' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Integrations
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeTab === 'general' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <input
                      type="text"
                      value={userCompany}
                      onChange={(e) => setUserCompany(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Timezone</label>
                    <select 
                      value={userTimezone}
                      onChange={(e) => setUserTimezone(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="UTC-8 (Pacific Time)">UTC-8 (Pacific Time)</option>
                      <option value="UTC-5 (Eastern Time)">UTC-5 (Eastern Time)</option>
                      <option value="UTC+0 (GMT)">UTC+0 (GMT)</option>
                      <option value="UTC+1 (Central European Time)">UTC+1 (Central European Time)</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => {
                        const success = saveProfileSettings()
                        if (success) {
                          alert('Profile settings saved successfully!')
                        } else {
                          alert('Failed to save profile settings. Please try again.')
                        }
                      }}
                      className="btn-primary"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                        <p className="text-sm text-gray-500">Get notified about new reviews and issues</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.notifications.email}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, email: e.target.checked }
                          }))}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Slack Integration</h3>
                        <p className="text-sm text-gray-500">Send notifications to your Slack workspace</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.notifications.slack}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, slack: e.target.checked }
                          }))}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Webhook Notifications</h3>
                        <p className="text-sm text-gray-500">Send POST requests to your endpoints</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.notifications.webhooks}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            notifications: { ...prev.notifications, webhooks: e.target.checked }
                          }))}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => {
                        // Save notification settings to localStorage
                        try {
                          localStorage.setItem('notificationSettings', JSON.stringify(settings.notifications))
                          alert('Notification preferences saved successfully!')
                        } catch (error) {
                          alert('Failed to save notification preferences. Please try again.')
                        }
                      }}
                      className="btn-primary"
                    >
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">AI Review Settings</h2>
                    <button
                      onClick={verifyOpenAIKey}
                      disabled={verificationStatus.status === 'checking'}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        verificationStatus.status === 'success'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : verificationStatus.status === 'error'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {verificationStatus.status === 'checking' && '🔄 Verifying OpenAI...'}
                      {verificationStatus.status === 'success' && '✅ OpenAI Connected'}
                      {verificationStatus.status === 'error' && '❌ OpenAI Failed'}
                      {verificationStatus.status === 'idle' && '🔍 Test OpenAI Connection'}
                    </button>
                  </div>
                  
                  {/* Verification Status Details */}
                  {verificationStatus.status !== 'idle' && (
                    <div className={`mt-4 p-4 rounded-md ${
                      verificationStatus.status === 'success'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className={`text-sm ${
                        verificationStatus.status === 'success' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        <p className="font-medium">{verificationStatus.message}</p>
                        {verificationStatus.details && (
                          <div className="mt-2 text-xs space-y-1">
                            {typeof verificationStatus.details === 'string' ? (
                              <p>{verificationStatus.details}</p>
                            ) : (
                              <>
                                {verificationStatus.details.model && (
                                  <p><strong>Model:</strong> {verificationStatus.details.model}</p>
                                )}
                                {verificationStatus.details.keyPrefix && (
                                  <p><strong>API Key:</strong> {verificationStatus.details.keyPrefix}</p>
                                )}
                                {verificationStatus.details.response && (
                                  <p><strong>Test Response:</strong> "{verificationStatus.details.response}"</p>
                                )}
                                {verificationStatus.details.usage && (
                                  <p><strong>Tokens Used:</strong> {verificationStatus.details.usage.total_tokens} (Prompt: {verificationStatus.details.usage.prompt_tokens}, Completion: {verificationStatus.details.usage.completion_tokens})</p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Automatic Reviews</h3>
                      <p className="text-sm text-gray-500">Automatically review all new pull requests</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.reviewSettings.autoReview}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          reviewSettings: { ...prev.reviewSettings, autoReview: e.target.checked }
                        }))}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Review Sensitivity</label>
                    <select 
                      value={settings.reviewSettings.severity}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        reviewSettings: { ...prev.reviewSettings, severity: e.target.value }
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="low">Low - Only critical issues</option>
                      <option value="medium">Medium - Important issues and suggestions</option>
                      <option value="high">High - All potential improvements</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Supported Languages</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {['typescript', 'javascript', 'python', 'java', 'go', 'rust'].map((lang) => (
                        <label key={lang} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.reviewSettings.languages.includes(lang)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSettings(prev => ({
                                  ...prev,
                                  reviewSettings: {
                                    ...prev.reviewSettings,
                                    languages: [...prev.reviewSettings.languages, lang]
                                  }
                                }))
                              } else {
                                setSettings(prev => ({
                                  ...prev,
                                  reviewSettings: {
                                    ...prev.reviewSettings,
                                    languages: prev.reviewSettings.languages.filter(l => l !== lang)
                                  }
                                }))
                              }
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">{lang}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={() => {
                        // Save review settings to localStorage
                        try {
                          localStorage.setItem('reviewSettings', JSON.stringify(settings.reviewSettings))
                          alert('AI review settings saved successfully!')
                        } catch (error) {
                          alert('Failed to save AI review settings. Please try again.')
                        }
                      }}
                      className="btn-primary"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Billing & Subscription</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-800 font-medium">Free Trial Active</span>
                    </div>
                    <p className="text-green-700 mt-1">All features are currently free for testing! No payment required.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900">Free</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-2">$0<span className="text-sm font-normal text-gray-500">/month</span></p>
                      <p className="text-sm text-gray-600 mt-2">Perfect for testing</p>
                      <ul className="text-sm text-gray-600 mt-4 space-y-2">
                        <li>✓ Up to 5 repositories</li>
                        <li>✓ Basic AI reviews</li>
                        <li>✓ Email notifications</li>
                      </ul>
                      <button className="w-full mt-4 bg-gray-100 text-gray-800 py-2 rounded-md text-sm font-medium">
                        Current Plan
                      </button>
                    </div>

                    <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
                      <h3 className="font-medium text-gray-900">Pro</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-2">$0<span className="text-sm font-normal text-gray-500">/month</span></p>
                      <p className="text-sm text-gray-600 mt-2">FREE during testing</p>
                      <ul className="text-sm text-gray-600 mt-4 space-y-2">
                        <li>✓ Unlimited repositories</li>
                        <li>✓ Advanced AI reviews</li>
                        <li>✓ All integrations</li>
                        <li>✓ Priority support</li>
                      </ul>
                      <button className="w-full mt-4 btn-primary">
                        Activate Pro (Free)
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900">Enterprise</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-2">$0<span className="text-sm font-normal text-gray-500">/month</span></p>
                      <p className="text-sm text-gray-600 mt-2">FREE during testing</p>
                      <ul className="text-sm text-gray-600 mt-4 space-y-2">
                        <li>✓ Everything in Pro</li>
                        <li>✓ Custom rules</li>
                        <li>✓ SSO/SAML</li>
                        <li>✓ Dedicated support</li>
                      </ul>
                      <button className="w-full mt-4 btn-outline">
                        Contact Sales (Free)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">GitHub</h3>
                            <p className="text-sm text-gray-600">Connected</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Automatically review pull requests from GitHub repositories</p>
                      <button className="btn-outline w-full">
                        Configure
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.16l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.16l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94z"/>
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">GitLab</h3>
                            <p className="text-sm text-gray-600">Not connected</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Available
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Connect your GitLab repositories for AI code reviews</p>
                      <button className="btn-primary w-full">
                        Connect GitLab
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold">#</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">Slack</h3>
                            <p className="text-sm text-gray-600">Not connected</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Available
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Get review notifications in your Slack channels</p>
                      <button className="btn-primary w-full">
                        Connect Slack
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">Webhooks</h3>
                            <p className="text-sm text-gray-600">Not configured</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Available
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Send review data to your custom endpoints</p>
                      <button className="btn-primary w-full">
                        Configure Webhooks
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 