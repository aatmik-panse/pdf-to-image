// import pdf from "pdf-poppler";
// import sharp from "sharp";
// import { promises as fs } from "fs";
// import path from "path";
// import chalk from "chalk";

// export interface ConvertOptions {
//   outputDir: string;
//   dpi: number;
//   quality: number;
//   pages: string;
// }

// export interface ConvertResult {
//   outputDir: string;
//   imageCount: number;
//   pagesConverted: number[];
// }

// export async function convertPdfToImages(
//   pdfPath: string,
//   options: ConvertOptions
// ): Promise<ConvertResult> {
//   const { outputDir, dpi, quality, pages } = options;

//   // Ensure output directory exists
//   await fs.mkdir(outputDir, { recursive: true });

//   // Parse page range
//   const pageNumbers = parsePageRange(pages);

//   // Configure pdf-poppler options
//   const pdfOptions = {
//     format: "png",
//     out_dir: outputDir,
//     out_prefix: path.basename(pdfPath, ".pdf"),
//     page: pageNumbers.length > 0 ? pageNumbers : null,
//     dpi: dpi,
//   };

//   console.log(chalk.yellow(`📄 Processing PDF: ${path.basename(pdfPath)}`));
//   console.log(chalk.gray(`   DPI: ${dpi}`));
//   console.log(chalk.gray(`   Quality: ${quality}%`));
//   console.log(
//     chalk.gray(`   Pages: ${pages === "all" ? "all" : pageNumbers.join(", ")}`)
//   );

//   // Convert PDF to PNG images
//   const pngFiles = await pdf.convert(pdfPath, pdfOptions);

//   // Convert PNG to JPG with specified quality
//   const jpgFiles: string[] = [];
//   const convertedPages: number[] = [];

//   for (let i = 0; i < pngFiles.length; i++) {
//     const pngFile = pngFiles[i];
//     const jpgFile = pngFile.replace(".png", ".jpg");

//     console.log(chalk.gray(`🔄 Converting page ${i + 1} to JPG...`));

//     await sharp(pngFile).jpeg({ quality }).toFile(jpgFile);

//     // Remove the temporary PNG file
//     await fs.unlink(pngFile);

//     jpgFiles.push(jpgFile);
//     convertedPages.push(
//       pageNumbers.length > 0 ? pageNumbers[i] ?? i + 1 : i + 1
//     );
//   }

//   return {
//     outputDir,
//     imageCount: jpgFiles.length,
//     pagesConverted: convertedPages,
//   };
// }

// function parsePageRange(pageRange: string): number[] {
//   if (pageRange === "all") {
//     return [];
//   }

//   const pages: number[] = [];
//   const parts = pageRange.split(",");

//   for (const part of parts) {
//     const trimmed = part.trim();

//     if (trimmed.includes("-")) {
//       // Handle range like "1-3"
//       const parts = trimmed.split("-");
//       if (parts.length !== 2) {
//         throw new Error(`Invalid page range format: ${trimmed}`);
//       }

//       const startStr = parts[0]?.trim();
//       const endStr = parts[1]?.trim();

//       if (!startStr || !endStr) {
//         throw new Error(`Invalid page range: ${trimmed}`);
//       }

//       const start = parseInt(startStr);
//       const end = parseInt(endStr);

//       if (isNaN(start) || isNaN(end)) {
//         throw new Error(`Invalid page range: ${trimmed}`);
//       }

//       for (let i = start; i <= end; i++) {
//         pages.push(i);
//       }
//     } else {
//       // Handle single page like "5"
//       const pageNum = parseInt(trimmed);
//       if (isNaN(pageNum)) {
//         throw new Error(`Invalid page number: ${trimmed}`);
//       }
//       pages.push(pageNum);
//     }
//   }

//   return [...new Set(pages)].sort((a, b) => a - b);
// }
