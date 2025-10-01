'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  issueId: string
  issueTitle: string
  issueDescription: string
  userId: string
  userEmail?: string
}

export default function FeedbackModal({
  isOpen,
  onClose,
  issueId,
  issueTitle,
  issueDescription,
  userId,
  userEmail
}: FeedbackModalProps) {
  const [title, setTitle] = useState(`Report: ${issueTitle}`)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('false_positive')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  if (!isOpen) return null

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (1MB = 1,048,576 bytes)
    if (file.size > 1048576) {
      setError('❌ Image must be less than 1MB (selected: ' + Math.round(file.size / 1024) + ' KB)')
      e.target.value = '' // Clear the file input
      setImageFile(null)
      setImagePreview(null)
      return
    }

    // Check file type
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setError('❌ Only JPG, PNG, and GIF images are allowed')
      e.target.value = '' // Clear the file input
      setImageFile(null)
      setImagePreview(null)
      return
    }

    setImageFile(file)
    setError('')

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 📸 Upload to Imgur (simple & reliable)
  const uploadToImgur = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: 'Client-ID 546c25a59c58ad7',
        },
        body: formData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        return data.data.link
      }
      return null
    } catch (error) {
      console.log('Imgur upload failed:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      let imageType = null
      let imageData = null

      // Handle image upload if present
      if (imageFile) {
        // 🛡️ DOUBLE-CHECK FILE SIZE (just in case)
        if (imageFile.size > 1048576) {
          setError('❌ Image is too large (' + Math.round(imageFile.size / 1024) + ' KB). Maximum is 1 MB (1024 KB).')
          setIsSubmitting(false)
          setImageFile(null)
          setImagePreview(null)
          return
        }
        
        setUploadStatus('Uploading image...')
        
        // Try Imgur first
        const imgurUrl = await uploadToImgur(imageFile)
        
        if (imgurUrl) {
          imageType = 'url'
          imageData = imgurUrl
          setUploadStatus('✓ Image uploaded!')
        } else {
          // Fallback to base64
          imageType = 'base64'
          imageData = imagePreview?.split(',')[1]
          setUploadStatus('✓ Image attached!')
        }
      }

      const response = await fetch('/api/feedback?action=report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          title,
          description: `${description}\n\n---\nOriginal Issue: ${issueDescription}`,
          category,
          userId,
          userEmail,
          imageType,
          imageData,
          videoUrl: videoUrl || null
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setDescription('')
          setImageFile(null)
          setImagePreview(null)
          setVideoUrl('')
          setUploadStatus('')
        }, 2000)
      } else {
        setError(data.error || 'Failed to submit report')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Report Issue
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Report Submitted!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Thank you for your feedback. An admin will review it soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Original Issue Preview */}
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Reporting on:
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {issueTitle}
              </p>
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Issue Type
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="false_positive">False Positive</option>
                <option value="bug">Bug in Detection</option>
                <option value="improvement">Suggestion for Improvement</option>
                <option value="question">Question</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Report Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Please describe the issue in detail..."
                required
              />
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📷 Screenshot (optional, max 1MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleImageChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              {imagePreview && (
                <div className="mt-2">
                  <img src={imagePreview} alt="Preview" className="max-h-32 rounded border border-gray-300" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                    }}
                    className="mt-1 text-xs text-red-600 hover:text-red-800"
                  >
                    Remove image
                  </button>
                </div>
              )}
              {uploadStatus && (
                <p className="mt-1 text-xs text-blue-600">{uploadStatus}</p>
              )}
            </div>

            {/* Video URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🎥 Video URL (optional)
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://loom.com/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
