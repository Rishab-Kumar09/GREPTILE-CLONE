# AWS Deployment (Amplify + RDS PostgreSQL)

This app is Next.js 14 (App Router) with API routes. We deploy on AWS Amplify and use Amazon RDS (PostgreSQL).

## 0) Prereqs
- GitHub repo connected
- AWS account (IAM admin)
- Region: pick one (e.g., us-east-1)
- Secrets: OPENAI_API_KEY (required), optional GITHUB_TOKEN

## 1) Create RDS PostgreSQL
- RDS → Create database → Standard create
- Engine: PostgreSQL 16.x, Template: Free tier
- DB identifier: `my-nextjs-db`
- Master user: `admin`, set password
- Instance class: `db.t4g.micro`
- Storage: 20 GiB gp3
- Connectivity: Default VPC, Subnet group default, Public access Yes (dev), Port 5432
- Security group: create `nextjs-db-sg`, allow inbound PostgreSQL 5432 from your IP (or restrict later)
- Additional config: Initial database name `mydatabase`
- Create and wait. Copy the Endpoint from the DB page.
- Connection string example:
  `postgresql://admin:<PASSWORD>@<ENDPOINT>:5432/mydatabase?schema=public`

## 2) Configure the app (DB via Prisma)
- Prisma already included. Schema at `prisma/schema.prisma`.
- Environment variable to set: `DATABASE_URL` with the connection string above.
- Local test (optional):
  ```bash
  npm ci
  npx prisma generate
  npx prisma migrate dev --name init
  npm run dev
  ```

## 3) Deploy with Amplify
- Amplify → Host web app → Connect GitHub → select repo/branch
- Build settings: use `amplify.yml` in repo (runs prisma generate + migrate deploy)
- Environment variables (Amplify → App settings → Environment variables):
  - `DATABASE_URL=postgresql://admin:...@<endpoint>:5432/mydatabase?schema=public`
  - `OPENAI_API_KEY=...`
  - `GITHUB_TOKEN=...` (optional)
  - `NODE_ENV=production`
- Save and deploy

## 4) Verify
- Open deployed URL
- Health check: GET `/api/health/db` → `{ ok: true }`
- AI key check: `/api/ai/verify`

## 5) Troubleshooting
- DB timeouts: open RDS security group and allow inbound 5432 from 0.0.0.0/0 temporarily (dev only), then lock down
- Prisma errors: ensure `DATABASE_URL` is set, and `npx prisma migrate deploy` runs (Amplify logs)
- OpenAI errors: set `OPENAI_API_KEY` in Amplify

## 6) Next steps (optional)
- Make RDS private and access via VPC integration
- Add NextAuth + Stripe with env vars
- Add custom domain in Amplify → Domain management
- Monitor costs in AWS Cost Explorer 