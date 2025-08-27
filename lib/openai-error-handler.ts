/**
 * Comprehensive OpenAI Error Handling Utility
 * Addresses mentor feedback on robust error handling for OpenAI API calls
 */

export class OpenAIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'OpenAIError'
  }
}

export class RateLimitError extends OpenAIError {
  constructor(retryAfter?: number) {
    super(
      `OpenAI rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      429
    )
  }
}

export class NetworkError extends OpenAIError {
  constructor(originalError: Error) {
    super('Network error connecting to OpenAI API', 'NETWORK_ERROR', undefined, originalError)
  }
}

export class InvalidResponseError extends OpenAIError {
  constructor(response?: string) {
    super(
      `Invalid or empty response from OpenAI${response ? `: ${response.slice(0, 100)}...` : ''}`,
      'INVALID_RESPONSE'
    )
  }
}

export class JSONParseError extends OpenAIError {
  constructor(response: string, originalError: Error) {
    super(
      `Failed to parse OpenAI JSON response: ${response.slice(0, 200)}...`,
      'JSON_PARSE_ERROR',
      undefined,
      originalError
    )
  }
}

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  exponentialBase: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  exponentialBase: 2
}

/**
 * Execute OpenAI API call with comprehensive error handling and retry logic
 */
export async function executeOpenAICall<T>(
  operation: () => Promise<T>,
  context: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const result = await operation()
      
      if (attempt > 0) {
        console.log(`✅ OpenAI call succeeded on attempt ${attempt + 1} for ${context}`)
      }
      
      return result
    } catch (error) {
      lastError = error as Error
      
      // Classify error type
      const classifiedError = classifyOpenAIError(error as Error, context)
      
      console.error(`❌ OpenAI call failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}) for ${context}:`, {
        error: classifiedError.message,
        code: classifiedError.code,
        status: classifiedError.status
      })
      
      // Don't retry on certain error types
      if (classifiedError.code === 'INVALID_API_KEY' || classifiedError.code === 'JSON_PARSE_ERROR') {
        throw classifiedError
      }
      
      // If this is the last attempt, throw the error
      if (attempt === retryConfig.maxRetries) {
        throw classifiedError
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.exponentialBase, attempt),
        retryConfig.maxDelay
      )
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000
      
      console.log(`🔄 Retrying OpenAI call for ${context} in ${Math.round(jitteredDelay)}ms...`)
      await new Promise(resolve => setTimeout(resolve, jitteredDelay))
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw lastError || new OpenAIError('Unknown error in OpenAI call', 'UNKNOWN_ERROR')
}

/**
 * Classify OpenAI errors into specific types for better handling
 */
function classifyOpenAIError(error: Error, context: string): OpenAIError {
  const errorMessage = error.message.toLowerCase()
  
  // Rate limit errors
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    const retryAfter = extractRetryAfter(error.message)
    return new RateLimitError(retryAfter)
  }
  
  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || 
      errorMessage.includes('timeout') || errorMessage.includes('econnreset')) {
    return new NetworkError(error)
  }
  
  // Authentication errors
  if (errorMessage.includes('unauthorized') || errorMessage.includes('api key') || 
      errorMessage.includes('401')) {
    return new OpenAIError('Invalid OpenAI API key', 'INVALID_API_KEY', 401, error)
  }
  
  // Quota exceeded
  if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
    return new OpenAIError('OpenAI quota exceeded or billing issue', 'QUOTA_EXCEEDED', 402, error)
  }
  
  // Model overloaded
  if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
    return new OpenAIError('OpenAI model is overloaded', 'MODEL_OVERLOADED', 503, error)
  }
  
  // Generic OpenAI API error
  if (errorMessage.includes('openai')) {
    return new OpenAIError(`OpenAI API error in ${context}: ${error.message}`, 'API_ERROR', undefined, error)
  }
  
  // Default classification
  return new OpenAIError(`Unknown error in ${context}: ${error.message}`, 'UNKNOWN_ERROR', undefined, error)
}

/**
 * Extract retry-after value from error message
 */
function extractRetryAfter(message: string): number | undefined {
  const match = message.match(/retry after (\d+)/i)
  return match ? parseInt(match[1]) : undefined
}

/**
 * Validate and parse OpenAI JSON response with detailed error handling
 */
export function parseOpenAIResponse(response: string | null | undefined, context: string): any {
  if (!response) {
    throw new InvalidResponseError()
  }
  
  // Clean response - remove markdown code blocks if present
  const cleanedResponse = response
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()
  
  if (!cleanedResponse) {
    throw new InvalidResponseError(response)
  }
  
  try {
    const parsed = JSON.parse(cleanedResponse)
    
    // Validate that it's an object (not null, array, or primitive)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new JSONParseError(cleanedResponse, new Error('Response is not a valid object'))
    }
    
    return parsed
  } catch (error) {
    if (error instanceof JSONParseError) {
      throw error
    }
    
    console.error(`🚨 JSON Parse Error in ${context}:`, {
      originalResponse: response,
      cleanedResponse: cleanedResponse,
      error: error instanceof Error ? error.message : 'Unknown parse error'
    })
    
    throw new JSONParseError(cleanedResponse, error as Error)
  }
}

/**
 * Health check for OpenAI API availability
 */
export async function checkOpenAIHealth(): Promise<{ available: boolean; error?: string }> {
  try {
    // Simple test call to check if OpenAI is responsive
    await executeOpenAICall(
      async () => {
        const OpenAI = require('openai')
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        
        return await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1
        })
      },
      'health-check',
      { maxRetries: 1, baseDelay: 500, maxDelay: 1000, exponentialBase: 1.5 }
    )
    
    return { available: true }
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof OpenAIError ? error.message : 'Unknown health check error'
    }
  }
}
