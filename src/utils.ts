import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";

export async function validatePdfFile(filePath: string): Promise<void> {
  try {
    // Check if file exists
    await fs.access(filePath);

    // Check if it's a PDF file
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".pdf") {
      throw new Error(`File must be a PDF. Got: ${ext}`);
    }

    // Check if file is readable
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error("Path is not a file");
    }

    console.log(
      chalk.green(`✅ PDF file validated: ${path.basename(filePath)}`)
    );
    console.log(chalk.gray(`   Size: ${formatFileSize(stats.size)}`));
  } catch (error) {
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
