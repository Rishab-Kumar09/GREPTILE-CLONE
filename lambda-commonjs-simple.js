const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event) => {
  console.log('🚀 CommonJS simple Lambda started');
  
  try {
    const { repoUrl, analysisId } = JSON.parse(event.body || '{}');
    
    if (!repoUrl || !analysisId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'repoUrl and analysisId required' })
      };
    }
    
    // Just return mock data for now to test
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        analysisId,
        results: [
          {
            file: 'App.js',
            issues: [
              {
                type: 'test',
                message: 'CommonJS test issue',
                line: 10,
                code: 'console.log("test")',
                severity: 'info'
              }
            ]
          }
        ],
        message: 'CommonJS test: 1 issue found in 1 file'
      })
    };
    
  } catch (error) {
    console.error('❌ CommonJS test failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'CommonJS test failed'
      })
    };
  }
};
