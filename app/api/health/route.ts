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
    // Check if AWS RDS database environment variables are configured
    const hasRdsConfig = !!(
      process.env.DATABASE_URL || 
      (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME)
    )
    
    if (!hasRdsConfig) {
      return { 
        available: false, 
        error: 'AWS RDS database configuration missing (DATABASE_URL or DB_HOST/DB_USER/DB_NAME)',
        responseTime: Date.now() - startTime
      }
    }
    
    // Test actual database connectivity
    try {
      // Simple database connectivity test using a basic API call
      const testResponse = await fetch('/api/repositories', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (testResponse.ok) {
        return { 
          available: true,
          responseTime: Date.now() - startTime
        }
      } else if (testResponse.status === 401 || testResponse.status === 403) {
        // Auth error means DB is reachable but no user session
        return { 
          available: true,
          error: 'Database reachable (auth required for full test)',
          responseTime: Date.now() - startTime
        }
      } else {
        return { 
          available: false,
          error: `Database API returned ${testResponse.status}`,
          responseTime: Date.now() - startTime
        }
      }
    } catch (dbError) {
      return { 
        available: false,
        error: `Database connectivity test failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      }
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
