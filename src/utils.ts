import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";

// Enhanced logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(chalk.blue(`[UTILS] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  warn: (message: string, data?: any) => {
    console.log(
      chalk.yellow(`[UTILS] ${new Date().toISOString()}: ${message}`)
    );
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  error: (message: string, error?: any) => {
    console.log(chalk.red(`[UTILS] ${new Date().toISOString()}: ${message}`));
    if (error) {
      console.log(chalk.red(error.stack || error.message || error));
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
      console.log(
        chalk.magenta(`[UTILS] ${new Date().toISOString()}: ${message}`)
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  },
  success: (message: string, data?: any) => {
    console.log(chalk.green(`[UTILS] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
};

export async function validatePdfFile(filePath: string): Promise<void> {
  const validationStart = Date.now();
  log.info(`🔍 Starting PDF file validation`, { filePath });

  try {
    // Check if file exists
    log.debug(`📁 Checking file existence: ${filePath}`);
    await fs.access(filePath);
    log.debug(`✅ File exists and is accessible`);

    // Check if it's a PDF file
    const ext = path.extname(filePath).toLowerCase();
    log.debug(`📄 File extension check`, { extension: ext });

    if (ext !== ".pdf") {
      log.error(`❌ Invalid file extension`, { expected: ".pdf", actual: ext });
      throw new Error(`File must be a PDF. Got: ${ext}`);
    }
    log.debug(`✅ File extension is valid`);

    // Check if file is readable and get stats
    log.debug(`📊 Getting file statistics`);
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      log.error(`❌ Path is not a file`, {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
      });
      throw new Error("Path is not a file");
    }

    const validationTime = Date.now() - validationStart;
    const fileInfo = {
      name: path.basename(filePath),
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      validationTime: `${validationTime}ms`,
    };

    log.success(`✅ PDF file validation completed successfully`, fileInfo);

    // Also log the original format for backward compatibility
    console.log(
      chalk.green(`✅ PDF file validated: ${path.basename(filePath)}`)
    );
    console.log(chalk.gray(`   Size: ${formatFileSize(stats.size)}`));
  } catch (error) {
    const validationTime = Date.now() - validationStart;
    log.error(`❌ PDF file validation failed`, {
      filePath,
      error: error instanceof Error ? error.message : error,
      validationTime: `${validationTime}ms`,
    });

    if (error instanceof Error) {
      throw new Error(`Invalid PDF file: ${error.message}`);
    } else {
      throw new Error("Invalid PDF file: Unknown error");
    }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function createOutputFilename(
  originalName: string,
  pageNumber: number,
  extension: string = "jpg"
): string {
  const baseName = path.basename(originalName, path.extname(originalName));
  return `${baseName}_page_${pageNumber
    .toString()
    .padStart(3, "0")}.${extension}`;
}
