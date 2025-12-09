import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execPromise = promisify(exec);

// Enhanced logging utility
const log = {
    info: (message: string, data?: any) => {
        console.log(
            chalk.blue(`[POPPLER] ${new Date().toISOString()}: ${message}`)
        );
        if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    },
    warn: (message: string, data?: any) => {
        console.log(
            chalk.yellow(`[POPPLER] ${new Date().toISOString()}: ${message}`)
        );
        if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    },
    error: (message: string, error?: any) => {
        console.log(
            chalk.red(`[POPPLER] ${new Date().toISOString()}: ${message}`)
        );
        if (error) {
            console.log(chalk.red(error.stack || error.message || error));
        }
    },
    debug: (message: string, data?: any) => {
        if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
            console.log(
                chalk.magenta(
                    `[POPPLER] ${new Date().toISOString()}: ${message}`
                )
            );
            if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
        }
    },
    success: (message: string, data?: any) => {
        console.log(
            chalk.green(`[POPPLER] ${new Date().toISOString()}: ${message}`)
        );
        if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    },
};

export interface ConvertOptions {
    outputDir: string;
    dpi: number;
    quality: number;
    pages: string;
    format: "jpg" | "png";
    maxConcurrency?: number;
}

export interface ConvertResult {
    outputDir: string;
    imageCount: number;
    pagesConverted: number[];
    format: string;
}

export async function convertPdfToImages(
    pdfPath: string,
    options: ConvertOptions
): Promise<ConvertResult> {
    const conversionStart = Date.now();
    const {
        outputDir,
        dpi,
        quality,
        pages,
        format,
    } = options;

    log.info(`🚀 Starting Poppler PDF conversion`, {
        pdfPath,
        outputDir,
        dpi,
        quality,
        pages,
        format,
    });

    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        // Parse page range
        const pageNumbers = parsePageRange(pages);

        log.info(`📄 Processing PDF with pdftoppm: ${path.basename(pdfPath)}`);

        // Prepare pdftoppm arguments
        const formatFlag = format === "png" ? "-png" : "-jpeg";
        // Construct quality option for jpeg
        // pdftoppm version check: assuming modern version available
        const jpegOpt = format === "jpg" ? `-jpegopt quality=${quality}` : "";

        const baseCmd = `pdftoppm ${formatFlag} ${jpegOpt} -r ${dpi}`;
        const outputPrefix = path.join(outputDir, path.basename(pdfPath, ".pdf"));

        const generatedFiles: string[] = [];
        const convertedPageNums: number[] = [];

        if (pageNumbers.length === 0) {
            // Convert all pages
            log.debug(`🔄 Converting all pages simultaneously`);
            const cmd = `${baseCmd} "${pdfPath}" "${outputPrefix}"`;
            await execPromise(cmd);
        } else {
            // Convert specific pages
            // Group contiguous pages to reduce invocations?
            // For simplicity, lets use -f and -l for ranges, or just loop if disjoint.
            // But pdftoppm doesn't support multiple disjoint ranges in one command.

            const ranges = getRanges(pageNumbers);
            log.debug(`🎯 Converting ranges: ${ranges.map(r => `${r.start}-${r.end}`).join(", ")}`);

            // We can run these in parallel
            await Promise.all(ranges.map(async (range) => {
                const cmd = `${baseCmd} -f ${range.start} -l ${range.end} "${pdfPath}" "${outputPrefix}"`;
                await execPromise(cmd);
            }));
        }

        // pdftoppm generates files like <prefix>-1.jpg, <prefix>-01.jpg etc.
        // The number of digits depends on the page count (usually matches digit count of max page?).
        // We need to standardize filenames or just return what we have?
        // server.ts expects us to return the directory and it will read files.
        // However, server.ts reads *all* files. We should ensure we only have our files there.
        // But since we created a fresh temp output dir in server.ts, it should be clean.

        // Let's verify what files were created and rename them to standard format: name_page_XXX.jpg
        // This matches converter-fast.ts logic and looks nicer.

        const files = await fs.readdir(outputDir);
        for (const file of files) {
            if (!file.endsWith(`.${format}`)) continue;

            // pdftoppm output format: prefix-N.jpg or prefix-0N.jpg
            // Regex to extract page number from end
            const match = file.match(/-(\d+)\.(jpg|png)$/);
            if (match) {
                const pageNum = parseInt(match[1] as string);
                const newFileName = `${path.basename(pdfPath, ".pdf")}_page_${pageNum.toString().padStart(3, "0")}.${format}`;

                if (file !== newFileName) {
                    await fs.rename(path.join(outputDir, file), path.join(outputDir, newFileName));
                }
                generatedFiles.push(newFileName);
                convertedPageNums.push(pageNum);
            }
        }

        const totalTime = Date.now() - conversionStart;

        const result = {
            outputDir,
            imageCount: generatedFiles.length,
            pagesConverted: convertedPageNums.sort((a, b) => a - b),
            format,
        };

        log.success(`🎉 Poppler conversion completed`, {
            result,
            totalTime: `${totalTime}ms`,
        });

        return result;

    } catch (error) {
        const totalTime = Date.now() - conversionStart;
        log.error(`💥 Poppler conversion failed`, {
            error: error instanceof Error ? error.message : error,
            pdfPath,
            options,
            processingTime: `${totalTime}ms`,
        });
        throw error;
    }
}

function parsePageRange(pageRange: string): number[] {
    if (pageRange === "all") return [];
    const pages: number[] = [];
    const parts = pageRange.split(",");
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes("-")) {
            const rangeParts = trimmed.split("-").map(p => parseInt(p.trim()));
            const start = rangeParts[0];
            const end = rangeParts[1];

            if (start !== undefined && end !== undefined && !isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) pages.push(i);
            }
        } else {
            const p = parseInt(trimmed);
            if (!isNaN(p)) pages.push(p);
        }
    }
    return [...new Set(pages)].sort((a, b) => a - b);
}

function getRanges(pages: number[]): { start: number, end: number }[] {
    if (pages.length === 0) return [];
    pages.sort((a, b) => a - b);

    const firstPage = pages[0];
    if (firstPage === undefined) return [];

    const ranges: { start: number, end: number }[] = [];
    let start = firstPage;
    let prev = firstPage;

    for (let i = 1; i < pages.length; i++) {
        const current = pages[i];
        if (current === undefined) continue;

        if (current !== prev + 1) {
            ranges.push({ start, end: prev });
            start = current;
        }
        prev = current;
    }
    ranges.push({ start, end: prev });
    return ranges;
}
