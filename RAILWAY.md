# Railway Deployment Guide

## Pre-deployment Steps

1. **Environment Variables to Set in Railway Dashboard:**

   ```
   NODE_ENV=production
   PORT=3000
   SENTRY_DSN=your_sentry_dsn_here

   # Google Cloud Storage (if using)
   GOOGLE_CLOUD_PROJECT_ID=your_project_id
   GOOGLE_CLOUD_BUCKET_NAME=your_bucket_name
   GOOGLE_APPLICATION_CREDENTIALS=/app/gcs-key.json
   ```

2. **Railway Project Setup:**
   - Connect your GitHub repository to Railway
   - Railway will automatically detect the Dockerfile
   - Set the start command to: `bun run start`

## Deployment Process

1. **Push your code to GitHub**

   ```bash
   git add .
   git commit -m "Add Railway deployment configuration"
   git push origin main
   ```

2. **Deploy to Railway:**
   - Go to [Railway.app](https://railway.app)
   - Create a new project
   - Connect your GitHub repository
   - Railway will automatically build and deploy

## Key Differences from Fly.io

1. **Port Configuration:** Railway automatically assigns a port via the `PORT` environment variable
2. **Health Checks:** Railway uses the `/health` endpoint for health monitoring
3. **Volume Storage:** Railway provides ephemeral storage, consider using external storage for production
4. **Environment Variables:** Set via Railway dashboard or CLI
5. **Auto-scaling:** Railway handles scaling automatically based on traffic

## Railway CLI Commands (Optional)

Install Railway CLI:

```bash
npm install -g @railway/cli
```

Deploy via CLI:

```bash
railway login
railway link
railway up
```

## Memory and Resource Configuration

Railway automatically allocates resources, but you can:

- Monitor usage in the Railway dashboard
- Upgrade to higher resource plans if needed
- Set resource limits via Railway dashboard

## Monitoring

- Railway provides built-in logs and metrics
- Use the `/health` endpoint for external monitoring
- Sentry integration for error tracking and performance monitoring
