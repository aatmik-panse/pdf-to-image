import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { convertPdfToImages } from "./src/converter";
import { validatePdfFile } from "./src/utils";
import chalk from "chalk";
import {
  ensureBucket,
  createGCSMulterStorage,
  uploadFile,
  downloadFile,
  deleteFile,
  cleanupOldFiles,
  getSignedUrl,
  bucketName,
} from "./src/storage";

// Enhanced logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(chalk.blue(`[INFO] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  warn: (message: string, data?: any) => {
    console.log(chalk.yellow(`[WARN] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  error: (message: string, error?: any) => {
    console.log(chalk.red(`[ERROR] ${new Date().toISOString()}: ${message}`));
    if (error) {
      console.log(chalk.red(error.stack || error.message || error));
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
      console.log(
        chalk.magenta(`[DEBUG] ${new Date().toISOString()}: ${message}`)
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  },
  success: (message: string, data?: any) => {
    console.log(
      chalk.green(`[SUCCESS] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
};

// Request ID generator
const generateRequestId = () => Math.random().toString(36).substr(2, 9);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;

  log.info(`🔵 Incoming request`, {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get("user-agent"),
    ip: req.ip,
    headers: req.headers,
  });

  // Log response when finished
  const originalSend = res.send;
  res.send = function (data) {
    log.info(`🔴 Response sent`, {
      requestId,
      statusCode: res.statusCode,
      contentLength: data?.length || 0,
    });
    return originalSend.call(this, data);
  };

  next();
});

// Add requestId to express request type and extend Multer File type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }

    namespace Multer {
      interface File {
        gcsObject?: string;
      }
    }
  }
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "blob:"],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Compression middleware
app.use(compression());

// Rate limiting - DISABLED for production use
// Uncomment below if you want to enable rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // limit each IP to 10 requests per windowMs
//   message: {
//     error: "Too many requests from this IP, please try again later.",
//   },
// });
// app.use("/api/", limiter);

// Body parsing middleware
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Configure multer for file uploads
// Initialize GCS storage for multer
const storage = createGCSMulterStorage();

