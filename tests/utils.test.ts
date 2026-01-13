import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { validatePdfFile, formatFileSize, createOutputFilename } from "../src/utils";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

describe("Utils Tests", () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-to-image-test-"));
    });

    afterAll(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe("formatFileSize", () => {
        test("should format 0 bytes", () => {
            expect(formatFileSize(0)).toBe("0 Bytes");
        });

        test("should format bytes", () => {
            expect(formatFileSize(500)).toBe("500 Bytes");
        });

        test("should format KB", () => {
            expect(formatFileSize(1024)).toBe("1 KB");
            expect(formatFileSize(1536)).toBe("1.5 KB");
        });

        test("should format MB", () => {
            expect(formatFileSize(1024 * 1024)).toBe("1 MB");
        });
    });

    describe("createOutputFilename", () => {
        test("should create filename with default extension", () => {
            const filename = createOutputFilename("test.pdf", 1);
            expect(filename).toBe("test_page_001.jpg");
        });

        test("should create filename with specified extension", () => {
            const filename = createOutputFilename("test.pdf", 2, "png");
            expect(filename).toBe("test_page_002.png");
        });

        test("should pad page numbers", () => {
            const filename = createOutputFilename("doc.pdf", 12);
            expect(filename).toBe("doc_page_012.jpg");
        });
    });

    describe("validatePdfFile", () => {
        test("should validate existing pdf file", async () => {
            const filePath = path.join(tempDir, "valid.pdf");
            await fs.writeFile(filePath, "dummy content");
            // The function only checks extension and checks fs.stat.
            // It doesn't inspect magic bytes in the current implementation (checked source).
            await expect(validatePdfFile(filePath)).resolves.toBeUndefined();
        });

        test("should throw error if file does not exist", async () => {
            const filePath = path.join(tempDir, "nonexistent.pdf");
            await expect(validatePdfFile(filePath)).rejects.toThrow();
        });

        test("should throw error if invalid extension", async () => {
            const filePath = path.join(tempDir, "image.jpg");
            await fs.writeFile(filePath, "dummy content");
            await expect(validatePdfFile(filePath)).rejects.toThrow("File must be a PDF");
        });

        test("should throw error if path is directory", async () => {
            const dirPath = path.join(tempDir, "some-dir.pdf");
            await fs.mkdir(dirPath);
            await expect(validatePdfFile(dirPath)).rejects.toThrow("Path is not a file");
        });
    });
});
