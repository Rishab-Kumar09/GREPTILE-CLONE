# Git Layer for AWS Lambda

## How to Create and Deploy Git Layer

### 1. Create Git Layer ZIP

```bash
# On Amazon Linux 2 (same as Lambda runtime)
mkdir -p git-layer/bin
cd git-layer

# Install git and dependencies
yum install -y git
cp /usr/bin/git bin/
cp /usr/libexec/git-core/* bin/ 2>/dev/null || true

# Create layer ZIP
zip -r git-layer.zip .
```

### 2. Create Lambda Layer via AWS Console

1. Go to AWS Lambda Console
2. Click "Layers" → "Create layer"
3. Name: `git-binary-layer`
4. Upload `git-layer.zip`
5. Compatible runtimes: `nodejs18.x`, `nodejs20.x`
6. Create layer

### 3. Add Layer to Lambda Function

In your Lambda function configuration:
1. Go to "Layers" section
2. "Add a layer" → "Custom layers"
3. Select `git-binary-layer`
4. Choose latest version

### 4. Alternative: Pre-built Git Layer ARN

You can use this public Git layer:
```
arn:aws:lambda:us-east-1:553035198032:layer:git-lambda2:8
```

### 5. Environment Variables

Set in Lambda:
```
PATH=/opt/bin:/usr/local/bin:/usr/bin/:/bin:/opt/nodejs/node_modules/.bin
```

## How Our Code Uses It

```typescript
// Detects Lambda environment and uses layer git
const gitPath = process.env.AWS_LAMBDA_FUNCTION_NAME ? '/opt/bin/git' : 'git'
const cloneCmd = `${gitPath} clone --depth 1 "${repoUrl}" "${tempDir}"`
```

## Benefits

✅ Real `git clone` in Lambda
✅ Faster than GitHub API for large repos  
✅ No API rate limits
✅ Works with private repos (with credentials)
✅ Parallel processing on actual files
