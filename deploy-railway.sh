#!/bin/bash

echo "🚀 Deploying PDF-to-Image service to Railway..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run this from your project root."
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 You have uncommitted changes. Committing them now..."
    git add .
    git commit -m "Deploy to Railway: $(date)"
fi

# Push to main branch
echo "📤 Pushing to main branch..."
git push origin main

echo "✅ Code pushed to GitHub!"
echo ""
echo "🎯 Next steps:"
echo "1. Go to https://railway.app"
echo "2. Create a new project and connect your GitHub repository"
echo "3. Set the following environment variables in Railway dashboard:"
echo "   - NODE_ENV=production"
echo "   - SENTRY_DSN=your_sentry_dsn"
echo "   - (Add GCS variables if using Google Cloud Storage)"
echo "4. Railway will automatically detect the Dockerfile and deploy"
echo ""
echo "📊 Monitor your deployment at: https://railway.app/dashboard"
