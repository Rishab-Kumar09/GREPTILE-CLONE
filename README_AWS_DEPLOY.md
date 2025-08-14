# AWS Deployment Guide - Greptile Clone

This guide shows how to deploy the Greptile Clone application on AWS using **industry-standard automated post-deployment migration** (the same approach used by Stripe, GitHub, and Shopify).

## Prerequisites

- AWS Account
- GitHub repository with your code
- OpenAI API key

## Step 1: Create AWS RDS PostgreSQL Database

1. Go to AWS Console → RDS
2. Click "Create database"
3. Choose "PostgreSQL"
4. Select "Free tier" (or your preferred tier)
5. Configure:
   - **DB instance identifier**: `greptile-clone-db`
   - **Master username**: `admin`
   - **Master password**: (save this securely)
   - **Initial database name**: `greptile_clone_db`

6. **Important**: In "Connectivity", set:
   - **VPC security group**: Create new → `greptile-clone-dev-sg`
   - **Public access**: Yes (for development)

7. Click "Create database"
8. Wait for database to be "Available"

## Step 2: Configure Database Security

1. Go to VPC → Security Groups
2. Find your security group (`greptile-clone-dev-sg`)
3. Edit inbound rules → Add rule:
   - **Type**: PostgreSQL
   - **Port**: 5432
   - **Source**: 0.0.0.0/0 (for development - restrict in production)

## Step 3: Deploy to AWS Amplify

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your GitHub repository
4. Configure build settings (use default)
5. Click "Save and deploy"

## Step 4: Add Environment Variables

In Amplify Console → App settings → Environment variables, add:

```
DATABASE_URL = postgresql://admin:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/greptile_clone_db
OPENAI_API_KEY = your-openai-api-key
MIGRATION_SECRET = your-secure-secret-key
NODE_ENV = production
```

Replace:
- `YOUR_PASSWORD` with your RDS master password
- `YOUR_RDS_ENDPOINT` with your RDS endpoint (from RDS console)
- `your-openai-api-key` with your actual OpenAI API key
- `your-secure-secret-key` with a secure random string

## Step 5: Deploy Using Automated Migration

### Option A: Standard Deployment (Recommended)
```bash
npm run deploy
```

### Option B: Safe Deployment (Production)
```bash
npm run deploy:safe
```

### Option C: Production-Grade (With Health Checks)
```bash
npm run deploy:production
```

## How It Works

1. **Code Push**: Your code is pushed to GitHub
2. **Amplify Build**: AWS Amplify automatically builds and deploys your app
3. **Stabilization Wait**: Script waits 2-3 minutes for deployment to stabilize
4. **Automated Migration**: Database schema is created/updated via API call
5. **Health Check**: System verifies everything is working

This follows the same pattern used by companies like Stripe, GitHub, and Shopify.

## Verification

After deployment completes, verify:

1. **App**: Visit your Amplify app URL
2. **Database**: Check `/api/health/db` endpoint
3. **Features**: Test repository analysis and AI chat

## Troubleshooting

### If deployment fails:
```bash
# Check Amplify build logs in AWS Console
# Then try manual migration:
npm run migrate:trigger
```

### If database connection fails:
1. Check RDS security group allows connections
2. Verify DATABASE_URL is correct in environment variables
3. Ensure RDS instance is "Available"

## Production Considerations

1. **Security Groups**: Restrict database access to specific IPs
2. **SSL**: Enable SSL for database connections
3. **Monitoring**: Set up CloudWatch monitoring
4. **Backups**: Configure automated RDS backups

## Cost Optimization

- **RDS**: Use `db.t3.micro` for development
- **Amplify**: Free tier covers most development needs
- **Monitor**: Check AWS billing dashboard regularly

This setup provides a production-ready deployment following industry best practices! 