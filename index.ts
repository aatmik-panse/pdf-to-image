import { program } from "commander";
import chalk from "chalk";
import { validatePdfFile } from "./src/utils";
import { convertPdfToImages } from "./src/converter";

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
    try {
      console.log(chalk.blue("🔄 Starting PDF to Image conversion..."));

      // Validate PDF file
      await validatePdfFile(pdfFile);

      // Convert PDF to images
      const result = await convertPdfToImages(pdfFile, {
        outputDir: options.output,
        dpi: parseInt(options.dpi),
        quality: parseInt(options.quality),
        pages: options.pages,
      });

      console.log(chalk.green("✅ Conversion completed successfully!"));
      console.log(chalk.cyan(`📁 Output directory: ${result.outputDir}`));
      console.log(chalk.cyan(`🖼️  Images created: ${result.imageCount}`));
      console.log(
        chalk.cyan(`📄 Pages converted: ${result.pagesConverted.join(", ")}`)
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error(chalk.red("❌ Error:"), errorMessage);
      process.exit(1);
    }
  });

program.parse();
