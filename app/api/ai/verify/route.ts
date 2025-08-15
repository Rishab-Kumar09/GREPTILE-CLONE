import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not found in environment variables',
        details: 'Make sure OPENAI_API_KEY is set in your .env file'
      })
    }

    // Check API key format
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid OpenAI API key format',
        details: 'OpenAI API keys should start with "sk-"'
      })
    }

    // Test the API key with a simple request
    const openai = new OpenAI({
      apiKey: apiKey,
    })

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Say 'OpenAI API key is working!' in exactly those words." }
      ],
      max_tokens: 20,
      temperature: 0,
    })

    const response = completion.choices[0].message.content

    return NextResponse.json({
      success: true,
      message: 'OpenAI API key is working correctly!',
      details: {
        response: response,
        status: 'Connected and ready'
      }
    })

  } catch (error: any) {
    console.error('OpenAI verification error:', error)
    
    let errorMessage = 'Unknown error occurred'
    let details = error.message

    if (error.code === 'invalid_api_key') {
      errorMessage = 'Invalid OpenAI API key'
      details = 'The API key provided is not valid. Please check your OpenAI account.'
    } else if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI quota exceeded'
      details = 'You have exceeded your OpenAI usage quota. Please check your billing.'
    } else if (error.code === 'rate_limit_exceeded') {
      errorMessage = 'Rate limit exceeded'
      details = 'Too many requests. Please wait a moment and try again.'
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: details,
      code: error.code || 'unknown'
    })
  }
} 