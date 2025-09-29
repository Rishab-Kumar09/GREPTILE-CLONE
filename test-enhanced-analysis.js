const fs = require('fs');
const path = require('path');

// Load the lambda function
const lambdaCode = fs.readFileSync('lambda-function-enhanced.js', 'utf8');

// Test content with unused variables, hooks, and imports
const testContent = `
import React, { useState, useEffect } from 'react';
import { unusedUtil, usedUtil } from './utils';

function TestComponent() {
  const [count, setCount] = useState(0);
  const [unusedState, setUnusedState] = useState('');
  const unusedVar = 'this is not used';
  const usedVar = 'this is used';
  
  return <div>{usedVar} {usedUtil()}</div>;
}
`;

// Extract and test the functions
eval(lambdaCode.replace('export const handler', 'const handler'));

console.log('🧪 Testing enhanced analysis functions...');

try {
  // Test unused variables
  const unusedVars = checkUnusedVariables(testContent, 'TestComponent.jsx');
  console.log('📊 Unused Variables:', unusedVars.length, 'found');
  unusedVars.forEach(issue => console.log('  -', issue.message));

  // Test unused hooks  
  const unusedHooks = checkUnusedHooks(testContent, 'TestComponent.jsx');
  console.log('🪝 Unused Hooks:', unusedHooks.length, 'found');
  unusedHooks.forEach(issue => console.log('  -', issue.message));

  // Test unused imports
  const unusedImports = checkUnusedImports(testContent, 'TestComponent.jsx');
  console.log('📦 Unused Imports:', unusedImports.length, 'found');
  unusedImports.forEach(issue => console.log('  -', issue.message));

  console.log('✅ Enhanced analysis functions working correctly!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
}
