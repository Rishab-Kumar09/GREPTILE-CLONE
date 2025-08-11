import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key (for admin operations)
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Database schema types (you'll generate these from Supabase)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      repositories: {
        Row: {
          id: string
          user_id: string
          name: string
          full_name: string
          github_id: number
          language: string | null
          stars: number
          forks: number
          is_private: boolean
          description: string | null
          html_url: string
          status: 'active' | 'inactive' | 'pending'
          last_analyzed: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          full_name: string
          github_id: number
          language?: string | null
          stars?: number
          forks?: number
          is_private?: boolean
          description?: string | null
          html_url: string
          status?: 'active' | 'inactive' | 'pending'
          last_analyzed?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          full_name?: string
          github_id?: number
          language?: string | null
          stars?: number
          forks?: number
          is_private?: boolean
          description?: string | null
          html_url?: string
          status?: 'active' | 'inactive' | 'pending'
          last_analyzed?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          repository_id: string
          user_id: string
          pr_number: number
          pr_title: string
          pr_url: string
          status: 'pending' | 'completed' | 'failed'
          ai_summary: string | null
          issues_found: number
          suggestions_count: number
          severity: 'low' | 'medium' | 'high' | 'critical'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          repository_id: string
          user_id: string
          pr_number: number
          pr_title: string
          pr_url: string
          status?: 'pending' | 'completed' | 'failed'
          ai_summary?: string | null
          issues_found?: number
          suggestions_count?: number
          severity?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          repository_id?: string
          user_id?: string
          pr_number?: number
          pr_title?: string
          pr_url?: string
          status?: 'pending' | 'completed' | 'failed'
          ai_summary?: string | null
          issues_found?: number
          suggestions_count?: number
          severity?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          message: string
          response: string
          context: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          response: string
          context?: any
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          response?: string
          context?: any
          created_at?: string
        }
      }
    }
  }
} 