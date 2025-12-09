# Deployment Guide for PDF to Image Converter

## Render Deployment

### Option 1: Using render.yaml (Recommended)

1. **Push to GitHub**:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/pdf-to-image-converter.git
   git push -u origin main
   ```

2. **Deploy to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file
   - Click "Apply" to deploy

### Option 2: Manual Web Service Creation

1. **Create a new Web Service**:

   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure the service**:

   - **Name**: `pdf-to-image-converter`
   - **Environment**: `Docker`
   - **Branch**: `main`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: `Starter` (or higher for better performance)

3. **Environment Variables**:

   ```
   NODE_ENV=production
   PORT=3000
   ALLOWED_ORIGINS=https://your-app-name.onrender.com
   ```

4. **Health Check**:
   - **Health Check Path**: `/health`

## Local Development

### Using Docker Compose

1. **Build and run**:

   ```bash
   docker-compose up --build
   ```

2. **Access the application**:
   - Open http://localhost:3000

### Using Bun directly

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Run the development server**:
   ```bash
   bun run dev
   ```

> **Note**: For local development, you may need to install ImageMagick and Ghostscript:
>
> ```bash
> # macOS
> brew install imagemagick ghostscript
>
> # Ubuntu/Debian
> sudo apt-get install imagemagick ghostscript
> ```

## Production Considerations

### Performance Optimization

1. **Scaling**:

   - Use horizontal scaling with multiple instances
   - Configure auto-scaling based on CPU/memory usage
   - Consider using a CDN for static assets

2. **File Storage**:

   - For high-volume usage, consider using cloud storage (AWS S3, Google Cloud Storage)
   - Implement proper file cleanup policies
   - Monitor disk usage

3. **Security**:
   - Enable HTTPS (automatic on Render)
   - Configure proper CORS origins
   - Implement proper rate limiting
   - Regular security updates

### Monitoring

1. **Health Checks**:

   - The app includes a `/health` endpoint
   - Monitor response times and error rates

2. **Logs**:

   - Check application logs for errors
   - Monitor file upload/conversion patterns

3. **Resource Usage**:
   - Monitor CPU and memory usage
   - Watch disk space for temporary files

### Environment Variables

Create a `.env` file in production with:

```bash
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10
MAX_FILE_SIZE_MB=100
CLEANUP_INTERVAL_HOURS=1
MAX_FILE_AGE_HOURS=1
```

## API Documentation

### Endpoints

1. **GET /health**

   - Health check endpoint
   - Returns: `{ "status": "healthy", "timestamp": "..." }`

2. **POST /api/convert**

   - Convert PDF to images
   - Content-Type: `multipart/form-data`
   - Body:
     - `pdf`: PDF file (required)
     - `dpi`: DPI setting (optional, default: 300)
     - `quality`: JPG quality (optional, default: 90)
     - `pages`: Page range (optional, default: "all")
   - Returns: JSON with conversion results and image URLs

3. **GET /output/{folder}/{filename}**
   - Download converted images
   - Returns: JPG image file

### Usage Examples

```bash
# Convert entire PDF
curl -X POST -F "pdf=@document.pdf" http://localhost:3000/api/convert

# Convert with custom settings
curl -X POST \
  -F "pdf=@document.pdf" \
  -F "dpi=600" \
  -F "quality=95" \
  -F "pages=1-5" \
  http://localhost:3000/api/convert
```

## Troubleshooting

### Common Issues
 
 1. **Poppler errors**:
 
    - Ensure `poppler-utils` (Debian/Ubuntu) or `poppler` (macOS) is installed
    - Check Docker container includes this dependency
    - Verify system PATH includes `pdftoppm` binary

2. **File upload failures**:

   - Check file size limits (default: 100MB)
   - Verify PDF file is not corrupted
   - Check disk space

3. **Conversion errors**:

   - Verify PDF is not password-protected
   - Check if PDF contains valid pages
   - Monitor server logs for specific errors

4. **Performance issues**:
   - Reduce DPI for faster conversion
   - Limit concurrent conversions
   - Consider upgrading instance type

### Logs

```bash
# View application logs on Render
# Go to your service dashboard and check the "Logs" tab

# Local development logs
docker-compose logs -f pdf-converter
```

## Cost Optimization

### Render Pricing

- **Starter Plan**: $7/month - Good for low-medium traffic
- **Standard Plan**: $25/month - Better performance and scaling
- **Professional Plan**: $85/month - High performance applications

### Tips

1. Use appropriate instance sizes based on usage
2. Implement efficient file cleanup
3. Consider caching for frequently converted files
4. Monitor usage patterns and optimize accordingly

## Security Best Practices

1. **File Validation**:

   - Validate file types and sizes
   - Scan for malicious content
   - Implement virus scanning for production

2. **Rate Limiting**:

   - Limit requests per IP
   - Implement user-based quotas
   - Monitor for abuse patterns

3. **Data Privacy**:
   - Automatic file deletion after processing
   - No persistent storage of user files
   - Secure file transfer protocols

## Backup and Recovery

1. **Configuration Backup**:

   - Store environment variables securely
   - Version control for all code changes
   - Document deployment procedures

2. **Monitoring Setup**:
   - Set up alerts for service downtime
   - Monitor error rates and response times
   - Regular health checks

## Support

For deployment issues:

1. Check the Render documentation
2. Review application logs
3. Verify environment variables
4. Test with simple PDF files first

Remember to replace placeholder values (like repository URLs and domain names) with your actual values before deployment.
