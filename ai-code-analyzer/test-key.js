// Quick test to see if we can analyze without environment variables
const OpenAI = require('openai');

// Test with direct API key (ONLY FOR TESTING - DELETE THIS FILE AFTER)
const API_KEY = 'PASTE-YOUR-KEY-HERE-TEMPORARILY';

const openai = new OpenAI({
  apiKey: API_KEY
});

console.log('Testing OpenAI connection...');

async function testAnalysis() {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "API key works!"' }],
      max_tokens: 10
    });
    
    console.log('✅ SUCCESS:', response.choices[0].message.content);
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

testAnalysis();
