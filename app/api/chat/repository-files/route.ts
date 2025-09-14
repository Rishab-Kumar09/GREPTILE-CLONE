import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// This endpoint will be called by Lambda to store persistent repo data
// and by chat APIs to retrieve full repository context

interface RepoMetadata {
  analysisId: string;
  repository: string;
  timestamp: number;
  persistentPath: string;
  filesCount: number;
  totalIssues: number;
  criticalIssues: number;
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  type: string;
}

// Global storage for repository data (in-memory for serverless)
declare global {
  var repositoryCache: Map<string, {
    metadata: RepoMetadata;
    files: Map<string, FileContent>;
    timestamp: number;
  }>;
}

if (!global.repositoryCache) {
  global.repositoryCache = new Map();
}

// Cleanup old repositories every hour
setInterval(() => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();
  
  const entries = Array.from(global.repositoryCache.entries());
  entries.forEach(([analysisId, data]) => {
    if (now - data.timestamp > TWO_HOURS) {
      global.repositoryCache.delete(analysisId);
      console.log(`🧹 Cleaned up old repository cache: ${analysisId}`);
    }
  });
}, 60 * 60 * 1000);

// Store repository data (called by Lambda)
export async function POST(request: NextRequest) {
  try {
    const { analysisId, metadata, files } = await request.json();
    
    if (!analysisId || !metadata || !files) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Store in global cache
    const fileMap = new Map<string, FileContent>();
    files.forEach((file: FileContent) => {
      fileMap.set(file.path, file);
    });
    
    global.repositoryCache.set(analysisId, {
      metadata,
      files: fileMap,
      timestamp: Date.now()
    });
    
    console.log(`✅ Stored repository cache for ${analysisId}: ${files.length} files`);
    
    return NextResponse.json({
      success: true,
      analysisId,
      filesStored: files.length,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Failed to store repository data:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Retrieve repository data (called by chat APIs)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');
    const repository = searchParams.get('repository');
    
    if (!analysisId && !repository) {
      return NextResponse.json({ error: 'analysisId or repository required' }, { status: 400 });
    }
    
    // Find by analysisId first, then by repository name
    let repoData = null;
    
    if (analysisId) {
      repoData = global.repositoryCache.get(analysisId);
    }
    
    if (!repoData && repository) {
      // Search by repository name
      Array.from(global.repositoryCache.entries()).forEach(([id, data]) => {
        if (data.metadata.repository === repository) {
          repoData = data;
        }
      });
    }
    
    if (!repoData) {
      return NextResponse.json({ error: 'Repository data not found' }, { status: 404 });
    }
    
    // Convert Map to object for JSON response
    const filesArray = Array.from(repoData.files.entries()).map(([path, content]) => ({
      path,
      ...content
    }));
    
    return NextResponse.json({
      success: true,
      metadata: repoData.metadata,
      files: filesArray,
      filesCount: filesArray.length,
      cacheAge: Date.now() - repoData.timestamp
    });
    
  } catch (error) {
    console.error('❌ Failed to retrieve repository data:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Health check
export async function HEAD() {
  const cacheSize = global.repositoryCache.size;
  const totalFiles = Array.from(global.repositoryCache.values())
    .reduce((sum, data) => sum + data.files.size, 0);
    
  return new Response(null, {
    status: 200,
    headers: {
      'X-Cache-Size': cacheSize.toString(),
      'X-Total-Files': totalFiles.toString(),
      'X-Timestamp': Date.now().toString()
    }
  });
}
