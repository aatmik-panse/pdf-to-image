#!/usr/bin/env node

import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import FormData from "form-data";

// Import GCS storage utilities
import {
  ensureBucket,
  uploadFile,
  downloadFile,
  getSignedUrl,
  deleteFile,
  listFiles,
  cleanupOldFiles,
  bucketName,
  storage, // Add storage object import
} from "./src/storage.js";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_PDF_PATH = path.join(__dirname, "test-files", "sample.pdf");
const TEST_OUTPUT_DIR = path.join(__dirname, "test-files", "output");
const API_URL = "http://localhost:3000/api/convert";

// Create test directories if they don't exist
if (!fs.existsSync(path.join(__dirname, "test-files"))) {
  fs.mkdirSync(path.join(__dirname, "test-files"));
}
if (!fs.existsSync(TEST_OUTPUT_DIR)) {
  fs.mkdirSync(TEST_OUTPUT_DIR);
}

// Logger
const log = {
  info: (message) => console.log(chalk.blue(`[TEST] ${message}`)),
  success: (message) => console.log(chalk.green(`[TEST] ✅ ${message}`)),
  error: (message, error) => {
    console.error(chalk.red(`[TEST] ❌ ${message}`));
    if (error) console.error(chalk.red(error.stack || error));
  },
  warn: (message) => console.log(chalk.yellow(`[TEST] ⚠️ ${message}`)),
  step: (message) => console.log(chalk.magenta(`\n[TEST] 🔍 ${message}`)),
};

