import { Storage } from "@google-cloud/storage";
import type { Request } from "express";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
import { Readable } from "stream";

// Enhanced logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(
      chalk.blue(`[STORAGE] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  warn: (message: string, data?: any) => {
    console.log(
      chalk.yellow(`[STORAGE] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  error: (message: string, error?: any) => {
    console.log(chalk.red(`[STORAGE] ${new Date().toISOString()}: ${message}`));
    if (error) {
      console.log(chalk.red(error.stack || error.message || error));
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
      console.log(
        chalk.magenta(`[STORAGE] ${new Date().toISOString()}: ${message}`)
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  },
  success: (message: string, data?: any) => {
    console.log(
      chalk.green(`[STORAGE] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
};

const gcsCredentialsString = process.env.GCS_SERVICE_ACCOUNT_KEY;

// Helper function to safely parse JSON credentials
const parseCredentials = (credentialsString: string) => {
  try {
    // Replace single quotes with double quotes for valid JSON
    const validJsonString = credentialsString.replace(/'/g, '"');
    return JSON.parse(validJsonString);
  } catch (error) {
    log.error("Failed to parse GCS credentials", error);
    return undefined;
  }
};

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILE,
  // If using service account credentials from environment variable
  credentials: process.env.GCS_CREDENTIALS
    ? parseCredentials(process.env.GCS_CREDENTIALS)
    : gcsCredentialsString
    ? parseCredentials(gcsCredentialsString)
    : undefined,
});

const bucketName = process.env.GCS_BUCKET_NAME || "pdf-to-image-converter";

// Ensure the bucket exists
async function ensureBucket(): Promise<void> {
  try {
    const [exists] = await storage.bucket(bucketName).exists();
    if (!exists) {
      log.warn(
        `Bucket ${bucketName} does not exist. Please create it manually.`
      );
    } else {
      log.debug(`✅ Bucket ${bucketName} exists`);
    }
  } catch (error) {
    log.error(`❌ Error checking bucket existence`, error);
    throw error;
  }
}

// Generate a signed URL for temporary access
async function getSignedUrl(
  filename: string,
  expiresInMinutes = 60
): Promise<string> {
  try {
    const [url] = await storage
      .bucket(bucketName)
      .file(filename)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

    return url;
  } catch (error) {
    log.error(`❌ Error generating signed URL for ${filename}`, error);
    throw error;
  }
}

// Upload a file to GCS
async function uploadFile(
  filePath: string,
  destination: string,
  metadata: Record<string, string> = {}
): Promise<string> {
  try {
    log.debug(`📤 Uploading file to GCS: ${filePath} -> ${destination}`);

    await storage.bucket(bucketName).upload(filePath, {
      destination,
      metadata: {
        cacheControl: "public, max-age=31536000",
        ...metadata,
      },
    });

    log.success(
      `✅ File uploaded successfully to gs://${bucketName}/${destination}`
    );
    return `gs://${bucketName}/${destination}`;
  } catch (error) {
    log.error(`❌ Error uploading file to GCS`, error);
    throw error;
  }
}

// Upload a buffer to GCS
async function uploadBuffer(
  buffer: Buffer,
  destination: string,
  metadata: Record<string, string> = {}
): Promise<string> {
  try {
    log.debug(`📤 Uploading buffer to GCS: ${destination}`);

    const file = storage.bucket(bucketName).file(destination);
    await file.save(buffer, {
      metadata: {
        cacheControl: "public, max-age=31536000",
        ...metadata,
      },
    });

    log.success(
      `✅ Buffer uploaded successfully to gs://${bucketName}/${destination}`
    );
    return `gs://${bucketName}/${destination}`;
  } catch (error) {
    log.error(`❌ Error uploading buffer to GCS`, error);
    throw error;
  }
}

// Download a file from GCS
async function downloadFile(
  source: string,
  destination: string
): Promise<string> {
  try {
    log.debug(`📥 Downloading file from GCS: ${source} -> ${destination}`);

    await storage.bucket(bucketName).file(source).download({ destination });

    log.success(`✅ File downloaded successfully to ${destination}`);
    return destination;
  } catch (error) {
    log.error(`❌ Error downloading file from GCS`, error);
    throw error;
  }
}

// Delete a file from GCS
async function deleteFile(filename: string): Promise<void> {
  try {
    log.debug(`🗑️ Deleting file from GCS: ${filename}`);

    await storage.bucket(bucketName).file(filename).delete();

    log.success(`✅ File deleted successfully: ${filename}`);
  } catch (error) {
    log.error(`❌ Error deleting file from GCS`, error);
    throw error;
  }
}

// List files in a directory
async function listFiles(prefix: string): Promise<string[]> {
  try {
    log.debug(`📋 Listing files in GCS with prefix: ${prefix}`);

    const [files] = await storage.bucket(bucketName).getFiles({ prefix });
    const fileNames = files.map((file) => file.name);

    log.debug(`✅ Found ${fileNames.length} files`);
    return fileNames;
  } catch (error) {
    log.error(`❌ Error listing files in GCS`, error);
    throw error;
  }
}

// Clean up old files (files older than maxAgeMinutes)
async function cleanupOldFiles(
  prefix: string,
  maxAgeMinutes = 60
): Promise<number> {
  try {
    log.info(`🧹 Starting GCS cleanup for prefix: ${prefix}`);

    const [files] = await storage.bucket(bucketName).getFiles({ prefix });
    const now = new Date();
    let deletedCount = 0;

    for (const file of files) {
      const metadata = await file.getMetadata();
      const createTime = new Date(metadata[0].timeCreated || Date.now());
      const ageMinutes = (now.getTime() - createTime.getTime()) / (60 * 1000);

      if (ageMinutes > maxAgeMinutes) {
        await file.delete();
        deletedCount++;
        log.debug(
          `🗑️ Deleted old file: ${file.name} (age: ${Math.round(
            ageMinutes
          )}min)`
        );
      }
    }

    log.success(`✅ GCS cleanup completed, deleted ${deletedCount} files`);
    return deletedCount;
  } catch (error) {
    log.error(`❌ Error during GCS cleanup`, error);
    throw error;
  }
}

// Create a multer storage engine for GCS
function createGCSMulterStorage() {
  return {
    _handleFile: (req: Request, file: Express.Multer.File, cb: Function) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const filename = `uploads/${uniqueSuffix}-${file.originalname}`;

      const blob = storage.bucket(bucketName).file(filename);
      const stream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalname: file.originalname,
            requestId: req.requestId,
          },
        },
        resumable: false,
      });

      file.stream
        .pipe(stream)
        .on("error", (err) => {
          log.error(`❌ Error uploading file to GCS`, err);
          cb(err);
        })
        .on("finish", () => {
          log.success(`✅ File uploaded successfully to GCS: ${filename}`);
          cb(null, {
            path: `gs://${bucketName}/${filename}`,
            filename: filename,
            gcsObject: filename,
          });
        });
    },

    _removeFile: (
      req: Request,
      file: Express.Multer.File & { gcsObject?: string },
      cb: Function
    ) => {
      if (file.gcsObject) {
        storage
          .bucket(bucketName)
          .file(file.gcsObject)
          .delete()
          .then(() => {
            log.debug(`🗑️ Deleted file from GCS: ${file.gcsObject}`);
            cb(null);
          })
          .catch((err) => {
            log.error(`❌ Error deleting file from GCS`, err);
            cb(err);
          });
      } else {
        cb(null);
      }
    },
  };
}

export {
  ensureBucket,
  getSignedUrl,
  uploadFile,
  uploadBuffer,
  downloadFile,
  deleteFile,
  listFiles,
  cleanupOldFiles,
  createGCSMulterStorage,
  bucketName,
  storage, // Export the storage object for direct access in tests
};
