// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    "https://affabffe2bc4c06ed2f40e7a33a58f6e@o4509972547043328.ingest.us.sentry.io/4509972547305472",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Performance monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions for performance monitoring

  // Environment
  environment: process.env.NODE_ENV || "production",

  // Release tracking - Railway specific
  release: process.env.RAILWAY_DEPLOYMENT_ID
    ? `railway-${process.env.RAILWAY_DEPLOYMENT_ID}`
    : process.env.FLY_APP_NAME
    ? `${process.env.FLY_APP_NAME}@${process.env.FLY_IMAGE_REF || "unknown"}`
    : undefined,

  // Additional configuration for better error tracking
  integrations: [
    Sentry.httpIntegration(),
    Sentry.nodeContextIntegration(),
    Sentry.localVariablesIntegration(),
    Sentry.consoleIntegration(),
  ],

  // Capture unhandled rejections
  captureUnhandledRejections: true,

  // Debug mode for development
  debug: process.env.NODE_ENV === "development",
});

export default Sentry;
