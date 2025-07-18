# PDF to Image Converter

A fast and efficient Node.js application built with Bun that converts PDF files to high-quality JPG images. Available as both a CLI tool and a web service.

## 🌟 Features

- 🚀 **Fast conversion** using Bun runtime
- 📄 **Convert specific pages** or page ranges
- 🎨 **Customizable DPI** and JPG quality
- 💻 **Beautiful web interface** with drag-and-drop
- 🔧 **CLI tool** for automation
- 📁 **Organized output** directory structure
- ✅ **Input validation** and error handling
- 🔒 **Secure processing** with automatic cleanup
- 📱 **Responsive design** for mobile devices
- 🐳 **Docker ready** for easy deployment

## 🚀 Quick Start

### Web Interface (Production)

Visit the deployed application at: [Your Render URL]

### CLI Usage

```bash
# Convert a PDF file
bun run cli sample.pdf

# Convert with custom settings
bun run cli sample.pdf -o ./images -d 600 -q 95 -p 1-5
```

### Web Service (API)

```bash
# Convert PDF via API
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/api/convert
```

## 📦 Installation & Setup

### Production Deployment (Render)

1. **Fork/Clone this repository**
2. **Deploy to Render**:
   - Connect your GitHub repository to Render
   - Render will automatically detect the `render.yaml` configuration
   - Your app will be deployed with Docker

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

### Local Development

1. **Install Bun**:

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Install project dependencies**:

   ```bash
   bun install
   ```

3. **Run the application**:

   ```bash
   # Web service (with UI)
   bun run dev

   # CLI tool
   bun run cli --help
   ```

> **Note**: This application uses `pdf2pic` which requires ImageMagick and Ghostscript. For local development on macOS, you may need to install these:
>
> ```bash
> brew install imagemagick ghostscript
> ```
>
> For production deployment, these dependencies are automatically installed in the Docker container.

## 🖥️ Usage

### Web Interface

1. **Start the web service**:

   ```bash
   bun start
   ```

2. **Open your browser** and go to `http://localhost:3000`

3. **Upload a PDF file** using the drag-and-drop interface or file picker

4. **Configure settings**:

   - DPI: 150 (fast), 300 (standard), 600 (high quality)
   - Quality: 70-95% JPG compression
   - Pages: "all", "1-5", "1,3,5", etc.

5. **Download converted images** individually or all at once

### CLI Tool

Convert a PDF to JPG images:

```bash
bun run cli sample.pdf
```

### Advanced CLI Usage

```bash
# Specify output directory
bun run cli sample.pdf -o ./my-images

# Set custom DPI (default: 300)
bun run cli sample.pdf -d 600

# Set JPG quality (default: 90)
bun run cli sample.pdf -q 95

# Convert specific pages
bun run cli sample.pdf -p 1,3,5

# Convert page range
bun run cli sample.pdf -p 1-5

# Combine options
bun run cli sample.pdf -o ./output -d 300 -q 95 -p 1-10
```

### API Usage

```bash
# Convert PDF via REST API
curl -X POST \
  -F "pdf=@document.pdf" \
  -F "dpi=300" \
  -F "quality=90" \
  -F "pages=all" \
  http://localhost:3000/api/convert
```

### CLI Options

| Option                   | Description                 | Default    |
| ------------------------ | --------------------------- | ---------- |
| `-o, --output <dir>`     | Output directory for images | `./output` |
| `-d, --dpi <number>`     | DPI resolution for images   | `300`      |
| `-q, --quality <number>` | JPG quality (1-100)         | `90`       |
| `-p, --pages <range>`    | Pages to convert            | `all`      |

### Page Range Examples

- `all` - Convert all pages
- `1` - Convert only page 1
- `1,3,5` - Convert pages 1, 3, and 5
- `1-5` - Convert pages 1 through 5
- `1-3,7,10-12` - Convert pages 1-3, 7, and 10-12

## 🏗️ Project Structure

```
pdf-to-image/
├── src/
│   ├── converter.ts    # Main conversion logic
│   ├── utils.ts        # Utility functions
│   └── types.d.ts      # Type definitions
├── public/
│   └── index.html      # Web interface
├── uploads/            # Temporary file storage
├── output/             # Generated images
├── index.ts            # CLI interface
├── server.ts           # Web server
├── Dockerfile          # Docker configuration
├── render.yaml         # Render deployment config
├── docker-compose.yml  # Local development
├── DEPLOYMENT.md       # Deployment guide
└── README.md
```

## 🔧 Development

### Available Scripts

- `bun start` - Start the web service
- `bun run dev` - Start in development mode with auto-reload
- `bun run cli` - Run the CLI tool
- `bun run build` - Build for production

### Docker Development

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access the application
open http://localhost:3000
```

### Building for Production

```bash
bun run build
```

This creates a `dist` folder with the compiled output.

## 🎯 Examples

### Web Interface Examples

1. **Basic Conversion**: Upload a PDF and convert all pages at 300 DPI
2. **High Quality**: Set DPI to 600 and quality to 95% for print-ready images
3. **Specific Pages**: Convert only pages 1-5 from a large document
4. **Batch Processing**: Convert multiple PDFs using the API

### CLI Examples

```bash
# Convert a research paper
bun run cli research-paper.pdf -o ./research-images -d 300 -q 90

# Convert presentation slides
bun run cli presentation.pdf -o ./slides -d 150 -q 85 -p 1-20

# Convert specific pages
bun run cli document.pdf -o ./selected-pages -p 1,5,10-15
```

### API Examples

```bash
# Convert with default settings
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/api/convert

# Convert with custom settings
curl -X POST \
  -F "pdf=@document.pdf" \
  -F "dpi=600" \
  -F "quality=95" \
  -F "pages=1-10" \
  http://localhost:3000/api/convert
```

## 🚀 Deployment

### Render (Recommended)

1. **Fork this repository** to your GitHub account

2. **Connect to Render**:

   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Select your forked repository
   - Render will automatically use the `render.yaml` configuration

3. **Configure Environment Variables** (optional):

   - `ALLOWED_ORIGINS`: Your domain(s)
   - `RATE_LIMIT_MAX_REQUESTS`: API rate limit

4. **Deploy**: Click "Apply" and wait for deployment

### Other Platforms

The application is containerized and can be deployed on:

- **Heroku**: Use the included Dockerfile
- **Railway**: Connect your GitHub repository
- **DigitalOcean**: Use Docker deployment
- **AWS/GCP**: Deploy using container services

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)

## 🛡️ Security Features

- **Input validation** for file types and sizes
- **Rate limiting** to prevent abuse
- **Automatic file cleanup** after processing
- **CORS protection** with configurable origins
- **Helmet.js** for security headers
- **No persistent storage** of user files

## 📊 Performance Tips

- Use **lower DPI** (150-300) for faster conversion
- Convert **specific pages** instead of entire documents when possible
- Use **appropriate quality** settings (85-95 for most use cases)
- Monitor **resource usage** and scale accordingly

## 🔧 Error Handling

The application includes comprehensive error handling for:

- Invalid PDF files
- Missing files
- Invalid page ranges
- Directory creation issues
- Conversion errors
- Network timeouts
- File size limits

## 🐳 Docker Support

```bash
# Build the Docker image
docker build -t pdf-to-image .

# Run the container
docker run -p 3000:3000 pdf-to-image

# Using Docker Compose
docker-compose up --build
```

## License

MIT License - feel free to use this project for any purpose.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

If you encounter any issues, please check:

1. Dependencies are properly installed (`bun install`)
2. The PDF file is valid and accessible
3. You have write permissions to the output directory

For additional help, please open an issue in the repository.
