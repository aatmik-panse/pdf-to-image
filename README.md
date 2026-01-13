# PDF to Image Converter API

A high-performance REST API and CLI tool built with Bun that converts PDF files to high-quality JPG or PNG images using `pdftoppm` (Poppler).

## 🌟 Features

- 🚀 **High-Speed Conversion**: Uses `pdftoppm` (Poppler) for ultra-fast, multi-threaded processing.
- 🖼️ **Multiple Formats**: Support for both **JPG** (compressed) and **PNG** (lossless) output.
- ☁️ **Cloud Native**: Integrated Google Cloud Storage (GCS) for stateless operation (perfect for Render/Heroku).
- 📄 **Flexible Page Handling**: Convert specific pages, ranges, or the entire document.
- 🎨 **High Quality**: Customizable DPI and compression settings.
- 🐳 **Docker Ready**: Production-ready container with all dependencies included.
- 🔍 **Comprehensive Logging**: Detailed request tracing and performance metrics.
- 🛠️ **CLI Tool**: Includes a powerful command-line interface for local batch processing.

## ☁️ Cloud Storage Integration

This application uses Google Cloud Storage (GCS) for both input and output files, making it perfect for auto-scaling environments like Render where persistent disk storage is not available.

### Benefits of Cloud Storage

- **Stateless Application**: No dependency on local disk storage
- **Auto-scaling Friendly**: Works seamlessly with Render's auto-scaling
- **Improved Reliability**: Files persist even when instances are restarted
- **Better Performance**: Offloads file storage operations from application servers
- **Automatic Cleanup**: Configurable retention policy to keep storage costs low

### Setup for Google Cloud Storage

1. **Create a GCS bucket**:
   ```bash
   gsutil mb -p your-project-id gs://pdf-to-image-converter
   ```

2. **Create a service account** with Storage Admin permissions

3. **Configure environment variables**:
   - For local development: Use `GCS_KEY_FILE` pointing to your service account key
   - For Render deployment: Use `GCS_CREDENTIALS` with the JSON content of your service account key

## 🚀 Quick Start

### API Usage

```bash
# Convert PDF to JPG (default)
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/api/convert

# Convert to PNG with custom settings
curl -X POST \
  -F "pdf=@document.pdf" \
  -F "format=png" \
  -F "dpi=300" \
  -F "pages=1-5" \
  http://localhost:3000/api/convert
```

### CLI Usage

```bash
# Basic conversion
bun run cli sample.pdf

# Convert to PNG with high DPI
bun run cli sample.pdf -f png -d 600

# Complex conversion (specific pages, output dir)
bun run cli sample.pdf -o ./images -p 1,3,5-10 -q 90
```

## 📦 Installation & Setup

### Local Development

1. **Install Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Install System Dependencies (Poppler)**:
   The application uses `pdftoppm` for conversion. You need to install Poppler:
   ```bash
   # macOS
   brew install poppler

   # Ubuntu/Debian
   sudo apt-get install poppler-utils
   ```

3. **Install Dependencies**:
   ```bash
   bun install
   ```

4. **Run the Application**:
   ```bash
   # Start API server
   bun run dev

   # Run CLI tool
   bun run cli --help
   ```

### Production Deployment (Render)

This application is optimized for Render's auto-scaling environment:

1. **Create a new Web Service** on Render and connect your repo.
2. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3000
   GCS_PROJECT_ID=your-project-id
   GCS_BUCKET_NAME=pdf-to-image-converter
   GCS_CREDENTIALS={"type":"service_account",...}
   ```
3. **Deploy**: Render will automatically use the `render.yaml` configuration and `Dockerfile` to build the environment with all necessary dependencies.

## 🖥️ API Documentation

### POST /api/convert

Converts a PDF file to images.

**Body Parameters (multipart/form-data):**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pdf` | File | Required | The PDF file to convert. |
| `format` | String | `jpg` | Output format: `jpg` or `png`. |
| `dpi` | Number | `150` | Resolution in DPI (max 300). |
| `quality` | Number | `80` | JPG quality 1-100 (max 85). |
| `pages` | String | `all` | Pages to convert (e.g., `1`, `1-5`, `1,3,5`). |
| `fast` | Boolean | `true` | Enable fast mode (Poppler engine). |

**Response:**
Returns a JSON object containing signed URLs for the generated images stored in GCS.

### GET /health

Health check endpoint returning system status and memory usage.

## 🛠️ CLI Options

```bash
Usage: pdf-to-image [options] <pdf-file>

Arguments:
  pdf-file                 Path to the PDF file to convert

Options:
  -o, --output <dir>       Output directory for images (default: "./output")
  -d, --dpi <number>       DPI resolution for images (default: "300")
  -q, --quality <number>   JPG quality (1-100) (default: "90")
  -f, --format <type>      Output format (jpg, png) (default: "jpg")
  -p, --pages <range>      Page range to convert (e.g., 1-3 or 1,3,5) (default: "all")
  -h, --help               display help for command
```

## 🏗️ Project Structure

```
pdf-to-image/
├── src/
│   ├── converter-poppler.ts # Core Poppler conversion logic
│   ├── storage.ts           # GCS storage management
│   ├── utils.ts             # Validation utilities
│   └── types.d.ts           # TypeScript definitions
├── index.ts                 # CLI entry point
├── server.ts                # API server entry point
├── Dockerfile               # Production container config
└── ...
```

## 🔧 Debugging & Monitoring

The application includes comprehensive logging:

- **Component-based logging**: [SERVER], [POPPLER], [CLI]
- **Request Tracing**: Unique IDs for every API request
- **Debug Mode**: Set `DEBUG=true` for verbose logs

To view logs in Docker:
```bash
docker logs pdf-to-image-app
```

## 🐳 Docker Support

Build and run locally with Docker:

```bash
docker-compose up --build
```
This will start the service on port 3000 with all dependencies pre-installed.

## License

MIT License
