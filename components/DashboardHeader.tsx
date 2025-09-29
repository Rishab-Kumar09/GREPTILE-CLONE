'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface DashboardHeaderProps {
  currentPage?: string
}

export default function DashboardHeader({ currentPage }: DashboardHeaderProps) {
  const pathname = usePathname()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState('👤')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [userName, setUserName] = useState('User')
  const [userTitle, setUserTitle] = useState('Developer')
  const [isAdmin, setIsAdmin] = useState(false)

  // Load profile settings from DATABASE (with localStorage fallback)
  const loadProfileSettings = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      if (!currentUserStr) {
        console.log('HEADER: No current user found, using localStorage fallback')
        // Fallback to localStorage if no user session
        const savedIcon = localStorage.getItem('selectedIcon')
        const savedImage = localStorage.getItem('profileImage')
        const savedName = localStorage.getItem('userName')
        const savedTitle = localStorage.getItem('userTitle')
        
        if (savedIcon) setSelectedIcon(savedIcon)
        if (savedImage) setProfileImage(savedImage)
        if (savedName) setUserName(savedName)
        if (savedTitle) setUserTitle(savedTitle)
        return
      }
      
      const currentUser = JSON.parse(currentUserStr)
      console.log('🔄 HEADER: Loading profile for user:', currentUser.id)
      
      const response = await fetch(`/api/profile?userId=${currentUser.id}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.profile) {
          console.log('✅ HEADER: Loaded from DATABASE:', data.profile)
          const profile = data.profile
          
          setUserName(profile.name || 'User')
          setUserTitle(profile.userTitle || 'Developer')
          setSelectedIcon(profile.selectedIcon || '👤')
          if (profile.profileImage) {
            setProfileImage(profile.profileImage)
          }
          return // Success - exit early
        }
      }
      
      // Fallback to localStorage only if database fails
      console.log('⚠️ HEADER: Database failed, using localStorage fallback')
      const savedIcon = localStorage.getItem('selectedIcon')
      const savedImage = localStorage.getItem('profileImage')
      const savedName = localStorage.getItem('userName')
      const savedTitle = localStorage.getItem('userTitle')
      
      if (savedIcon) setSelectedIcon(savedIcon)
      if (savedImage) setProfileImage(savedImage)
      if (savedName) setUserName(savedName)
      if (savedTitle) setUserTitle(savedTitle)
      
    } catch (error) {
      console.error('❌ HEADER: Profile loading error:', error)
    }
  }

  useEffect(() => {
    loadProfileSettings()
    checkAdminStatus()
  }, [])

  // Check if user is admin
  const checkAdminStatus = async () => {
    try {
      const sessionRes = await fetch('/api/auth/validate-session')
      const sessionData = await sessionRes.json()
      
      if (sessionData.valid && sessionData.user) {
        const feedbackRes = await fetch(`/api/feedback?userId=${sessionData.user.id}&includeResolved=false`)
        const feedbackData = await feedbackRes.json()
        
        if (feedbackData.success && feedbackData.isAdmin) {
          setIsAdmin(true)
        }
      }
    } catch (error) {
      console.error('Admin check failed:', error)
    }
  }

  // Determine active page based on pathname
  const getActivePage = () => {
    if (currentPage) return currentPage
    if (pathname === '/dashboard') return 'dashboard'
    if (pathname.startsWith('/dashboard/repositories')) return 'repositories'
    if (pathname.startsWith('/dashboard/reviews')) return 'reviews'
    if (pathname.startsWith('/dashboard/enterprise-analysis')) return 'enterprise-analysis'
    if (pathname.startsWith('/dashboard/settings')) return 'settings'
    if (pathname.startsWith('/setup')) return 'setup'
    return 'dashboard'
  }

  const activePage = getActivePage()

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userName')
    window.location.href = '/'
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🦎</span>
            </div>
            <span className="ml-2 text-xl font-bold text-gray-900">Greptile Clone</span>
          </div>
          
          <nav className="flex items-center space-x-8">
            <Link 
              href="/dashboard" 
              className={activePage === 'dashboard' ? 'text-primary-600 font-medium' : 'text-gray-600 hover:text-gray-900'}
            >
              Dashboard
            </Link>
            <Link 
              href="/dashboard/repositories" 
              className={activePage === 'repositories' ? 'text-primary-600 font-medium' : 'text-gray-600 hover:text-gray-900'}
            >
              Repositories
            </Link>
            <Link 
              href="/dashboard/reviews" 
              className={activePage === 'reviews' ? 'text-primary-600 font-medium' : 'text-gray-600 hover:text-gray-900'}
            >
              Reviews
            </Link>
            <Link 
              href="/dashboard/enterprise-analysis" 
              className={activePage === 'enterprise-analysis' ? 'text-primary-600 font-medium' : 'text-gray-600 hover:text-gray-900'}
            >
              ⚡ Quick Analysis
            </Link>
            <Link 
              href="/dashboard/settings" 
              className={activePage === 'settings' ? 'text-primary-600 font-medium' : 'text-gray-600 hover:text-gray-900'}
            >
              Settings
            </Link>
            <Link 
              href="/setup" 
              className={activePage === 'setup' ? 'bg-green-700 text-white px-3 py-1.5 rounded-md text-sm font-medium' : 'bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 transition-colors'}
            >
              Setup Bot
            </Link>
            
            {/* Admin Button - Only visible to admins */}
            {isAdmin && (
              <Link 
                href="/dashboard/admin-feedback" 
                className={pathname.startsWith('/dashboard/admin-feedback') ? 'bg-purple-700 text-white px-3 py-1.5 rounded-md text-sm font-medium' : 'bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors'}
              >
                🛠️ Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => setShowProfileModal(!showProfileModal)}
                className="w-8 h-8 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors flex items-center justify-center text-lg"
              >
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span>{selectedIcon}</span>
                )}
              </button>
              
              {showProfileModal && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
                  <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium text-gray-900">{userName}</p>
                    <p className="text-sm text-gray-500">{userTitle}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
} 