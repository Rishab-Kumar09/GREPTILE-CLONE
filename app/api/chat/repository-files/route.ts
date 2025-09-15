import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import '../../../../types/global' // Import shared global types
import type { RepoMetadata, FileContent } from '../../../../types/global'

// This endpoint will be called by Lambda to store persistent repo data
// and by chat APIs to retrieve full repository context

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
    
    console.log(`🔍 RAG GET request: analysisId=${analysisId}, repository=${repository}`);
    console.log(`📊 Cache size: ${global.repositoryCache.size} entries`);
    console.log(`📋 Cache keys: ${Array.from(global.repositoryCache.keys()).join(', ')}`);
    
    if (!analysisId && !repository) {
      return NextResponse.json({ error: 'analysisId or repository required' }, { status: 400 });
    }
    
    // Find by analysisId first, then by repository name
    let repoData = null;
    
    if (analysisId) {
      repoData = global.repositoryCache.get(analysisId);
      console.log(`🔍 Looking for analysisId ${analysisId}: ${repoData ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    if (!repoData && repository) {
      // Search by repository name
      console.log(`🔍 Searching by repository name: ${repository}`);
      Array.from(global.repositoryCache.entries()).forEach(([id, data]) => {
        console.log(`📋 Checking cache entry ${id}: ${data.metadata.repository}`);
        if (data.metadata.repository === repository) {
          repoData = data;
          console.log(`✅ Found match by repository name!`);
        }
      });
    }
    
    if (!repoData) {
      console.log(`❌ Repository data not found. Cache entries: ${Array.from(global.repositoryCache.keys()).join(', ')}`);
      return NextResponse.json({ error: 'Repository data not found' }, { status: 404 });
    }
    
    // Convert Map to object for JSON response
    const filesArray = Array.from(repoData.files.entries()).map(([filePath, content]) => ({
      path: filePath,
      content: content.content,
      size: content.size,
      type: content.type
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
