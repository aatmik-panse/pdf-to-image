#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== PDF-to-Image GCS Integration Test ===${NC}"
echo -e "${BLUE}This script will test the Google Cloud Storage integration${NC}"

# Check if gcs-key.json exists
if [ ! -f "gcs-key.json" ]; then
  echo -e "${RED}Error: gcs-key.json not found${NC}"
  echo "Please make sure your GCS service account key file exists in the project root"
  exit 1
fi

# Set environment variables for testing
export GCS_PROJECT_ID="tokyo-portal-459007-n8"
export GCS_BUCKET_NAME="gradonix"
export GCS_KEY_FILE="gcs-key.json"
export GOOGLE_APPLICATION_CREDENTIALS="gcs-key.json"

# Create test-files directory if it doesn't exist
mkdir -p test-files/output

echo -e "${BLUE}Running GCS integration tests...${NC}"
bun run test-gcs.js

# Check exit code
if [ $? -eq 0 ]; then
  echo -e "${GREEN}All tests completed successfully!${NC}"
else
  echo -e "${RED}Tests failed. Please check the logs above for details.${NC}"
fi
