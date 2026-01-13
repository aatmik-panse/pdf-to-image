import { describe, expect, test, mock, beforeAll, afterAll, beforeEach } from "bun:test";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// Mock child_process exec
const mockExec = mock((cmd, cb) => {
    if (cb) cb(null, { stdout: "", stderr: "" });
    return { stdout: null, stderr: null };
});

mock.module("child_process", () => {
    return {
        exec: mockExec
    };
});

describe("Converter (Poppler) Tests", () => {
    let tempDir: string;
    let pdfPath: string;
    let outputDir: string;
    let convertPdfToImages: any;

    beforeAll(async () => {
        // Dynamic import to ensure mock is applied
        const module = await import("../src/converter-poppler");
        convertPdfToImages = module.convertPdfToImages;

        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-to-image-conv-test-"));
        pdfPath = path.join(tempDir, "test.pdf");
        outputDir = path.join(tempDir, "output");
        await fs.writeFile(pdfPath, "dummy pdf content");
    });

    afterAll(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    beforeEach(async () => {
        mockExec.mockClear();
        // Clean output dir
        if (outputDir) {
            await fs.rm(outputDir, { recursive: true, force: true });
            await fs.mkdir(outputDir, { recursive: true });
        }
    });

    test("should convert all pages (default)", async () => {
        const prefix = "test";
        await fs.writeFile(path.join(outputDir, `${prefix}-1.jpg`), "img1");
        await fs.writeFile(path.join(outputDir, `${prefix}-2.jpg`), "img2");

        const result = await convertPdfToImages(pdfPath, {
            outputDir,
            dpi: 150,
            quality: 80,
            pages: "all",
            format: "jpg"
        });

        expect(mockExec).toHaveBeenCalled();
        const cmd = mockExec.mock.calls[0]?.[0];
        expect(cmd).toContain("pdftoppm -jpeg -jpegopt quality=80 -r 150");
        expect(cmd).toContain(pdfPath);

        expect(result.imageCount).toBe(2);
        expect(result.pagesConverted).toEqual([1, 2]);

        const files = await fs.readdir(outputDir);
        expect(files).toContain("test_page_001.jpg");
        expect(files).toContain("test_page_002.jpg");
        expect(files).not.toContain("test-1.jpg");
    });

    test("should convert specific pages", async () => {
        const prefix = "test";
        await fs.writeFile(path.join(outputDir, `${prefix}-1.jpg`), "img1");
        await fs.writeFile(path.join(outputDir, `${prefix}-3.jpg`), "img3");

        const result = await convertPdfToImages(pdfPath, {
            outputDir,
            dpi: 150,
            quality: 80,
            pages: "1,3",
            format: "jpg"
        });

        expect(mockExec).toHaveBeenCalledTimes(2);

        const files = await fs.readdir(outputDir);
        expect(files).toContain("test_page_001.jpg");
        expect(files).toContain("test_page_003.jpg");
        expect(result.imageCount).toBe(2);
    });

    test("should support png format", async () => {
        const prefix = "test";
        await fs.writeFile(path.join(outputDir, `${prefix}-1.png`), "img1");

        const result = await convertPdfToImages(pdfPath, {
            outputDir,
            dpi: 300,
            quality: 90,
            pages: "1",
            format: "png"
        });

        expect(mockExec).toHaveBeenCalled();
        const cmd = mockExec.mock.calls[0]?.[0];
        expect(cmd).toContain("-png");
        expect(cmd).not.toContain("-jpeg");

        const files = await fs.readdir(outputDir);
        expect(files).toContain("test_page_001.png");
        expect(result.format).toBe("png");
    });
});
