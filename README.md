# PDF to Image Converter API

A fast and efficient REST API built with Bun that converts PDF files to high-quality JPG images.

## 🌟 Features

- 🚀 **Fast conversion** using Bun runtime
- 📄 **Convert specific pages** or page ranges
- 🎨 **Customizable DPI** and JPG quality
- **CLI tool** for automation
- 📁 **Organized output** directory structure
- ✅ **Input validation** and error handling
- 🔒 **Secure processing** with automatic cleanup
- 🐛 **Comprehensive logging** for debugging and monitoring
- 🔧 **Debug mode** for detailed troubleshooting
- 📊 **System monitoring** and resource tracking
- 🆔 **Request tracing** with unique IDs
- 🕒 **Performance metrics** and timing information
- 📈 **Production monitoring** with resource usage logs
- 🚦 **Error tracking** with full context and stack traces
- 🛡️ **Docker ready** for easy deployment
- 🌐 **REST API** for integration with any frontend

## 🚀 Quick Start

### API Usage

```bash
# Convert PDF via API
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/api/convert

# Convert with custom settings
curl -X POST \
  -F "pdf=@document.pdf" \
  -F "dpi=300" \
  -F "quality=90" \
  -F "pages=1-5" \
  http://localhost:3000/api/convert
```

### CLI Usage

```bash
# Convert a PDF file
bun run cli sample.pdf

# Convert with custom settings
bun run cli sample.pdf -o ./images -d 600 -q 95 -p 1-5
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
   # API service
   bun run dev

   # CLI tool
   bun run cli --help
   ```

> **Note**: This is now an API-only service. The application uses `pdf2pic` which requires ImageMagick and Ghostscript. For local development on macOS, you may need to install these:
>
> ```bash
> brew install imagemagick ghostscript
> ```
>
> For production deployment, these dependencies are automatically installed in the Docker container.

## 🖥️ Usage

### API Service

1. **Start the API service**:

   ```bash
   bun start
   ```

2. **API Documentation**: Open `http://localhost:3000` for API documentation

3. **Health Check**: `GET http://localhost:3000/health`

4. **Convert PDF**: `POST http://localhost:3000/api/convert`

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
├── data/               # Persistent storage (mounted disk)
│   ├── uploads/        # Temporary file storage
│   └── output/         # Generated images
├── index.ts            # CLI interface
├── server.ts           # API server
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

# Health check
curl http://localhost:3000/health
```

### CLI Examples

```bash
# Convert a research paper
bun run cli research-paper.pdf -o ./research-images -d 300 -q 90

# Convert presentation slides
bun run cli presentation.pdf -o ./slides -d 150 -q 85 -p 1-20

# Convert specific pages
bun run cli document.pdf -o ./selected-pages -p 1,5,10-15
```

## � Debugging & Monitoring

### Enhanced Logging

The application includes comprehensive logging for debugging and monitoring:

- **Component-based logging**: [SERVER], [CONVERTER], [UTILS], [CLI]
- **Request tracing**: Unique request IDs for tracking
- **Performance metrics**: Processing time for all operations
- **Error tracking**: Full stack traces and context
- **System monitoring**: Resource usage and health metrics

### Debug Mode

Enable debug logging with the `DEBUG` environment variable:

```bash
# Enable debug mode
DEBUG=true bun run dev

# Or for production
DEBUG=true bun start
```

### Log Levels

| Level   | Color   | Description              |
| ------- | ------- | ------------------------ |
| INFO    | Blue    | General information      |
| SUCCESS | Green   | Successful operations    |
| WARN    | Yellow  | Warnings                 |
| ERROR   | Red     | Errors with stack traces |
| DEBUG   | Magenta | Detailed debugging info  |

### Monitoring Production

In production, the application automatically logs:

- System resource usage every 5 minutes
- Request/response metrics
- Error rates and patterns
- Cleanup operations
- Health check status

### Troubleshooting

Common debugging scenarios:

```bash
# Check server logs
docker logs pdf-to-image-app

# Filter by component
docker logs pdf-to-image-app | grep "\[CONVERTER\]"

# Filter by error level
docker logs pdf-to-image-app | grep "\[ERROR\]"

# Check system resources
curl http://localhost:3000/health | jq .memory
```

For detailed logging documentation, see [LOGGING.md](LOGGING.md).

## �🚀 Deployment

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
