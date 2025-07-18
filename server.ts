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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
    const uploadDir = path.join(__dirname, "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/output", express.static(path.join(__dirname, "output")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API endpoint for PDF conversion
app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const { dpi = "300", quality = "90", pages = "all" } = req.body;
    const outputDir = path.join(
      __dirname,
      "output",
      `conversion-${Date.now()}`
    );

    // Validate PDF file
    await validatePdfFile(req.file.path);

    // Convert PDF to images
    const result = await convertPdfToImages(req.file.path, {
      outputDir,
      dpi: parseInt(dpi),
      quality: parseInt(quality),
      pages,
    });

    // Get list of generated images with their URLs
    const imageFiles = await fs.readdir(result.outputDir);
    const images = imageFiles
      .filter((file) => file.endsWith(".jpg"))
      .map((file) => ({
        filename: file,
        url: `/output/${path.basename(result.outputDir)}/${file}`,
      }));

    // Clean up uploaded PDF file
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      message: "PDF converted successfully",
      data: {
        outputDir: result.outputDir,
        imageCount: result.imageCount,
        pagesConverted: result.pagesConverted,
        images,
      },
    });
  } catch (error) {
    console.error("Conversion error:", error);

    // Clean up uploaded file if it exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error("Error cleaning up uploaded file:", unlinkError);
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Serve the main HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Server error:", error);

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "File too large. Maximum size is 100MB." });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Cleanup old files periodically (every hour)
setInterval(async () => {
  try {
    const outputDir = path.join(__dirname, "output");
    const uploadsDir = path.join(__dirname, "uploads");

    // Clean up output directories older than 1 hour
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const dir of [outputDir, uploadsDir]) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.rm(filePath, { recursive: true, force: true });
          }
        }
      } catch (error) {
        console.error(`Error cleaning up ${dir}:`, error);
      }
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}, 60 * 60 * 1000); // Run every hour

app.listen(PORT, () => {
  console.log(`🚀 PDF to Image Server running on port ${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Access the application at: http://localhost:${PORT}`);
});
