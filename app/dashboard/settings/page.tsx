'use client'

import { useState, useEffect } from 'react'
import DashboardHeader from '@/components/DashboardHeader'

export default function Settings() {
  // Profile settings (loaded from database)
  const [userName, setUserName] = useState('R.K.')
  const [userEmail, setUserEmail] = useState('user@example.com')
  const [selectedIcon, setSelectedIcon] = useState('👤')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  
  // Load profile settings from database
  const loadProfileSettings = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, using localStorage fallback')
        // Fallback to localStorage if no user session
        const savedName = localStorage.getItem('userName')
        const savedEmail = localStorage.getItem('userEmail') 
        const savedIcon = localStorage.getItem('selectedIcon')
        const savedImage = localStorage.getItem('profileImage')
        
        if (savedName) setUserName(savedName)
        if (savedEmail) setUserEmail(savedEmail)
        if (savedIcon) setSelectedIcon(savedIcon)
        if (savedImage) setProfileImage(savedImage)
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔍 SETTINGS: Loading profile for user:', currentUser.id)
      
      const response = await fetch(`/api/profile?userId=${currentUser.id}`)
      if (response.ok) {
        const data = await response.json()
        const profile = data.profile
        console.log('✅ SETTINGS: Profile loaded from database')
        if (profile.name) setUserName(profile.name)
        if (profile.email) setUserEmail(profile.email)
        else setUserEmail('user@example.com') // Default if no email in database
        if (profile.selectedIcon) setSelectedIcon(profile.selectedIcon)
        if (profile.profileImage) setProfileImage(profile.profileImage)
      } else {
        console.log('❌ SETTINGS: Failed to load from database, using localStorage fallback')
        // Fallback to localStorage if database fails
        const savedName = localStorage.getItem('userName')
        const savedEmail = localStorage.getItem('userEmail') 
        const savedIcon = localStorage.getItem('selectedIcon')
        const savedImage = localStorage.getItem('profileImage')
        
        if (savedName) setUserName(savedName)
        if (savedEmail) setUserEmail(savedEmail)
        if (savedIcon) setSelectedIcon(savedIcon)
        if (savedImage) setProfileImage(savedImage)
      }
    } catch (error) {
      console.error('Error loading profile settings:', error)
    }
  }

  // Load profile settings on mount
  useEffect(() => {
    loadProfileSettings()
  }, [])

  // Save profile settings to database and localStorage
  const saveProfileSettings = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('No current user found, saving to localStorage only')
        // Fallback to localStorage only
        localStorage.setItem('userName', userName)
        localStorage.setItem('userEmail', userEmail)
        localStorage.setItem('selectedIcon', selectedIcon)
        if (profileImage) {
          localStorage.setItem('profileImage', profileImage)
        }
        alert('Profile settings saved locally!')
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('💾 SETTINGS: Saving profile for user:', currentUser.id)
      
      // Save to database
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          name: userName,
          email: userEmail,
          selectedIcon: selectedIcon,
          profileImage: profileImage
        }),
      })

      if (response.ok) {
        // Also save to localStorage as backup
        localStorage.setItem('userName', userName)
        localStorage.setItem('userEmail', userEmail)
        localStorage.setItem('selectedIcon', selectedIcon)
        if (profileImage) {
          localStorage.setItem('profileImage', profileImage)
        }
        
        alert('Profile settings saved successfully!')
      } else {
        throw new Error('Failed to save to database')
      }
    } catch (error) {
      console.error('Error saving profile settings:', error)
      alert('Failed to save profile settings. Please try again.')
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setProfileImage(result)
        setSelectedIcon('')
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and profile preferences</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h2>
            
            <div className="space-y-6">
              {/* Profile Picture Section */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Profile Picture</h3>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl">{selectedIcon}</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex space-x-2 mb-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="profile-upload"
                      />
                      <label
                        htmlFor="profile-upload"
                        className="px-3 py-1 bg-primary-600 text-white rounded text-sm cursor-pointer hover:bg-primary-700"
                      >
                        Upload Image
                      </label>
                      <button
                        onClick={() => {
                          setProfileImage(null)
                          setSelectedIcon('👤')
                        }}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                      >
                        Remove
                      </button>
                    </div>
                    
                    {/* Icon Selection */}
                    <div className="grid grid-cols-8 gap-1">
                      {['👤', '👨‍💻', '👩‍💻', '🧑‍💼', '👨‍🎨', '👩‍🎨', '🧑‍🔬', '🤖'].map((icon) => (
                        <button
                          key={icon}
                          onClick={() => {
                            setSelectedIcon(icon)
                            setProfileImage(null)
                          }}
                          className={`w-8 h-8 rounded flex items-center justify-center text-lg border transition-colors ${
                            selectedIcon === icon && !profileImage
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* GitHub Connection Status */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Connected Accounts</h3>
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">GitHub</p>
                      <p className="text-sm text-gray-500">Access your repositories</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                </div>
              </div>

              {/* Save Button */}
              <div className="border-t pt-6">
                <button
                  onClick={saveProfileSettings}
                  className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 