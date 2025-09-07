import pdf2pic from "pdf2pic";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
import { Worker } from "worker_threads";
import os from "os";

// Enhanced logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(
      chalk.blue(`[FAST-CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  warn: (message: string, data?: any) => {
    console.log(
      chalk.yellow(`[FAST-CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  error: (message: string, error?: any) => {
    console.log(
      chalk.red(`[FAST-CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (error) {
      console.log(chalk.red(error.stack || error.message || error));
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
      console.log(
        chalk.magenta(
          `[FAST-CONVERTER] ${new Date().toISOString()}: ${message}`
        )
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  },
  success: (message: string, data?: any) => {
    console.log(
      chalk.green(`[FAST-CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
};

export interface FastConvertOptions {
  outputDir: string;
  dpi: number;
  quality: number;
  pages: string;
  format: "jpg" | "png";
  maxConcurrency?: number;
}

export interface FastConvertResult {
  outputDir: string;
  imageCount: number;
  pagesConverted: number[];
  format: string;
}

// Set optimal Sharp concurrency and cache settings for performance
sharp.concurrency(Math.min(os.cpus().length, 4)); // Limit to 4 to prevent memory issues
sharp.cache({ files: 0, items: 100 }); // Disable file cache, keep item cache small

export async function convertPdfToImagesFast(
  pdfPath: string,
  options: FastConvertOptions
): Promise<FastConvertResult> {
  const conversionStart = Date.now();
  const {
    outputDir,
    dpi,
    quality,
    pages,
    format,
    maxConcurrency = Math.min(os.cpus().length, 4),
  } = options;

  log.info(`🚀 Starting FAST PDF to image conversion`, {
    pdfPath,
    outputDir,
    dpi,
    quality,
    pages,
    format,
    maxConcurrency,
  });

  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Parse page range
    const pageNumbers = parsePageRange(pages);

    log.info(`📄 Processing PDF: ${path.basename(pdfPath)}`);
    log.info(
      `   DPI: ${dpi} | Quality: ${quality}% | Format: ${format.toUpperCase()}`
    );
    log.info(
      `   Pages: ${
        pages === "all" ? "all" : pageNumbers.join(", ")
      } | Concurrency: ${maxConcurrency}`
    );

    // Configure pdf2pic for optimal performance
    const pdf2picConfig = {
      density: dpi,
      saveFilename: path.basename(pdfPath, ".pdf"),
      savePath: outputDir,
      format: format === "jpg" ? ("jpeg" as const) : ("png" as const),
      width: undefined,
      height: undefined,
    };

    log.debug(`⚙️ pdf2pic configuration`, pdf2picConfig);
    const convert = pdf2pic.fromPath(pdfPath, pdf2picConfig);

    // OPTIMIZATION: Direct format conversion - skip PNG intermediate step for JPG
    if (format === "jpg") {
      return await convertDirectToJpg(
        convert,
        pageNumbers,
        outputDir,
        pdfPath,
        quality,
        maxConcurrency
      );
    } else {
      return await convertToPng(
        convert,
        pageNumbers,
        outputDir,
        pdfPath,
        maxConcurrency
      );
    }
  } catch (error) {
    const totalTime = Date.now() - conversionStart;
    log.error(`💥 FAST PDF conversion failed`, {
      error: error instanceof Error ? error.message : error,
      pdfPath,
      options,
      processingTime: `${totalTime}ms`,
    });
    throw error;
  }
}

// FAST JPG conversion - direct to JPG without PNG intermediate
async function convertDirectToJpg(
  convert: any,
  pageNumbers: number[],
  outputDir: string,
  pdfPath: string,
  quality: number,
  maxConcurrency: number
): Promise<FastConvertResult> {
  const conversionStart = Date.now();

  log.info(`🔥 DIRECT JPG conversion (skipping PNG intermediate step)`);

  let pages: number[] = pageNumbers;
  if (pageNumbers.length === 0) {
    // For all pages, we need to determine the count first
    log.debug(`🔍 Determining total pages for bulk conversion`);
    const testResult = await convert(1, { responseType: "image" });
    if (testResult) {
      // Clean up test file
      try {
        await fs.unlink(testResult.path);
      } catch {}
    }
    // Use bulk conversion for all pages
    pages = [];
  }

  const convertedPages: number[] = [];
  const jpgFiles: string[] = [];

  if (pages.length === 0) {
    // Bulk conversion for all pages
    log.debug(`🔄 Bulk converting all pages directly to JPG`);
    const results = await convert.bulk(-1, { responseType: "image" });

    // Process results in parallel batches
    const batches = createBatches(results, maxConcurrency);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (result: any, index) => {
          if (!result || !result.path) return;

          const pageNumber = results.indexOf(result) + 1;
          const fileName = `${path.basename(pdfPath, ".pdf")}_page_${pageNumber
            .toString()
            .padStart(3, "0")}.jpg`;
          const jpgPath = path.join(outputDir, fileName);

          try {
            // FAST: Direct Sharp processing with optimized settings
            await sharp(result.path)
              .jpeg({
                quality,
                progressive: false, // Faster encoding
                optimiseScans: false, // Skip optimization for speed
                overshootDeringing: false,
                trellisQuantisation: false,
              })
              .toFile(jpgPath);

            // Immediate cleanup
            await fs.unlink(result.path);

            jpgFiles.push(jpgPath);
            convertedPages.push(pageNumber);
          } catch (error) {
            log.error(`❌ Error processing page ${pageNumber}`, error);
            try {
              await fs.unlink(result.path);
            } catch {}
          }
        })
      );
    }
  } else {
    // Specific pages conversion in parallel
    log.debug(`🎯 Converting specific pages in parallel: ${pages.join(", ")}`);

    const batches = createBatches(pages, maxConcurrency);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (pageNum) => {
          try {
            const result: any = await convert(pageNum, {
              responseType: "image",
            });
            if (!result || !result.path) return;

            const fileName = `${path.basename(pdfPath, ".pdf")}_page_${pageNum
              .toString()
              .padStart(3, "0")}.jpg`;
            const jpgPath = path.join(outputDir, fileName);

            // FAST: Direct Sharp processing
            await sharp(result.path)
              .jpeg({
                quality,
                progressive: false,
                optimiseScans: false,
                overshootDeringing: false,
                trellisQuantisation: false,
              })
              .toFile(jpgPath);

            // Immediate cleanup
            await fs.unlink(result.path);

            jpgFiles.push(jpgPath);
            convertedPages.push(pageNum);
          } catch (error) {
            log.error(`❌ Error converting page ${pageNum}`, error);
          }
        })
      );
    }
  }

  const totalTime = Date.now() - conversionStart;

  const result = {
    outputDir,
    imageCount: jpgFiles.length,
    pagesConverted: convertedPages.sort((a, b) => a - b),
    format: "jpg",
  };

  log.success(`🎉 FAST JPG conversion completed`, {
    result,
    totalTime: `${totalTime}ms`,
    avgTimePerPage:
      jpgFiles.length > 0
        ? `${Math.round(totalTime / jpgFiles.length)}ms`
        : "N/A",
  });

  return result;
}

