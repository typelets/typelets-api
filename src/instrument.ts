import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

// Only initialize Sentry if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Link errors to releases for better tracking
    release: process.env.npm_package_version || "1.0.0",

    integrations: [
      nodeProfilingIntegration(),
      // Automatic PostgreSQL query monitoring and performance tracking
      Sentry.postgresIntegration(),
      // Only capture unexpected console.error (logger uses breadcrumbs for structured logging)
      // This catches errors from third-party libraries or unexpected crashes
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
    ],

    // Send structured logs to Sentry
    enableLogs: true,
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: "trace",
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,

    // Set environment based on NODE_ENV
    environment: process.env.NODE_ENV || "development",
  });

  console.log("✅ Sentry monitoring initialized");
} else {
  console.log("⚠️  Sentry DSN not configured - error tracking disabled");
}
