import express from "express";
import multer from "multer";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { convertPdfToImages } from "./src/converter";
import { validatePdfFile } from "./src/utils";
import chalk from "chalk";

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

// Add requestId to express request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
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
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Use mounted disk path for persistent storage
      const uploadDir = path.join(__dirname, "data", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      log.debug(`📁 Upload directory created/verified: ${uploadDir}`, {
        requestId: req.requestId,
      });
      cb(null, uploadDir);
    } catch (error) {
      log.error(`❌ Failed to create upload directory`, error);
      cb(error as Error, "");
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}-${file.originalname}`;
    log.debug(`📄 Generated filename: ${filename}`, {
      requestId: req.requestId,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    cb(null, filename);
  },
});

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
    uptime: process.uptime(),
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

// API endpoint for PDF conversion
app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  const requestId = req.requestId;
  const startTime = Date.now();

  try {
    log.info(`🚀 PDF conversion started`, {
      requestId,
      body: req.body,
      fileInfo: req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
          }
        : null,
    });

    if (!req.file) {
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

    const outputDir = path.join(
      __dirname,
      "data",
      "output",
      `conversion-${Date.now()}`
    );

    log.debug(`📁 Output directory: ${outputDir}`, { requestId });

    // Validate PDF file
    log.debug(`🔍 Starting PDF validation`, {
      requestId,
      filePath: req.file.path,
    });
    await validatePdfFile(req.file.path);
    log.success(`✅ PDF validation completed`, { requestId });

    // Convert PDF to images
    log.info(`🔄 Starting PDF to image conversion`, {
      requestId,
      filePath: req.file.path,
    });
    const result = await convertPdfToImages(req.file.path, {
      outputDir,
      ...conversionOptions,
    });
    log.success(`✅ PDF conversion completed`, { requestId, result });

    // Get list of generated images with their URLs
    log.debug(`📋 Reading generated images`, {
      requestId,
      outputDir: result.outputDir,
    });
    const imageFiles = await fs.readdir(result.outputDir);
    const images = imageFiles
      .filter((file) => file.endsWith(".jpg"))
      .map((file) => ({
        filename: file,
        url: `/output/${path.basename(result.outputDir)}/${file}`,
      }));

    log.debug(`📸 Generated images`, {
      requestId,
      imageCount: images.length,
      images,
    });

    // Clean up uploaded PDF file
    log.debug(`🧹 Cleaning up uploaded PDF`, {
      requestId,
      filePath: req.file.path,
    });
    await fs.unlink(req.file.path);
    log.success(`✅ Cleanup completed`, { requestId });

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
  log.warn(`🔍 404 Not Found`, {
    requestId: req.requestId,
    url: req.url,
    method: req.method,
    userAgent: req.get("user-agent"),
  });
  res.status(404).json({ error: "Not found" });
});

// Cleanup old files periodically (every hour)
setInterval(async () => {
  const cleanupStart = Date.now();
  log.info(`🧹 Starting periodic cleanup`);

  try {
    const outputDir = path.join(__dirname, "data", "output");
    const uploadsDir = path.join(__dirname, "data", "uploads");

    // Clean up output directories older than 1 hour
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleanedFiles = 0;

    for (const dir of [outputDir, uploadsDir]) {
      try {
        const files = await fs.readdir(dir);
        log.debug(`🔍 Checking ${files.length} files in ${dir}`);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();

          if (age > maxAge) {
            await fs.rm(filePath, { recursive: true, force: true });
            cleanedFiles++;
            log.debug(
              `🗑️ Removed old file/directory: ${file} (age: ${Math.round(
                age / 1000 / 60
              )}min)`
            );
          }
        }
      } catch (error) {
        log.error(`❌ Error cleaning up ${dir}`, error);
      }
    }

    const cleanupTime = Date.now() - cleanupStart;
    log.success(`✅ Periodic cleanup completed`, {
      cleanedFiles,
      processingTime: `${cleanupTime}ms`,
      directories: [outputDir, uploadsDir],
    });
  } catch (error) {
    log.error(`💥 Error during cleanup`, error);
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
