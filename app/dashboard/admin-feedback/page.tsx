'use client'

import { useState, useEffect } from 'react'
import DashboardHeader from '@/components/DashboardHeader'

interface Report {
  id: number
  issue_id: string
  title: string
  description: string
  category: string
  status: string
  severity?: string
  file_path?: string
  line_number?: number
  reported_by_user_id: string
  reported_by_email?: string
  created_at: string
  signed_off_by?: string
  signed_off_at?: string
  admin_notes?: string
  admin_name?: string
  admin_email?: string
  image_type?: string
  image_data?: string
  video_url?: string
}

interface Admin {
  id: number
  user_id: string
  user_email: string
  user_name: string
  is_super_admin: boolean
  created_at: string
}

interface User {
  id: string
  email: string
  name: string
  profileIcon: string
  profileImage: string
  createdAt: string
  report_count: number
}

export default function AdminFeedbackPage() {
  const [activeTab, setActiveTab] = useState<'reports' | 'admins' | 'users'>('reports')
  
  // Common state
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  
  // Reports tab state
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [signoffNotes, setSignoffNotes] = useState('')
  const [signoffStatus, setSignoffStatus] = useState('reviewed')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [includeResolved, setIncludeResolved] = useState(false)
  
  // Admins tab state
  const [admins, setAdmins] = useState<Admin[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [isAddingAdmin, setIsAddingAdmin] = useState(false)
  const [showUserPicker, setShowUserPicker] = useState(false)
  const [allUsersForPicker, setAllUsersForPicker] = useState<User[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState('')
  
  // Users tab state
  const [users, setUsers] = useState<User[]>([])
  
  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports()
    } else if (activeTab === 'admins') {
      loadAdmins()
    } else if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab, includeResolved])

  const loadInitialData = async () => {
    try {
      const currentUserStr = localStorage.getItem('currentUser')
      
      if (!currentUserStr) {
        window.location.href = '/signin'
        return
      }

      const currentUser = JSON.parse(currentUserStr)
      const currentUserId = currentUser.id
      setUserId(currentUserId)

      // Check admin status
      const roleRes = await fetch(`/api/admin/get-role?userId=${currentUserId}`)
      if (roleRes.ok) {
        const roleData = await roleRes.json()
        setIsAdmin(roleData.isAdmin)
        setIsSuperAdmin(roleData.isSuperAdmin)
      }

      // Load initial reports directly with userId
      try {
        const res = await fetch(`/api/feedback?userId=${currentUserId}&includeResolved=${includeResolved}`)
        const data = await res.json()
        if (data.success) {
          setReports(data.reports)
        }
      } catch (error) {
        console.error('Failed to load reports:', error)
      }
    } catch (error) {
      console.error('Failed to load initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ========== REPORTS TAB ==========
  const loadReports = async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/feedback?userId=${userId}&includeResolved=${includeResolved}`)
      const data = await res.json()
      if (data.success) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Failed to load reports:', error)
    }
  }

  const handleSignoff = async (report: Report, newStatus: string) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/feedback?action=signoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          userId,
          status: newStatus,
          notes: signoffNotes
        })
      })

      const data = await res.json()
      if (data.success) {
        setSelectedReport(null)
        setSignoffNotes('')
        loadReports()
      } else {
        alert('Failed to sign off: ' + data.error)
      }
    } catch (error) {
      alert('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ========== ADMINS TAB ==========
  const loadAdmins = async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/admin/manage-admins?userId=${userId}`)
      const data = await res.json()
      if (data.success) {
        setAdmins(data.admins)
      }
      
      // Also load users for the picker
      const usersRes = await fetch(`/api/admin/manage-users?userId=${userId}`)
      const usersData = await usersRes.json()
      if (usersData.success) {
        setAllUsersForPicker(usersData.users)
      }
    } catch (error) {
      console.error('Failed to load admins:', error)
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return
    
    setIsAddingAdmin(true)
    try {
      const res = await fetch('/api/admin/manage-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestingUserId: userId,
          userEmail: newAdminEmail.trim()
        })
      })

      const data = await res.json()
      if (data.success) {
        setNewAdminEmail('')
        loadAdmins()
        alert('✅ ' + data.message)
      } else {
        alert('❌ ' + data.error)
      }
    } catch (error) {
      alert('❌ Network error')
    } finally {
      setIsAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async (adminId: number, adminEmail: string) => {
    if (!confirm(`Remove ${adminEmail} as admin?`)) return
    
    try {
      const res = await fetch(`/api/admin/manage-admins?userId=${userId}&adminId=${adminId}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        loadAdmins()
        alert('✅ Admin removed')
      } else {
        alert('❌ ' + data.error)
      }
    } catch (error) {
      alert('❌ Network error')
    }
  }

  // ========== USERS TAB ==========
  const loadUsers = async () => {
    if (!userId) {
      console.log('⚠️ Cannot load users: No userId')
      return
    }
    try {
      console.log('📡 Loading users for userId:', userId)
      const res = await fetch(`/api/admin/manage-users?userId=${userId}`)
      const data = await res.json()
      console.log('📊 Users API response:', data)
      if (data.success) {
        setUsers(data.users)
        console.log('✅ Loaded users:', data.users.length)
      } else {
        console.error('❌ Failed to load users:', data.error)
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const handleDeleteUser = async (targetUserId: string, userEmail: string) => {
    if (!confirm(`⚠️ DELETE USER: ${userEmail}?\n\nThis will:\n- Delete their account\n- Keep their reports (for audit)\n- Remove admin status if applicable\n\nThis action CANNOT be undone!`)) return
    
    try {
      const res = await fetch(`/api/admin/manage-users?userId=${userId}&targetUserId=${targetUserId}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        loadUsers()
        alert('✅ User deleted')
      } else {
        alert('❌ ' + data.error)
      }
    } catch (error) {
      alert('❌ Network error')
    }
  }

  // ========== UI HELPERS ==========
  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-800'
      case 'reviewed': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'invalid': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const categoryEmoji = (category: string) => {
    switch (category) {
      case 'false_positive': return '🎯'
      case 'bug': return '🐛'
      case 'improvement': return '💡'
      case 'question': return '❓'
      default: return '📝'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have admin permissions.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛠️ Admin Dashboard
          </h1>
          <p className="text-gray-600">
            {isSuperAdmin ? 'Super Admin' : 'Admin'} control panel
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('reports')}
              className={`${
                activeTab === 'reports'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              📊 Issue Reports
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`${
                activeTab === 'admins'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              👥 Manage Admins
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              🗑️ Manage Users
            </button>
          </nav>
        </div>

        {/* ========== REPORTS TAB ========== */}
        {activeTab === 'reports' && (
          <div>
            {/* Filter */}
            <div className="mb-6 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeResolved}
                  onChange={(e) => setIncludeResolved(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Include resolved issues</span>
              </label>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
                <div className="text-sm text-gray-600">Total Reports</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {reports.filter(r => r.status === 'open').length}
                </div>
                <div className="text-sm text-gray-600">Open</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {reports.filter(r => r.status === 'reviewed').length}
                </div>
                <div className="text-sm text-gray-600">Reviewed</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-green-600">
                  {reports.filter(r => r.status === 'resolved').length}
                </div>
                <div className="text-sm text-gray-600">Resolved</div>
              </div>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
              {reports.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No reports yet.</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="bg-white shadow-sm rounded-lg border border-gray-200">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{categoryEmoji(report.category)}</span>
                          <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Reported by: {report.reported_by_email || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      {report.status === 'open' && (
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                        >
                          Review
                        </button>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="bg-gray-50 rounded-md p-4 mb-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {report.description}
                        </p>
                      </div>

                      {/* Image */}
                      {report.image_data && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">📷 Screenshot:</p>
                          <img 
                            src={report.image_type === 'url' 
                              ? report.image_data 
                              : `data:image/png;base64,${report.image_data}`
                            }
                            alt="Screenshot"
                            className="max-h-64 rounded border border-gray-300 cursor-pointer hover:opacity-90 hover:shadow-lg transition-all"
                            onClick={() => setLightboxImage(
                              report.image_type === 'url' 
                                ? (report.image_data || null)
                                : (report.image_data ? `data:image/png;base64,${report.image_data}` : null)
                            )}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Click to enlarge
                            {report.image_type === 'base64' && ' • Stored locally'}
                          </p>
                        </div>
                      )}

                      {/* Video */}
                      {report.video_url && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">🎥 Video:</p>
                          <a 
                            href={report.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline text-sm"
                          >
                            Watch Video →
                          </a>
                        </div>
                      )}

                      {/* Sign-off info */}
                      {report.signed_off_by && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Signed off by:</span>{' '}
                            {report.admin_name || report.admin_email || report.signed_off_by}
                            {report.signed_off_at && (
                              <span className="text-gray-500 ml-2">
                                • {new Date(report.signed_off_at).toLocaleString()}
                              </span>
                            )}
                          </p>
                          {report.admin_notes && (
                            <p className="text-sm text-gray-600 mt-2">
                              <span className="font-medium">Notes:</span> {report.admin_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========== ADMINS TAB ========== */}
        {activeTab === 'admins' && (
          <div>
            {/* Add Admin Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">➕ Add New Admin</h2>
              
              {/* User Picker or Email Input */}
              <div className="mb-4">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setShowUserPicker(true)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      showUserPicker 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    👥 Pick from Users ({allUsersForPicker.length})
                  </button>
                  <button
                    onClick={() => setShowUserPicker(false)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      !showUserPicker 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ✉️ Enter Email
                  </button>
                </div>

                {showUserPicker ? (
                  <div>
                    {/* Search */}
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search users by name or email..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-md mb-3"
                    />
                    
                    {/* User List */}
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                      {allUsersForPicker
                        .filter(user => 
                          user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                        )
                        .map(user => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setNewAdminEmail(user.email)
                              setShowUserPicker(false)
                              setUserSearchQuery('')
                            }}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex items-center gap-3"
                          >
                            {user.profileImage ? (
                              <img src={user.profileImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <span className="text-xl">{user.profileIcon || '👤'}</span>
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                              <p className="text-xs text-gray-600">{user.email}</p>
                            </div>
                            <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              Select
                            </button>
                          </div>
                        ))}
                      {allUsersForPicker.filter(user => 
                        user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <p className="p-4 text-center text-gray-500 text-sm">No users found</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Selected User Display */}
              {newAdminEmail && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Selected:</p>
                    <p className="text-sm text-blue-700">{newAdminEmail}</p>
                  </div>
                  <button
                    onClick={() => setNewAdminEmail('')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={handleAddAdmin}
                disabled={isAddingAdmin || !newAdminEmail.trim()}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isAddingAdmin ? 'Adding Admin...' : '➕ Add as Admin'}
              </button>
            </div>

            {/* Admins List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Current Admins ({admins.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {admins.length === 0 ? (
                  <p className="p-4 text-gray-600 text-center">No admins found</p>
                ) : (
                  admins.map((admin) => (
                    <div key={admin.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{admin.user_name}</p>
                          {admin.is_super_admin && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                              🔱 SUPER ADMIN
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{admin.user_email}</p>
                        <p className="text-xs text-gray-500">
                          Added: {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!admin.is_super_admin && (
                        <button
                          onClick={() => handleRemoveAdmin(admin.id, admin.user_email)}
                          className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                      {admin.is_super_admin && (
                        <span className="text-sm text-gray-400 italic">
                          Cannot be removed
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== USERS TAB ========== */}
        {activeTab === 'users' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  All Users ({users.length})
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  ⚠️ Deleting a user will remove their account but keep their reports for audit
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <p className="p-4 text-gray-600 text-center">No users found</p>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3 flex-1">
                        {user.profileImage ? (
                          <img src={user.profileImage} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <span className="text-2xl">{user.profileIcon || '👤'}</span>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <p className="text-xs text-gray-500">
                            Joined: {new Date(user.createdAt).toLocaleDateString()} • 
                            {' '}{user.report_count} report{user.report_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {user.id !== userId && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                        >
                          Delete User
                        </button>
                      )}
                      {user.id === userId && (
                        <span className="text-sm text-gray-400 italic">
                          You (cannot delete)
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sign-off Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl p-6 m-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Review Issue</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-100 rounded-md">
                <p className="font-semibold text-gray-900 mb-1">{selectedReport.title}</p>
                <p className="text-sm text-gray-600">{selectedReport.description}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={signoffStatus}
                  onChange={(e) => setSignoffStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="invalid">Invalid / Not an Issue</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (optional)
                </label>
                <textarea
                  value={signoffNotes}
                  onChange={(e) => setSignoffNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                  placeholder="Add any notes about this issue..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSignoff(selectedReport, signoffStatus)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Lightbox Modal */}
        {lightboxImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Close button */}
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Image */}
              <img 
                src={lightboxImage}
                alt="Full size screenshot"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Download button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Fetch image and trigger download
                  fetch(lightboxImage)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `screenshot-${Date.now()}.png`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    })
                    .catch(err => {
                      console.error('Download failed:', err)
                      alert('Download failed. Image may be on a different domain.')
                    })
                }}
                className="absolute bottom-4 right-4 px-4 py-2 bg-white text-gray-900 rounded-md hover:bg-gray-100 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>

              {/* Helper text */}
              <p className="absolute bottom-4 left-4 text-white text-sm bg-black/50 px-3 py-2 rounded-md">
                Click outside to close
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