// FAST PNG conversion
async function convertToPng(
  convert: any,
  pageNumbers: number[],
  outputDir: string,
  pdfPath: string,
  maxConcurrency: number
): Promise<FastConvertResult> {
  const conversionStart = Date.now();

  log.info(`🔥 FAST PNG conversion`);

  let pngResults;
  if (pageNumbers.length > 0) {
    // Convert specific pages in parallel batches
    const batches = createBatches(pageNumbers, maxConcurrency);
    pngResults = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (pageNum) => {
          try {
            return await convert(pageNum, { responseType: "image" });
          } catch (error) {
            log.error(`❌ Error converting page ${pageNum}`, error);
            return null;
          }
        })
      );
      pngResults.push(...batchResults.filter(Boolean));
    }
  } else {
    // Convert all pages
    pngResults = await convert.bulk(-1, { responseType: "image" });
  }

  const totalTime = Date.now() - conversionStart;

  const result = {
    outputDir,
    imageCount: pngResults.length,
    pagesConverted: pngResults.map((_: any, index: number) => index + 1),
    format: "png",
  };

  log.success(`🎉 FAST PNG conversion completed`, {
    result,
    totalTime: `${totalTime}ms`,
    avgTimePerPage:
      pngResults.length > 0
        ? `${Math.round(totalTime / pngResults.length)}ms`
        : "N/A",
  });

  return result;
}

// Utility function to create batches for parallel processing
function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function parsePageRange(pageRange: string): number[] {
  if (pageRange === "all") {
    return [];
  }

  const pages: number[] = [];
  const parts = pageRange.split(",");

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed.includes("-")) {
      // Handle range like "1-3"
      const rangeParts = trimmed.split("-");
      if (rangeParts.length !== 2) {
        throw new Error(`Invalid page range format: ${trimmed}`);
      }

      const startStr = rangeParts[0]?.trim();
      const endStr = rangeParts[1]?.trim();

      if (!startStr || !endStr) {
        throw new Error(`Invalid page range: ${trimmed}`);
      }

      const start = parseInt(startStr);
      const end = parseInt(endStr);

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid page range: ${trimmed}`);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    } else {
      // Handle single page like "5"
      const pageNum = parseInt(trimmed);
      if (isNaN(pageNum)) {
        throw new Error(`Invalid page number: ${trimmed}`);
      }
      pages.push(pageNum);
    }
  }

  return [...new Set(pages)].sort((a, b) => a - b);
}
