/**
 * Health Check Endpoint
 * Addresses mentor feedback on explicit health check endpoints for monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkOpenAIHealth } from '@/lib/openai-error-handler'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Basic service health
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {
        database: await checkDatabaseHealth(),
        openai: await checkOpenAIHealth(),
        github: await checkGitHubHealth()
      },
      responseTime: 0 // Will be set below
    }
    
    // Calculate response time
    health.responseTime = Date.now() - startTime
    
    // Determine overall health status
    const allServicesHealthy = Object.values(health.services).every(service => service.available)
    
    if (!allServicesHealthy) {
      health.status = 'degraded'
    }
    
    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 503
    
    return NextResponse.json(health, { status: statusCode })
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown health check error',
      responseTime: Date.now() - startTime
    }, { status: 503 })
  }
}

/**
 * Check database connectivity
 */
async function checkDatabaseHealth(): Promise<{ available: boolean; error?: string; responseTime?: number }> {
  const startTime = Date.now()
  
  try {
    // For Supabase/PostgreSQL, we can check if environment variables are set
    // In a real implementation, you'd want to actually ping the database
    const hasDbConfig = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    if (!hasDbConfig) {
      return { 
        available: false, 
        error: 'Database configuration missing',
        responseTime: Date.now() - startTime
      }
    }
    
    // TODO: Add actual database ping when Supabase client is properly configured
    // const { data, error } = await supabase.from('repositories').select('id').limit(1)
    
    return { 
      available: true,
      responseTime: Date.now() - startTime
    }
    
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'Database health check failed',
      responseTime: Date.now() - startTime
    }
  }
}

/**
 * Check GitHub API connectivity
 */
async function checkGitHubHealth(): Promise<{ available: boolean; error?: string; responseTime?: number }> {
  const startTime = Date.now()
  
  try {
    // Simple test to GitHub API
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greptile-Clone-Health-Check'
      }
    })
    
    if (!response.ok) {
      return { 
        available: false, 
        error: `GitHub API returned ${response.status}`,
        responseTime: Date.now() - startTime
      }
    }
    
    const data = await response.json()
    
    return { 
      available: true,
      responseTime: Date.now() - startTime
    }
    
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'GitHub health check failed',
      responseTime: Date.now() - startTime
    }
  }
}

/**
 * Detailed health check with more information (for internal monitoring)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      services: {
        database: await checkDatabaseHealth(),
        openai: await checkOpenAIHealth(),
        github: await checkGitHubHealth()
      },
      environment_check: {
        openai_configured: !!process.env.OPENAI_API_KEY,
        supabase_configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        nextauth_configured: !!process.env.NEXTAUTH_SECRET,
        github_oauth_configured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
      },
      responseTime: 0
    }
    
    detailedHealth.responseTime = Date.now() - startTime
    
    // Determine overall health status
    const allServicesHealthy = Object.values(detailedHealth.services).every(service => service.available)
    const criticalEnvVars = detailedHealth.environment_check.openai_configured
    
    if (!allServicesHealthy || !criticalEnvVars) {
      detailedHealth.status = 'degraded'
    }
    
    const statusCode = detailedHealth.status === 'healthy' ? 200 : 503
    
    return NextResponse.json(detailedHealth, { status: statusCode })
    
  } catch (error) {
    console.error('Detailed health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown detailed health check error',
      responseTime: Date.now() - startTime
    }, { status: 503 })
  }
}
