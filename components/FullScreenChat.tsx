'use client'

import { useState, useRef, useEffect } from 'react'
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import MarkdownRenderer from './MarkdownRenderer'

interface ChatMessage {
  id: number
  type: 'user' | 'ai'
  content: string
  timestamp: Date
  citations: Array<{
    file: string
    line?: number
    snippet?: string
  }>
}

interface FullScreenChatProps {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSendMessage: (message: string) => Promise<void>
  loading: boolean
  repoName?: string
}

export default function FullScreenChat({ 
  isOpen, 
  onClose, 
  messages, 
  onSendMessage, 
  loading, 
  repoName 
}: FullScreenChatProps) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!inputMessage.trim() || loading) return
    
    const message = inputMessage.trim()
    setInputMessage('')
    
    try {
      await onSendMessage(message)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-x-0 top-0 bottom-4 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">🤖</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AI Assistant</h1>
            <p className="text-sm text-gray-500">
              {repoName ? `Chatting about ${repoName}` : 'Get answers with file citations and line references'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
              <p className="text-gray-500 mb-4">Ask me anything about this repository</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setInputMessage("What are the main features of this project?")}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  What are the main features?
                </button>
                <button
                  onClick={() => setInputMessage("How does the authentication work?")}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  How does authentication work?
                </button>
                <button
                  onClick={() => setInputMessage("Show me the security issues")}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Show me security issues
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl ${msg.type === 'user' ? 'order-2' : 'order-1'}`}>
                  {msg.type === 'ai' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">🤖</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">AI Assistant</span>
                    </div>
                  )}
                  
                  <div className={`rounded-2xl px-6 py-4 ${
                    msg.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-50 text-gray-900 border border-gray-200'
                  }`}>
                    <MarkdownRenderer 
                      content={msg.content} 
                      className="text-base leading-relaxed" 
                      isUserMessage={msg.type === 'user'} 
                    />
                    
                    {/* Citations */}
                    {msg.type === 'ai' && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">📎 Sources:</p>
                        <div className="space-y-2">
                          {msg.citations.map((citation, idx) => (
                            <div key={idx} className="bg-white border rounded-lg p-3">
                              <div className="font-mono text-sm text-blue-600 font-medium">
                                {citation.file}
                                {citation.line && `:${citation.line}`}
                              </div>
                              {citation.snippet && (
                                <div className="mt-2 bg-gray-900 text-gray-100 p-2 rounded text-sm font-mono overflow-x-auto">
                                  {citation.snippet}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <p className={`text-xs mt-3 ${
                      msg.type === 'user' ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  
                  {msg.type === 'user' && (
                    <div className="flex items-center justify-end space-x-2 mt-2">
                      <span className="text-sm text-gray-500">You</span>
                      <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-3xl">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">🤖</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">AI Assistant</span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about this repository..."
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim() || loading}
              className={`p-3 rounded-2xl transition-colors ${
                inputMessage.trim() && !loading
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
