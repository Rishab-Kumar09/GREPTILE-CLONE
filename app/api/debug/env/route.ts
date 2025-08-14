import { NextResponse } from 'next/server'

export async function GET() {
  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET (hidden)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    // Show all env vars that start with certain prefixes (safe ones)
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.startsWith('NODE_') || 
      key.startsWith('AWS_') || 
      key.startsWith('DATABASE_') ||
      key.startsWith('OPENAI_')
    )
  }
  
  return NextResponse.json(envVars)
} 