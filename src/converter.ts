import pdf2pic from "pdf2pic";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";

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
  const { outputDir, dpi, quality, pages } = options;

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Parse page range
  const pageNumbers = parsePageRange(pages);

  console.log(chalk.yellow(`📄 Processing PDF: ${path.basename(pdfPath)}`));
  console.log(chalk.gray(`   DPI: ${dpi}`));
  console.log(chalk.gray(`   Quality: ${quality}%`));
  console.log(
    chalk.gray(`   Pages: ${pages === "all" ? "all" : pageNumbers.join(", ")}`)
  );

  // Configure pdf2pic
  const convert = pdf2pic.fromPath(pdfPath, {
    density: dpi,
    saveFilename: path.basename(pdfPath, ".pdf"),
    savePath: outputDir,
    format: "png",
    width: undefined,
    height: undefined,
  });

  // Convert PDF to PNG images
  let pngResults;
  if (pageNumbers.length > 0) {
    // Convert specific pages
    pngResults = await Promise.all(
      pageNumbers.map((pageNum) => convert(pageNum, { responseType: "image" }))
    );
  } else {
    // Convert all pages
    pngResults = await convert.bulk(-1, { responseType: "image" });
  }

  // Convert PNG to JPG with specified quality
  const jpgFiles: string[] = [];
  const convertedPages: number[] = [];

  for (let i = 0; i < pngResults.length; i++) {
    const pngResult = pngResults[i];
    if (!pngResult || !pngResult.path) continue;

    const pageNumber = pageNumbers.length > 0 ? pageNumbers[i] ?? i + 1 : i + 1;
    const fileName = `${path.basename(pdfPath, ".pdf")}_page_${pageNumber
      .toString()
      .padStart(3, "0")}.jpg`;
    const jpgPath = path.join(outputDir, fileName);

    console.log(chalk.gray(`🔄 Converting page ${pageNumber} to JPG...`));

    // Read PNG and convert to JPG
    await sharp(pngResult.path).jpeg({ quality }).toFile(jpgPath);

    // Remove the temporary PNG file
    await fs.unlink(pngResult.path);

    jpgFiles.push(jpgPath);
    convertedPages.push(pageNumber);
  }

  return {
    outputDir,
    imageCount: jpgFiles.length,
    pagesConverted: convertedPages,
  };
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