// Create temp directory for processing
async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), "pdf-to-image-" + Date.now());
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    log.debug(`🔍 File filter check`, {
      requestId: req.requestId,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    if (file.mimetype === "application/pdf") {
      log.debug(`✅ PDF file accepted: ${file.originalname}`, {
        requestId: req.requestId,
      });
      cb(null, true);
    } else {
      log.warn(`❌ Invalid file type rejected: ${file.mimetype}`, {
        requestId: req.requestId,
        filename: file.originalname,
      });
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Static files - API only, no frontend
app.use("/output", express.static(path.join(__dirname, "data", "output")));

// Health check endpoint

app.get("/health", (req, res) => {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV || "development",
  };

  log.info(`💚 Health check requested`, {
    requestId: req.requestId,
    ...healthData,
  });
  res.json(healthData);
});

// Memory monitoring endpoint for debugging
app.get("/debug/memory", (req, res) => {
  const memUsage = process.memoryUsage();

  // Force garbage collection if available for testing
  if (global.gc && req.query.gc === "true") {
    global.gc();
    log.info(`🧹 Manual garbage collection triggered`, {
      requestId: req.requestId,
    });
  }

  const memUsageAfterGC = global.gc ? process.memoryUsage() : memUsage;

  const memoryData = {
    beforeGC: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    afterGC: global.gc
      ? {
          rss: `${Math.round(memUsageAfterGC.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memUsageAfterGC.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsageAfterGC.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsageAfterGC.external / 1024 / 1024)}MB`,
        }
      : null,
    gcAvailable: !!global.gc,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  };

  log.debug(`🔍 Memory debug info requested`, {
    requestId: req.requestId,
    ...memoryData,
  });

  res.json(memoryData);
});
// Handle malformed health check requests (common with monitoring services)
app.get("/health/health", (req, res) => {
  log.warn(`🔄 Malformed health check request redirected`, {
    requestId: req.requestId,
    originalUrl: req.originalUrl,
    userAgent: req.get("user-agent"),
  });
  res.redirect(301, "/health");
});

// Handle malformed API requests
app.post("/health/api/convert", (req, res) => {
  log.warn(`🔄 Malformed API request redirected`, {
    requestId: req.requestId,
    originalUrl: req.originalUrl,
    userAgent: req.get("user-agent"),
  });
  res.redirect(307, "/api/convert"); // 307 preserves POST method
});

// API endpoint for PDF conversion
app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  const requestId = req.requestId;
  const startTime = Date.now();
  let tempDir = null;
  let tempPdfPath = null;

  try {
    // Initialize GCS bucket
    await ensureBucket();

    // Log memory usage before conversion for monitoring
    const memUsageBefore = process.memoryUsage();
    log.debug(`📊 Memory usage before conversion`, {
      requestId,
      memory: {
        rss: `${Math.round(memUsageBefore.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsageBefore.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsageBefore.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsageBefore.external / 1024 / 1024)}MB`,
      },
    });

    log.info(`🚀 PDF conversion started`, {
      requestId,
      body: req.body,
      fileInfo: req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            gcsObject: req.file.gcsObject,
          }
        : null,
    });

    if (!req.file || !req.file.gcsObject) {
      log.warn(`❌ No PDF file uploaded`, { requestId });
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const { dpi = "300", quality = "90", pages = "all" } = req.body;
    const conversionOptions = {
      dpi: parseInt(dpi),
      quality: parseInt(quality),
      pages,
    };

    log.debug(`⚙️ Conversion options`, { requestId, ...conversionOptions });

    // Create temporary directory for processing
    tempDir = await createTempDir();
    tempPdfPath = path.join(tempDir, "input.pdf");

    // Download the PDF from GCS to temp directory
    log.debug(`📥 Downloading PDF from GCS for processing`, {
      requestId,
      gcsObject: req.file.gcsObject,
      tempPath: tempPdfPath,
    });

    await downloadFile(req.file.gcsObject, tempPdfPath);

    // Create output directory in temp folder
    const outputDir = path.join(tempDir, "output");
    await fs.mkdir(outputDir, { recursive: true });

    log.debug(`📁 Temp output directory: ${outputDir}`, { requestId });

    // Validate PDF file
    log.debug(`🔍 Starting PDF validation`, {
      requestId,
      filePath: tempPdfPath,
    });
    await validatePdfFile(tempPdfPath);
    log.success(`✅ PDF validation completed`, { requestId });

    // Convert PDF to images
    log.info(`🔄 Starting PDF to image conversion`, {
      requestId,
      filePath: tempPdfPath,
    });
    const result = await convertPdfToImages(tempPdfPath, {
      outputDir,
      ...conversionOptions,
    });
    log.success(`✅ PDF conversion completed`, { requestId, result });

    // Get list of generated images
    log.debug(`📋 Reading generated images`, {
      requestId,
      outputDir: result.outputDir,
    });
    const imageFiles = await fs.readdir(result.outputDir);

    // Upload images to GCS
    const gcsOutputPrefix = `output/conversion-${Date.now()}`;
    const uploadPromises = imageFiles
      .filter((file) => file.endsWith(".jpg"))
      .map(async (file) => {
        const localPath = path.join(result.outputDir, file);
        const gcsPath = `${gcsOutputPrefix}/${file}`;
        await uploadFile(localPath, gcsPath, {
          contentType: "image/jpeg",
          metadata: JSON.stringify({ requestId }),
        });
        return file;
      });

    await Promise.all(uploadPromises);
    log.success(`✅ Uploaded ${imageFiles.length} images to GCS`, {
      requestId,
    });

    // Generate signed URLs for the images
    const signedUrlPromises = imageFiles
      .filter((file) => file.endsWith(".jpg"))
      .map(async (file) => {
        const gcsPath = `${gcsOutputPrefix}/${file}`;
        const url = await getSignedUrl(gcsPath, 60); // 60 minutes expiration
        return {
          filename: file,
          url: url,
          path: `gs://${bucketName}/${gcsPath}`,
        };
      });

    const images = await Promise.all(signedUrlPromises);

    log.debug(`📸 Generated image URLs`, {
      requestId,
      imageCount: images.length,
    });

    // Clean up GCS uploaded PDF file
    log.debug(`🧹 Cleaning up uploaded PDF from GCS`, {
      requestId,
      gcsObject: req.file.gcsObject,
    });
    await deleteFile(req.file.gcsObject);
    log.success(`✅ GCS cleanup completed`, { requestId });

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      log.debug(`🧹 Removed temporary directory: ${tempDir}`, { requestId });
    } catch (err) {
      log.warn(`⚠️ Failed to remove temporary directory: ${tempDir}`, {
        requestId,
        error: err,
      });
    }

    // 🚀 MEMORY OPTIMIZATION: Force garbage collection after successful conversion
    if (global.gc) {
      global.gc();
      log.debug(`🧹 Forced garbage collection after successful conversion`, {
        requestId,
      });
    }

    // Log memory usage after conversion for monitoring
    const memUsageAfter = process.memoryUsage();
    log.debug(`📊 Memory usage after conversion`, {
      requestId,
      memory: {
        rss: `${Math.round(memUsageAfter.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsageAfter.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsageAfter.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsageAfter.external / 1024 / 1024)}MB`,
      },
    });

    const processingTime = Date.now() - startTime;
    const response = {
      success: true,
      message: "PDF converted successfully",
      processingTime: `${processingTime}ms`,
      data: {
        outputDir: result.outputDir,
        imageCount: result.imageCount,
        pagesConverted: result.pagesConverted,
        images,
      },
    };

    log.success(`🎉 Conversion request completed successfully`, {
      requestId,
      processingTime,
      imageCount: result.imageCount,
      pagesConverted: result.pagesConverted.length,
    });

    res.json(response);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    log.error(`💥 Conversion error occurred`, {
      requestId,
      processingTime,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Clean up uploaded file if it exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
        log.debug(`🧹 Uploaded file cleaned up after error`, {
          requestId,
          filePath: req.file.path,
        });
      } catch (unlinkError) {
        log.error(`❌ Error cleaning up uploaded file`, {
          requestId,
          unlinkError,
        });
      }
    }

    // 🚨 CRITICAL FIX: Clean up temp directory in error cases
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        log.debug(
          `🧹 Emergency cleanup: Removed temporary directory after error: ${tempDir}`,
          { requestId }
        );
      } catch (cleanupError) {
        log.error(
          `❌ Failed to cleanup temp directory after error: ${tempDir}`,
          {
            requestId,
            cleanupError,
          }
        );
      }
    }

    // Clean up GCS uploaded file if it exists
    if (req.file?.gcsObject) {
      try {
        await deleteFile(req.file.gcsObject);
        log.debug(`🧹 GCS file cleaned up after error`, {
          requestId,
          gcsObject: req.file.gcsObject,
        });
      } catch (gcsCleanupError) {
        log.error(`❌ Error cleaning up GCS file after error`, {
          requestId,
          gcsCleanupError,
        });
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      log.debug(`🧹 Forced garbage collection after error`, { requestId });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      success: false,
      error: errorMessage,
      processingTime: `${processingTime}ms`,
    });
  }
});

