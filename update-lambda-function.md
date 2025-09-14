# Quick Lambda Function Update Guide

## The Issue:
Your Lambda function is still running the old code and showing this error:
```
⚠️ Failed to read file: ENOENT: no such file or directory, open '/tmp/chat-repos/.../tmp/analysis-.../jarvis.py'
```

## The Fix:
The Lambda needs to be manually updated with the latest code.

## Steps:

### Option 1: AWS Console (Recommended)
1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Find your function: `enterprise-code-analyzer`
3. Click on the function name
4. Go to "Code" tab
5. Select all existing code (Ctrl+A) and delete it
6. Copy the entire contents of `lambda-function-enhanced.js` from your project
7. Paste it into the Lambda editor
8. Click "Deploy" button
9. Wait for "Successfully updated" message

### Option 2: AWS CLI (If you have it set up)
```bash
# Zip the function
zip lambda-function.zip lambda-function-enhanced.js

# Update the function
aws lambda update-function-code \
  --function-name enterprise-code-analyzer \
  --zip-file fileb://lambda-function.zip
```

## Expected Result After Update:
- ✅ Files will be read correctly from `/tmp/analysis-{timestamp}/jarvis.py`
- ✅ Repository files will be stored (instead of 0 files)
- ✅ RAG chat will work (no more 404 errors)
- ✅ Chat will have full repository context

## Test After Update:
1. Analyze a repository
2. Check CloudWatch logs - should see: `📊 Prepared 1 files for storage` (instead of 0)
3. Try RAG chat - should work without falling back to GitHub API

## Current Status:
- ❌ Lambda is running old code (still has the file path bug)
- ❌ RAG chat fails with 404 (no repository files stored)
- ✅ GitHub API fallback works (that's why you still get responses)
