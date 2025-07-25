#!/usr/bin/env bun

// Create a simple test PDF using a basic HTML to PDF approach
// This is just for testing purposes

import { writeFile } from "fs/promises";

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Test PDF</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        p { line-height: 1.6; margin: 20px 0; }
        .page { page-break-after: always; }
    </style>
</head>
<body>
    <div class="page">
        <h1>Page 1: Welcome to PDF to Image Converter</h1>
        <p>This is a test PDF document created to demonstrate the PDF to Image conversion functionality.</p>
        <p>The converter supports various options like DPI settings, quality adjustments, and page selection.</p>
    </div>
    
    <div class="page">
        <h1>Page 2: Features</h1>
        <p>Key features of this converter:</p>
        <ul>
            <li>Fast conversion using Bun runtime</li>
            <li>Customizable DPI and quality settings</li>
            <li>Page range selection</li>
            <li>Beautiful CLI interface</li>
        </ul>
    </div>
    
    <div class="page">
        <h1>Page 3: Usage Examples</h1>
        <p>Example commands:</p>
        <pre>
bun start sample.pdf
bun start sample.pdf -o ./images -d 300 -q 90
bun start sample.pdf -p 1-2
        </pre>
    </div>
</body>
</html>
`;

await writeFile("test-document.html", htmlContent);
console.log(
  "Test HTML file created. You can convert it to PDF using a browser or online tool."
);