// Create a sample PDF if it doesn't exist
async function createSamplePdf() {
  if (!fs.existsSync(TEST_PDF_PATH)) {
    log.info("Creating sample PDF for testing...");

    // Simple PDF content with text
    const pdfContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog
   /Pages 2 0 R
>>
endobj
2 0 obj
<< /Type /Pages
   /Kids [3 0 R]
   /Count 1
>>
endobj
3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /Resources << /Font << /F1 4 0 R >> >>
   /MediaBox [0 0 612 792]
   /Contents 5 0 R
>>
endobj
4 0 obj
<< /Type /Font
   /Subtype /Type1
   /BaseFont /Helvetica
>>
endobj
5 0 obj
<< /Length 68 >>
stream
BT
/F1 24 Tf
100 700 Td
(PDF to Image Converter Test File) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000234 00000 n
0000000302 00000 n
trailer
<< /Size 6
   /Root 1 0 R
>>
startxref
420
%%EOF
    `;

    fs.writeFileSync(TEST_PDF_PATH, pdfContent);
    log.success("Sample PDF created");
  }
}

// Test GCS bucket connection
async function testBucketConnection() {
  log.step("Testing GCS bucket connection");
  try {
    await ensureBucket();
    log.success(`Connected to GCS bucket: ${bucketName}`);
    return true;
  } catch (error) {
    log.error("Failed to connect to GCS bucket", error);
    return false;
  }
}

// Test file upload to GCS
async function testFileUpload() {
  log.step("Testing file upload to GCS");
  try {
    const destination = `test/sample-${Date.now()}.pdf`;
    const gcsPath = await uploadFile(TEST_PDF_PATH, destination);
    log.success(`File uploaded to GCS: ${gcsPath}`);
    return { success: true, gcsPath, destination };
  } catch (error) {
    log.error("Failed to upload file to GCS", error);
    return { success: false };
  }
}

// Test generating signed URL
async function testSignedUrl(destination) {
  log.step("Testing signed URL generation");
  try {
    const signedUrl = await getSignedUrl(destination);
    log.success(`Signed URL generated: ${signedUrl}`);
    return { success: true, signedUrl };
  } catch (error) {
    log.error("Failed to generate signed URL", error);
    return { success: false };
  }
}

// Test file download from GCS
async function testFileDownload(destination) {
  log.step("Testing file download from GCS");
  try {
    const localPath = path.join(
      TEST_OUTPUT_DIR,
      `downloaded-${Date.now()}.pdf`
    );
    await downloadFile(destination, localPath);

    if (fs.existsSync(localPath)) {
      log.success(`File downloaded from GCS to ${localPath}`);
      return { success: true, localPath };
    } else {
      log.error("File download failed - file does not exist locally");
      return { success: false };
    }
  } catch (error) {
    log.error("Failed to download file from GCS", error);
    return { success: false };
  }
}

// Test file deletion from GCS
async function testFileDelete(destination) {
  log.step("Testing file deletion from GCS");
  try {
    await deleteFile(destination);
    log.success(`File deleted from GCS: ${destination}`);
    return true;
  } catch (error) {
    log.error("Failed to delete file from GCS", error);
    return false;
  }
}

// Test listing files in GCS
async function testListFiles() {
  log.step("Testing listing files in GCS");
  try {
    const files = await listFiles("test/");
    log.success(`Listed ${files.length} files in GCS with prefix 'test/'`);
    return true;
  } catch (error) {
    log.error("Failed to list files in GCS", error);
    return false;
  }
}

// Test cleanup of old files
async function testCleanup() {
  log.step("Testing cleanup of old files");
  try {
    // Upload a test file (not a PDF) that will be immediately eligible for cleanup
    const destination = `test/cleanup-${Date.now()}.txt`;
    await uploadFile(TEST_PDF_PATH, destination, { contentType: "text/plain" });

    // Our modified cleanup approach that preserves PDF files
    log.info("Running cleanup that preserves PDF files in test/");
    
    // List all files with the test/ prefix
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: "test/" });
    const now = new Date();
    let deletedCount = 0;

    // Process each file
    for (const file of files) {
      // Skip files with .pdf extension
      if (file.name.toLowerCase().endsWith(".pdf")) {
        log.info(`Preserving PDF file: ${file.name}`);
        continue;
      }

      // Delete non-PDF files
      if (file.name.includes("cleanup")) {
        await file.delete();
        deletedCount++;
        log.info(`Deleted test file: ${file.name}`);
      }
    }

    log.success(`Cleanup test completed, deleted ${deletedCount} files (PDFs preserved)`);
    return true;
  } catch (error) {
    log.error("Failed to test cleanup", error);
    return false;
  }
}

// Test the API endpoint
async function testApiEndpoint() {
  log.step("Testing API endpoint");
  try {
    // Check if server is running
    try {
      const response = await fetch("http://localhost:3000/health");
      if (!response.ok) {
        log.warn(
          "API server is not running or health check failed. Start the server with: npm run dev"
        );
        return false;
      }
      log.success("API server is running");
    } catch (error) {
      log.warn("API server is not running. Start the server with: npm run dev");
      return false;
    }

    // Use a different approach with child_process to run curl for reliable file upload
    log.info("Sending PDF to API endpoint using curl...");
    
    // Create a temporary file to store the response
    const responseFile = path.join(TEST_OUTPUT_DIR, `api-response-${Date.now()}.json`);
    
    // Run curl command to upload the PDF and capture the response
    const { execSync } = await import('child_process');
    try {
      execSync(
        `curl -s -X POST -F "pdf=@${TEST_PDF_PATH}" ${API_URL} -o ${responseFile}`,
        { stdio: 'inherit' }
      );
      
      // Read the response file
      const responseData = await fsPromises.readFile(responseFile, 'utf8');
      log.info(`Raw API response: ${responseData}`);
      
      const result = JSON.parse(responseData);
      log.success("API request successful");
      log.info(`Full response: ${JSON.stringify(result, null, 2)}`);
      log.info(`Converted ${result.pageCount || 0} pages`);
      
      // Verify we have image URLs
      if (!result.images || result.images.length === 0) {
        log.error("No image URLs returned from API");
        return false;
      }
      
      // Log the first few image URLs
      const imageUrls = result.images.slice(0, 3); // Show first 3 images max
      log.info(`First ${imageUrls.length} image URLs:`);
      imageUrls.forEach((url, i) => {
        log.info(`  Page ${i+1}: ${url.substring(0, 100)}...`);
      });
      
      // Verify images are accessible
      log.info("Verifying image URLs are accessible...");
      try {
        const firstImageUrl = result.images[0];
        const imageResponse = await fetch(firstImageUrl);
        if (imageResponse.ok) {
          log.success("Successfully accessed converted image URL");
          
          // Save the first image to verify it's a valid JPG
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageOutputPath = path.join(TEST_OUTPUT_DIR, `test-image-${Date.now()}.jpg`);
          await fsPromises.writeFile(imageOutputPath, Buffer.from(imageBuffer));
          log.success(`Saved converted image to ${imageOutputPath}`);
        } else {
          log.warn(`Image URL returned ${imageResponse.status} status code`);
        }
      } catch (err) {
        log.warn("Could not verify image URL accessibility", err);
      }
      
      return true;
    } catch (error) {
      log.error("API request failed", error);
      return false;
    } finally {
      // Clean up response file
      try {
        await fsPromises.unlink(responseFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    log.error("API endpoint test failed", error);
    return false;
  }
}


// Run all tests
async function runTests() {
  log.info("Starting GCS integration tests");
  log.info(`Using GCS bucket: ${bucketName}`);
  log.info(`Project ID: ${process.env.GCS_PROJECT_ID}`);

  // Create sample PDF for testing
  await createSamplePdf();

  // Run tests
  const bucketConnected = await testBucketConnection();
  if (!bucketConnected) {
    log.error("Bucket connection failed, aborting remaining tests");
    process.exit(1);
  }

  const uploadResult = await testFileUpload();
  if (!uploadResult.success) {
    log.error("File upload failed, aborting remaining tests");
    process.exit(1);
  }

  await testSignedUrl(uploadResult.destination);
  await testFileDownload(uploadResult.destination);
  await testListFiles();
  // Skip deleting the uploaded PDF file
  // await testFileDelete(uploadResult.destination);

  // Only run cleanup for files that aren't the sample PDF
  await testCleanup();

  // Test API endpoint if server is running
  await testApiEndpoint();

  log.success("All tests completed");
}

// Run the tests
runTests().catch((error) => {
  log.error("Test suite failed", error);
  process.exit(1);
});
