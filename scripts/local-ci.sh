#!/bin/bash
set -e

echo "🚀 Starting Local CI/CD Pipeline Simulation..."

# 1. Linting
echo "----------------------------------------"
echo "📝 Step 1: Linting"
bun run lint
echo "✅ Linting passed!"

# 2. Unit Tests
echo "----------------------------------------"
echo "🧪 Step 2: Unit Tests"
bun test
echo "✅ Tests passed!"

# 3. Docker Build
echo "----------------------------------------"
echo "🐳 Step 3: Docker Build"
echo "Building image: pdf-to-image:local..."
docker build -t pdf-to-image:local .
echo "✅ Docker build passed!"

# 4. Security Scan (Trivy via Docker)
echo "----------------------------------------"
echo "🛡️ Step 4: Security Scan (Trivy)"
echo "Pulling Trivy scanner..."
docker pull aquasec/trivy:latest > /dev/null

echo "Scanning local image for HIGH/CRITICAL vulnerabilities..."
# We map the docker socket so Trivy can see the local image we just built
docker run --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy:latest image \
    --severity HIGH,CRITICAL \
    --exit-code 1 \
    --ignore-unfixed \
    pdf-to-image:local

echo "✅ Security scan passed!"

echo "----------------------------------------"
echo "🎉 ALL LOCAL CHECKS PASSED!"
echo "You are ready to push to GitHub."
