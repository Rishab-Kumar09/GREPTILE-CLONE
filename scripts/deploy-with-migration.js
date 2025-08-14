#!/usr/bin/env node

// Production-grade deployment with migration
// Similar to what Stripe, GitHub, and Shopify use

const { execSync, spawn } = require('child_process');
const https = require('https');

const APP_URL = 'https://master.d3dp89x98knsw0.amplifyapp.com';
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'your-secret-key';

// Configuration (like big companies)
const CONFIG = {
  DEPLOY_TIMEOUT: 600, // 10 minutes max for deployment
  STABILIZATION_DELAY: 180, // 3 minutes delay (Stripe uses 2-3 min)
  HEALTH_CHECK_RETRIES: 10,
  HEALTH_CHECK_INTERVAL: 30, // 30 seconds between checks
};

console.log('🚀 Starting production deployment with automated migration...');

async function checkDeploymentStatus() {
  return new Promise((resolve, reject) => {
    const req = https.get(`${APP_URL}/api/health/db`, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function triggerMigration() {
  return new Promise((resolve, reject) => {
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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Migration completed successfully');
          resolve(true);
        } else {
          console.log(`❌ Migration failed: ${res.statusCode}`);
          reject(new Error(`Migration failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Deploy application
    console.log('📦 Deploying application...');
    execSync('git push', { stdio: 'inherit' });
    
    // Step 2: Wait for deployment to stabilize (like Stripe does)
    console.log(`⏳ Waiting ${CONFIG.STABILIZATION_DELAY} seconds for deployment to stabilize...`);
    console.log('   (This is normal - Stripe waits 2-3 minutes, GitHub waits 3-5 minutes)');
    
    await new Promise(resolve => setTimeout(resolve, CONFIG.STABILIZATION_DELAY * 1000));
    
    // Step 3: Health check loop (like big companies)
    console.log('🔍 Performing health checks before migration...');
    let healthCheckPassed = false;
    
    for (let i = 1; i <= CONFIG.HEALTH_CHECK_RETRIES; i++) {
      console.log(`   Health check attempt ${i}/${CONFIG.HEALTH_CHECK_RETRIES}...`);
      
      try {
        const response = await fetch(`${APP_URL}`);
        if (response.ok) {
          console.log('✅ Application is responding');
          healthCheckPassed = true;
          break;
        }
      } catch (error) {
        console.log(`   Attempt ${i} failed, retrying in ${CONFIG.HEALTH_CHECK_INTERVAL}s...`);
      }
      
      if (i < CONFIG.HEALTH_CHECK_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.HEALTH_CHECK_INTERVAL * 1000));
      }
    }
    
    if (!healthCheckPassed) {
      throw new Error('Application health check failed after maximum retries');
    }
    
    // Step 4: Trigger migration
    console.log('🗄️ Triggering database migration...');
    await triggerMigration();
    
    // Step 5: Final verification
    console.log('🔍 Final verification...');
    const finalCheck = await checkDeploymentStatus();
    
    if (finalCheck) {
      console.log('🎉 Deployment and migration completed successfully!');
      console.log(`🌐 Application is live at: ${APP_URL}`);
    } else {
      throw new Error('Final database health check failed');
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Deployment interrupted');
  process.exit(1);
});

main(); 