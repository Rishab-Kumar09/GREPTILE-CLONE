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
}

export default function AdminFeedbackPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [signoffNotes, setSignoffNotes] = useState('')
  const [signoffStatus, setSignoffStatus] = useState('reviewed')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [includeResolved, setIncludeResolved] = useState(false)

  useEffect(() => {
    loadData()
  }, [includeResolved])

  const loadData = async () => {
    try {
      // Get current user from localStorage
      const currentUserStr = localStorage.getItem('currentUser')
      
      if (!currentUserStr) {
        window.location.href = '/signin'
        return
      }

      const currentUser = JSON.parse(currentUserStr)
      const currentUserId = currentUser.id

      setUserId(currentUserId)

      // Load reports
      const reportsRes = await fetch(
        `/api/feedback?userId=${currentUserId}&includeResolved=${includeResolved}`
      )
      const reportsData = await reportsRes.json()

      if (reportsData.success) {
        setReports(reportsData.reports)
        setIsAdmin(reportsData.isAdmin)
      } else {
        console.error('Failed to load reports:', reportsData.error)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
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
        loadData() // Reload
        alert(`Issue marked as ${newStatus}!`)
      } else {
        alert('Failed: ' + data.error)
      }
    } catch (error) {
      alert('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">🚫 Access Denied</h1>
            <p className="text-gray-600">You don't have admin permissions.</p>
          </div>
        </div>
      </div>
    )
  }

  const statusBadgeColor = (status: string) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🛠️ Admin Feedback Dashboard
          </h1>
          <p className="text-gray-600">
            Review and sign off on user-reported issues
          </p>
        </div>

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
          <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {reports.filter(r => r.status === 'open').length}
            </div>
            <div className="text-sm text-gray-600">Open</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-4">
            <div className="text-2xl font-bold text-blue-600">
              {reports.filter(r => r.status === 'reviewed').length}
            </div>
            <div className="text-sm text-gray-600">Reviewed</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4">
            <div className="text-2xl font-bold text-green-600">
              {reports.filter(r => r.status === 'resolved').length}
            </div>
            <div className="text-sm text-gray-600">Resolved</div>
          </div>
        </div>

        {/* Reports List */}
        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No reports yet</h3>
            <p className="text-gray-600">User feedback will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{categoryEmoji(report.category)}</span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {report.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeColor(report.status)}`}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Reported by: {report.reported_by_email || report.reported_by_user_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-md p-4 mb-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {report.description}
                  </p>
                </div>

                {report.signed_off_by && (
                  <div className="bg-blue-50 rounded-md p-3 mb-4">
                    <p className="text-sm text-blue-900 font-medium mb-1">
                      ✅ Signed off by admin
                    </p>
                    {report.admin_notes && (
                      <p className="text-sm text-blue-800">
                        Notes: {report.admin_notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Admin Actions */}
                {report.status !== 'resolved' && (
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    {selectedReport?.id === report.id ? (
                      <div className="flex-1">
                        <textarea
                          value={signoffNotes}
                          onChange={(e) => setSignoffNotes(e.target.value)}
                          placeholder="Add notes (optional)..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2 resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSignoff(report, 'reviewed')}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                          >
                            ✅ Mark Reviewed
                          </button>
                          <button
                            onClick={() => handleSignoff(report, 'resolved')}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            ✔️ Mark Resolved
                          </button>
                          <button
                            onClick={() => handleSignoff(report, 'invalid')}
                            disabled={isSubmitting}
                            className="px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
                          >
                            ❌ Mark Invalid
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReport(null)
                              setSignoffNotes('')
                            }}
                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
                      >
                        📝 Sign Off
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
