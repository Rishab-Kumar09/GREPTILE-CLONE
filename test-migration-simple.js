// Simplified test script for migration trigger (no auth needed)
const https = require('https');

const APP_URL = 'https://master.d3dp89x98knsw0.amplifyapp.com';

console.log('🚀 Testing migration trigger (no auth)...');

const postData = JSON.stringify({});

const options = {
  hostname: 'master.d3dp89x98knsw0.amplifyapp.com',
  port: 443,
  path: '/api/migrate/trigger',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
      
      if (res.statusCode === 200) {
        console.log('✅ Migration triggered successfully!');
        
        // Test database health after a delay
        setTimeout(() => {
          console.log('🔍 Testing database health...');
          
          const healthReq = https.get(`${APP_URL}/api/health/db`, (healthRes) => {
            let healthData = '';
            healthRes.on('data', chunk => healthData += chunk);
            healthRes.on('end', () => {
              if (healthRes.statusCode === 200) {
                console.log('✅ Database is healthy!');
                console.log('Health response:', healthData);
              } else {
                console.log(`❌ Database health check failed: ${healthRes.statusCode}`);
                console.log('Health error:', healthData);
              }
            });
          });
          
          healthReq.on('error', (error) => {
            console.log('❌ Health check error:', error.message);
          });
          
        }, 5000);
        
      } else {
        console.log(`❌ Migration failed: ${res.statusCode}`);
      }
    } catch (parseError) {
      console.log('Raw response:', data);
      console.log('Parse error:', parseError.message);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request error:', error.message);
});

req.write(postData);
req.end(); 