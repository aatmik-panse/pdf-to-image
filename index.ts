import { program } from "commander";
import chalk from "chalk";
import { validatePdfFile } from "./src/utils";
import { convertPdfToImages } from "./src/converter";

// Enhanced logging utility for CLI
const log = {
  info: (message: string, data?: any) => {
    console.log(chalk.blue(`[CLI] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  warn: (message: string, data?: any) => {
    console.log(chalk.yellow(`[CLI] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
  error: (message: string, error?: any) => {
    console.log(chalk.red(`[CLI] ${new Date().toISOString()}: ${message}`));
    if (error) {
      console.log(chalk.red(error.stack || error.message || error));
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
      console.log(
        chalk.magenta(`[CLI] ${new Date().toISOString()}: ${message}`)
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
  },
  success: (message: string, data?: any) => {
    console.log(chalk.green(`[CLI] ${new Date().toISOString()}: ${message}`));
    if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
  },
};

program
  .name("pdf-to-image")
  .description("Convert PDF files to JPG images")
  .version("1.0.0")
  .addHelpText(
    "after",
    `
Examples:
  $ bun start document.pdf                    # Convert all pages
  $ bun start document.pdf -o ./images       # Specify output directory
  $ bun start document.pdf -d 600 -q 95      # High quality conversion
  $ bun start document.pdf -p 1-5            # Convert pages 1-5
  $ bun start document.pdf -p 1,3,5          # Convert specific pages
  
Page Range Formats:
  all       Convert all pages
  1         Convert only page 1
  1-5       Convert pages 1 through 5
  1,3,5     Convert pages 1, 3, and 5
  1-3,7-9   Convert pages 1-3 and 7-9
`
  );

program
  .argument("<pdf-file>", "Path to the PDF file to convert")
  .option("-o, --output <dir>", "Output directory for images", "./output")
  .option("-d, --dpi <number>", "DPI resolution for images", "300")
  .option("-q, --quality <number>", "JPG quality (1-100)", "90")
  .option(
    "-p, --pages <range>",
    "Page range to convert (e.g., 1-3 or 1,3,5)",
    "all"
  )
  .action(async (pdfFile, options) => {
    const cliStart = Date.now();
    const sessionId = Math.random().toString(36).substr(2, 9);

    try {
      log.info(`🚀 Starting CLI PDF to Image conversion session`, {
        sessionId,
        pdfFile,
        options,
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        platform: process.platform,
      });

      console.log(chalk.blue("🔄 Starting PDF to Image conversion..."));

      // Validate PDF file
      log.debug(`🔍 Starting PDF validation`, { sessionId, pdfFile });
      await validatePdfFile(pdfFile);
      log.success(`✅ PDF validation completed`, { sessionId });

      // Convert PDF to images
      log.info(`🔄 Starting PDF to image conversion`, { sessionId, options });
      const conversionStart = Date.now();

      const result = await convertPdfToImages(pdfFile, {
        outputDir: options.output,
        dpi: parseInt(options.dpi),
        quality: parseInt(options.quality),
        pages: options.pages,
      });

      const conversionTime = Date.now() - conversionStart;
      const totalTime = Date.now() - cliStart;

      log.success(`🎉 CLI conversion completed successfully`, {
        sessionId,
        result,
        timing: {
          conversionTime: `${conversionTime}ms`,
          totalTime: `${totalTime}ms`,
        },
      });

      console.log(chalk.green("✅ Conversion completed successfully!"));
      console.log(chalk.cyan(`📁 Output directory: ${result.outputDir}`));
      console.log(chalk.cyan(`🖼️  Images created: ${result.imageCount}`));
      console.log(
        chalk.cyan(`📄 Pages converted: ${result.pagesConverted.join(", ")}`)
      );
      console.log(chalk.gray(`⏱️  Total processing time: ${totalTime}ms`));
    } catch (error) {
      const totalTime = Date.now() - cliStart;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      log.error(`💥 CLI conversion failed`, {
        sessionId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${totalTime}ms`,
        pdfFile,
        options,
      });

      console.error(chalk.red("❌ Error:"), errorMessage);
      process.exit(1);
    }
  });

program.parse();
