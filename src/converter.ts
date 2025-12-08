import pdf2pic from "pdf2pic";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";

// Enhanced logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(
      chalk.blue(`[CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  warn: (message: string, data?: any) => {
    console.log(
      chalk.yellow(`[CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  error: (message: string, error?: any) => {
    console.log(
      chalk.red(`[CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (error) {
      console.log(chalk.red(error.stack || error.message || error));
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
      console.log(
        chalk.magenta(`[CONVERTER] ${new Date().toISOString()}: ${message}`)
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  },
  success: (message: string, data?: any) => {
    console.log(
      chalk.green(`[CONVERTER] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
};

export interface ConvertOptions {
  outputDir: string;
  dpi: number;
  quality: number;
  pages: string;
}

export interface ConvertResult {
  outputDir: string;
  imageCount: number;
  pagesConverted: number[];
}

export async function convertPdfToImages(
  pdfPath: string,
  options: ConvertOptions
): Promise<ConvertResult> {
  const conversionStart = Date.now();
  const { outputDir, dpi, quality, pages } = options;

  log.info(`🚀 Starting PDF to image conversion`, {
    pdfPath,
    outputDir,
    dpi,
    quality,
    pages,
  });

  try {
    // Ensure output directory exists
    log.debug(`📁 Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
    log.success(`✅ Output directory created successfully`);

    // Parse page range
    log.debug(`📄 Parsing page range: ${pages}`);
    const pageNumbers = parsePageRange(pages);
    log.debug(`📋 Parsed page numbers`, {
      pageNumbers,
      total: pageNumbers.length,
    });

    log.info(`📄 Processing PDF: ${path.basename(pdfPath)}`);
    log.info(`   DPI: ${dpi}`);
    log.info(`   Quality: ${quality}%`);
    log.info(`   Pages: ${pages === "all" ? "all" : pageNumbers.join(", ")}`);

    // Configure pdf2pic
    const pdf2picConfig = {
      density: dpi,
      saveFilename: path.basename(pdfPath, ".pdf"),
      savePath: outputDir,
      format: "png" as const,
      width: undefined,
      height: undefined,
    };

    log.debug(`⚙️ pdf2pic configuration`, pdf2picConfig);
    const convert = pdf2pic.fromPath(pdfPath, pdf2picConfig);

    // Convert PDF to PNG images
    let pngResults;
    log.info(`🔄 Converting PDF to PNG images...`);
    const pngConversionStart = Date.now();

    if (pageNumbers.length > 0) {
      // Convert specific pages
      log.debug(`🎯 Converting specific pages: ${pageNumbers.join(", ")}`);
      pngResults = await Promise.all(
        pageNumbers.map(async (pageNum) => {
          log.debug(`🔄 Converting page ${pageNum}`);
          const result = await convert(pageNum, { responseType: "image" });
          log.debug(`✅ Page ${pageNum} converted to PNG`, {
            path: result.path,
          });
          return result;
        })
      );
    } else {
      // Convert all pages
      log.debug(`🔄 Converting all pages`);
      pngResults = await convert.bulk(-1, { responseType: "image" });
    }

    const pngConversionTime = Date.now() - pngConversionStart;
    log.success(`✅ PNG conversion completed`, {
      pagesProcessed: pngResults.length,
      processingTime: `${pngConversionTime}ms`,
    });

    // Convert PNG to JPG with specified quality
    log.info(`🖼️ Converting PNG files to JPG...`);
    const jpgFiles: string[] = [];
    const convertedPages: number[] = [];
    const jpgConversionStart = Date.now();

    for (let i = 0; i < pngResults.length; i++) {
      const pngResult = pngResults[i];
      if (!pngResult || !pngResult.path) {
        log.warn(`⚠️ Invalid PNG result at index ${i}`, { pngResult });
        continue;
      }

      const pageNumber =
        pageNumbers.length > 0 ? pageNumbers[i] ?? i + 1 : i + 1;
      const fileName = `${path.basename(pdfPath, ".pdf")}_page_${pageNumber
        .toString()
        .padStart(3, "0")}.jpg`;
      const jpgPath = path.join(outputDir, fileName);

      log.debug(`🔄 Converting page ${pageNumber} from PNG to JPG`, {
        pngPath: pngResult.path,
        jpgPath,
        quality,
      });

      try {
        // Read PNG and convert to JPG with memory optimization
        const sharpStart = Date.now();

        // 🚀 MEMORY OPTIMIZATION: Process with limited concurrency and explicit cleanup
        const sharpProcessor = sharp(pngResult.path).jpeg({
          quality,
          progressive: true, // Reduces memory usage during encoding
          mozjpeg: true, // Better compression and memory efficiency
        });

        await sharpProcessor.toFile(jpgPath);

        // Explicitly destroy the Sharp instance to free memory
        sharpProcessor.destroy();

        const sharpTime = Date.now() - sharpStart;

        log.debug(`✅ Sharp conversion completed for page ${pageNumber}`, {
          processingTime: `${sharpTime}ms`,
        });

        // Remove the temporary PNG file immediately after conversion
        await fs.unlink(pngResult.path);
        log.debug(`🗑️ Temporary PNG file removed: ${pngResult.path}`);

        jpgFiles.push(jpgPath);
        convertedPages.push(pageNumber);

        log.debug(`✅ Page ${pageNumber} converted to JPG successfully`);

        // 🧹 MEMORY OPTIMIZATION: Force garbage collection between pages for large documents
        if (pngResults.length > 5 && i % 3 === 0 && global.gc) {
          global.gc();
          log.debug(`🧹 Forced garbage collection after page ${pageNumber}`);
        }
      } catch (error) {
        log.error(`❌ Error converting page ${pageNumber}`, error);

        // Clean up PNG file even on error
        try {
          await fs.unlink(pngResult.path);
          log.debug(`🧹 Cleaned up PNG file after error: ${pngResult.path}`);
        } catch (unlinkError) {
          log.warn(
            `⚠️ Failed to cleanup PNG file after error: ${pngResult.path}`
          );
        }

        throw error;
      }
    }

    const jpgConversionTime = Date.now() - jpgConversionStart;
    const totalTime = Date.now() - conversionStart;

    const result = {
      outputDir,
      imageCount: jpgFiles.length,
      pagesConverted: convertedPages,
    };

    log.success(`🎉 PDF to image conversion completed successfully`, {
      result,
      timing: {
        pngConversion: `${pngConversionTime}ms`,
        jpgConversion: `${jpgConversionTime}ms`,
        totalTime: `${totalTime}ms`,
      },
    });

    return result;
  } catch (error) {
    const totalTime = Date.now() - conversionStart;
    log.error(`💥 PDF to image conversion failed`, {
      error: error instanceof Error ? error.message : error,
      pdfPath,
      options,
      processingTime: `${totalTime}ms`,
    });
    throw error;
  }
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
      const parts = trimmed.split("-");
      if (parts.length !== 2) {
        throw new Error(`Invalid page range format: ${trimmed}`);
      }

      const startStr = parts[0]?.trim();
      const endStr = parts[1]?.trim();

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