// API root endpoint
app.get("/", (req, res) => {
  log.info(`📖 API documentation requested`, { requestId: req.requestId });
  res.json({
    name: "PDF to Image Converter API",
    version: "1.0.0",
    description: "Convert PDF files to JPG images via REST API",
    endpoints: {
      health: "GET /health",
      convert: "POST /api/convert",
      images: "GET /output/{folder}/{filename}",
    },
    usage: {
      convert: {
        method: "POST",
        url: "/api/convert",
        contentType: "multipart/form-data",
        fields: {
          pdf: "PDF file (required)",
          dpi: "DPI resolution (optional, default: 300)",
          quality: "JPG quality 1-100 (optional, default: 90)",
          pages: "Page range (optional, default: 'all')",
        },
        example:
          "curl -X POST -F 'pdf=@document.pdf' -F 'dpi=300' -F 'quality=90' /api/convert",
      },
    },
  });
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    log.error(`🚨 Server error caught by middleware`, {
      requestId: req.requestId,
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        log.warn(`📂 File size limit exceeded`, {
          requestId: req.requestId,
          error: error.message,
        });
        return res
          .status(400)
          .json({ error: "File too large. Maximum size is 200MB." });
      }
      log.warn(`📂 Multer error`, {
        requestId: req.requestId,
        error: error.message,
      });
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
);

// 404 handler
app.use((req, res) => {
  // Check if this is a common malformed request
  const isMalformedHealthCheck = req.url.includes("/health/health");
  const isMalformedApiCall = req.url.includes("/health/api/");

  if (isMalformedHealthCheck || isMalformedApiCall) {
    log.warn(`🔍 Malformed request detected`, {
      requestId: req.requestId,
      url: req.url,
      method: req.method,
      userAgent: req.get("user-agent"),
      clientIP: req.ip,
      suggestion: isMalformedHealthCheck
        ? "Use /health instead of /health/health"
        : "Use /api/convert instead of /health/api/convert",
    });
  } else {
    log.warn(`🔍 404 Not Found`, {
      requestId: req.requestId,
      url: req.url,
      method: req.method,
      userAgent: req.get("user-agent"),
      clientIP: req.ip,
    });
  }

  res.status(404).json({
    error: "Not found",
    message: isMalformedHealthCheck
      ? "Try /health instead"
      : isMalformedApiCall
      ? "Try /api/convert instead"
      : "Route not found",
  });
});

// Cleanup old files in GCS periodically (every hour)
setInterval(async () => {
  const cleanupStart = Date.now();
  log.info(`🧹 Starting periodic GCS cleanup`);

  try {
    // Clean up files in GCS older than specified time
    const maxAgeMinutes = 60; // 1 hour

    // Clean up uploads
    const uploadsCleanedCount = await cleanupOldFiles(
      "uploads/",
      maxAgeMinutes
    );

    // Clean up output files
    const outputCleanedCount = await cleanupOldFiles("output/", maxAgeMinutes);

    const totalCleanedFiles = uploadsCleanedCount + outputCleanedCount;
    const cleanupTime = Date.now() - cleanupStart;

    log.success(`✅ Periodic GCS cleanup completed`, {
      totalCleanedFiles,
      uploadsCleanedCount,
      outputCleanedCount,
      processingTime: `${cleanupTime}ms`,
      bucketName,
    });
  } catch (error) {
    log.error(`💥 Error during GCS cleanup`, error);
  }
}, 60 * 60 * 1000); // Run every hour

app.listen(PORT, () => {
  log.success(`🚀 PDF to Image API Server started successfully`);
  log.info(`📊 Server Information`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    debugMode: process.env.DEBUG === "true",
    pid: process.pid,
  });
  log.info(`🌐 API Endpoints`, {
    documentation: `http://localhost:${PORT}`,
    health: `http://localhost:${PORT}/health`,
    convert: `http://localhost:${PORT}/api/convert`,
  });
});

// Process monitoring
process.on("uncaughtException", (error) => {
  log.error(`💥 Uncaught Exception`, error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log.error(`💥 Unhandled Rejection at Promise`, {
    promise,
    reason,
  });
  process.exit(1);
});

process.on("SIGTERM", () => {
  log.info(`📴 SIGTERM received, shutting down gracefully`);
  process.exit(0);
});

process.on("SIGINT", () => {
  log.info(`📴 SIGINT received, shutting down gracefully`);
  process.exit(0);
});

// Log system resource usage every 5 minutes in production
if (process.env.NODE_ENV === "production") {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    log.info(`📊 System Resource Usage`, {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      cpu: {
        user: `${cpuUsage.user}μs`,
        system: `${cpuUsage.system}μs`,
      },
      uptime: `${Math.round(process.uptime())}s`,
    });
  }, 5 * 60 * 1000); // 5 minutes
}
