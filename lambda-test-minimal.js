const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event) => {
  console.log('🚀 Minimal test Lambda started');
  
  try {
    const { repoUrl, analysisId, batchPath = null } = JSON.parse(event.body || '{}');
    
    if (!repoUrl || !analysisId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'repoUrl and analysisId required' })
      };
    }
    
    console.log(`📦 Testing with: ${repoUrl}, batch: ${batchPath || 'FULL'}`);
    
    // Simple test - just return mock data
    const mockResults = [
      {
        file: 'test.js',
        issues: [
          {
            type: 'test',
            message: 'Mock issue for testing',
            line: 1,
            code: 'console.log("test")',
            severity: 'info'
          }
        ]
      }
    ];
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId,
        results: mockResults,
        message: `Test analysis complete: 1 issue found in 1 file`,
        isBatch: !!batchPath,
        batchPath: batchPath
      })
    };
    
  } catch (error) {
    console.error('❌ Test Lambda failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Test error'
      })
    };
  }
};
