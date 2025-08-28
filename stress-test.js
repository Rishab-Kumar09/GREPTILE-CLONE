// 🔥 STRESS TEST - Let's break the app!

const tests = [
  // 1. MASSIVE REPO TEST
  { name: 'Linux Kernel (MASSIVE)', owner: 'torvalds', repo: 'linux', batchSize: 50 },
  
  // 2. INVALID REPO TEST  
  { name: 'Non-existent repo', owner: 'fakeuserxyz123', repo: 'nonexistent', batchSize: 1 },
  
  // 3. HUGE BATCH SIZE
  { name: 'Huge batch size', owner: 'octocat', repo: 'Hello-World', batchSize: 999 },
  
  // 4. EMPTY DATA TEST
  { name: 'Empty data', owner: '', repo: '', batchSize: 0 },
  
  // 5. MALFORMED DATA
  { name: 'Malformed data', owner: null, repo: undefined, batchSize: -1 },
  
  // 6. VERY LONG STRINGS
  { name: 'Long strings', owner: 'a'.repeat(1000), repo: 'b'.repeat(1000), batchSize: 1 }
];

async function breakApp() {
  console.log('🔥 BREAKING THE APP - STRESS TEST');
  console.log('================================\n');
  
  for (const test of tests) {
    console.log(`💥 TEST: ${test.name}`);
    console.log(`   Owner: ${String(test.owner).substring(0, 50)}...`);
    console.log(`   Repo: ${String(test.repo).substring(0, 50)}...`);
    console.log(`   Batch Size: ${test.batchSize}`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch('https://master.d3dp89x98knsw0.amplifyapp.com/api/github/analyze-repository-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test)
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`   ⏱️  Response Time: ${responseTime}ms`);
      console.log(`   📊 Status: ${response.status}`);
      
      const data = await response.text();
      console.log(`   📝 Response: ${data.substring(0, 150)}...`);
      
      if (response.status >= 500) {
        console.log('   🚨 SERVER ERROR - App might be breaking!');
      } else if (response.status >= 400) {
        console.log('   ⚠️  CLIENT ERROR - Good error handling');
      } else {
        console.log('   ✅ SUCCESS - App survived this test');
      }
      
    } catch (error) {
      console.log(`   💀 NETWORK CRASH: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🎯 STRESS TEST COMPLETE');
}

breakApp();
