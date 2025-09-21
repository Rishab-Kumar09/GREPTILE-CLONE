import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Global storage for account selection data
declare global {
  var accountSelectionData: Map<string, {
    accounts: any[]
    githubUsername: string
    timestamp: number
  }>
}

if (!global.accountSelectionData) {
  global.accountSelectionData = new Map()
}

export async function POST(request: NextRequest) {
  try {
    const { accounts, githubUsername } = await request.json()
    
    if (!accounts || !githubUsername) {
      return NextResponse.json({
        success: false,
        error: 'Accounts and GitHub username are required'
      }, { status: 400 })
    }

    // Generate a selection ID
    const selectionId = `selection_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    // Store the account data temporarily (expires in 10 minutes)
    global.accountSelectionData.set(selectionId, {
      accounts,
      githubUsername,
      timestamp: Date.now()
    })
    
    console.log('✅ ACCOUNT SELECTION: Stored account data for selection:', selectionId)
    
    return NextResponse.json({
      success: true,
      selectionId: selectionId
    })

  } catch (error) {
    console.error('❌ ACCOUNT SELECTION STORAGE ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to store account selection data'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const selectionId = searchParams.get('selectionId')
    
    if (!selectionId) {
      return NextResponse.json({
        success: false,
        error: 'Selection ID is required'
      }, { status: 400 })
    }

    const selectionData = global.accountSelectionData.get(selectionId)
    
    if (!selectionData) {
      return NextResponse.json({
        success: false,
        error: 'Selection data not found or expired'
      }, { status: 404 })
    }

    // Check if expired (10 minutes)
    const age = Date.now() - selectionData.timestamp
    const maxAge = 10 * 60 * 1000 // 10 minutes
    
    if (age > maxAge) {
      global.accountSelectionData.delete(selectionId)
      return NextResponse.json({
        success: false,
        error: 'Selection data expired'
      }, { status: 410 })
    }

    return NextResponse.json({
      success: true,
      accounts: selectionData.accounts,
      githubUsername: selectionData.githubUsername
    })

  } catch (error) {
    console.error('❌ ACCOUNT SELECTION RETRIEVAL ERROR:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve account selection data'
    }, { status: 500 })
  }
}
