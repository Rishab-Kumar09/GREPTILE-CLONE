// Simple test script for migration trigger
const https = require('https');

const APP_URL = 'https://master.d3dp89x98knsw0.amplifyapp.com';
const MIGRATION_SECRET = 'your-secret-key'; // Use the same key you set in Amplify

console.log('🚀 Testing migration trigger...');

const postData = JSON.stringify({});

const options = {
  hostname: 'master.d3dp89x98knsw0.amplifyapp.com',
  port: 443,
  path: '/api/migrate/trigger',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${MIGRATION_SECRET}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ Migration triggered successfully!');
      
      // Test database health
      setTimeout(() => {
        console.log('🔍 Testing database health...');
        
        const healthReq = https.get(`${APP_URL}/api/health/db`, (healthRes) => {
          if (healthRes.statusCode === 200) {
            console.log('✅ Database is healthy!');
          } else {
            console.log(`❌ Database health check failed: ${healthRes.statusCode}`);
          }
        });
        
        healthReq.on('error', (error) => {
          console.log('❌ Health check error:', error.message);
        });
        
      }, 5000);
      
    } else {
      console.log(`❌ Migration failed: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request error:', error.message);
});

req.write(postData);
req.end(); 