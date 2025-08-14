// Simple migration trigger script
const https = require('https');

console.log('🚀 Triggering database migration...');

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
      if (res.statusCode === 200) {
        console.log('✅ Migration successful!');
        console.log('Response:', JSON.stringify(response, null, 2));
      } else {
        console.log('❌ Migration failed');
        console.log('Response:', JSON.stringify(response, null, 2));
      }
    } catch (parseError) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request error:', error.message);
});

req.write(postData);
req.end(); 