# Logging Configuration

This application uses comprehensive logging to help with debugging and monitoring.

## Log Levels

- **INFO** (Blue): General information about operations
- **SUCCESS** (Green): Successful operations completion
- **WARN** (Yellow): Warnings that don't prevent operation
- **ERROR** (Red): Errors that prevent operation
- **DEBUG** (Magenta): Detailed debugging information

## Log Components

Each log entry includes:

- **Component**: [SERVER], [CONVERTER], [UTILS], [CLI]
- **Timestamp**: ISO 8601 format
- **Message**: Human-readable description
- **Data**: Additional structured data (JSON)

## Environment Variables

- `NODE_ENV=production`: Disables debug logs by default
- `DEBUG=true`: Forces debug logs even in production
- `PORT=3000`: Server port (default: 3000)

## Log Examples

```bash
# Server startup
[INFO] 2025-07-18T10:30:00.000Z: 🚀 PDF to Image API Server started successfully

# Request processing
[INFO] 2025-07-18T10:30:15.123Z: 🔵 Incoming request
[CONVERTER] 2025-07-18T10:30:15.456Z: 🚀 Starting PDF to image conversion
[SUCCESS] 2025-07-18T10:30:18.789Z: 🎉 Conversion request completed successfully

# Error handling
[ERROR] 2025-07-18T10:30:20.123Z: 💥 Conversion error occurred
```

## Debugging Tips

1. **Enable debug logs**: Set `DEBUG=true` environment variable
2. **Check request IDs**: Each request gets a unique ID for tracking
3. **Monitor timing**: All operations include processing time
4. **System resources**: Production mode logs resource usage every 5 minutes
5. **Error tracking**: Full stack traces and context are logged

## Production Monitoring

The application automatically logs:

- System resource usage (memory, CPU)
- Request/response metrics
- Error rates and types
- Cleanup operations
- Health check status

## Log Analysis

Use these commands to analyze logs:

```bash
# Filter by log level
grep "\[ERROR\]" application.log

# Filter by component
grep "\[CONVERTER\]" application.log

# Filter by request ID
grep "abc123def" application.log

# Show only timing information
grep "processingTime\|totalTime" application.log
```
