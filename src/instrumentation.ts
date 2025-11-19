import { NodeSDK, logs } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const { BatchLogRecordProcessor } = logs;

// Only initialize OpenTelemetry in production (unless OTEL_ENABLED is explicitly set to "true")
const isProduction = process.env.NODE_ENV === "production";
const otelExplicitlyEnabled = process.env.OTEL_ENABLED === "true";
const shouldEnableOtel =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT && (isProduction || otelExplicitlyEnabled);

if (shouldEnableOtel) {
  const serviceName = process.env.OTEL_SERVICE_NAME || "typelets-api";
  const serviceVersion = process.env.npm_package_version || "1.0.0";
  const environment = process.env.NODE_ENV || "development";

  // Create resource with service information
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    environment: environment, // Tag all data with environment
  });

  // Configure trace exporter for Grafana Cloud
  const traceExporter = new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    headers: {
      Authorization: `Basic ${process.env.GRAFANA_CLOUD_API_KEY}`,
    },
  });

  // Configure metrics exporter for Grafana Cloud
  const metricExporter = new OTLPMetricExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
    headers: {
      Authorization: `Basic ${process.env.GRAFANA_CLOUD_API_KEY}`,
    },
  });

  // Configure logs exporter for Grafana Cloud
  const logExporter = new OTLPLogExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
    headers: {
      Authorization: `Basic ${process.env.GRAFANA_CLOUD_API_KEY}`,
    },
  });

  // Initialize OpenTelemetry SDK
  try {
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // Export metrics every 60 seconds
      }),
      logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
      instrumentations: [
        getNodeAutoInstrumentations({
          // Automatic instrumentation for HTTP, gRPC, database clients, etc.
          "@opentelemetry/instrumentation-http": {
            enabled: true,
          },
          "@opentelemetry/instrumentation-express": {
            enabled: false, // We're using Hono, not Express
          },
          "@opentelemetry/instrumentation-pg": {
            enabled: true, // PostgreSQL instrumentation
          },
          "@opentelemetry/instrumentation-redis": {
            enabled: true, // Redis instrumentation for Upstash
          },
        }),
      ],
    });

    // Start the SDK (synchronous operation)
    sdk.start();

    console.log("✅ OpenTelemetry initialized with Grafana Cloud");
    console.log(`📊 Service: ${serviceName} (v${serviceVersion})`);
    console.log(`🌍 Environment: ${environment}`);
    console.log(`🔗 Endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);

    // Graceful shutdown
    process.on("SIGTERM", () => {
      sdk
        .shutdown()
        .then(() => console.log("OpenTelemetry SDK shut down successfully"))
        .catch((error) => console.error("Error shutting down OpenTelemetry SDK:", error))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    console.error("❌ Error initializing OpenTelemetry SDK:", error);
    console.error("   OpenTelemetry will be disabled. Application will continue without observability.");
  }
} else {
  const reason = !process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? "OTEL_EXPORTER_OTLP_ENDPOINT not set"
    : process.env.NODE_ENV !== "production" && process.env.OTEL_ENABLED !== "true"
      ? `Running in ${process.env.NODE_ENV || "development"} mode (set OTEL_ENABLED=true to enable)`
      : "Unknown reason";

  console.log("⚠️  OpenTelemetry not initialized - observability disabled");
  console.log(`   Reason: ${reason}`);
  console.log("   To enable in production: Set OTEL_EXPORTER_OTLP_ENDPOINT and GRAFANA_CLOUD_API_KEY");
  console.log("   To enable in development: Set OTEL_ENABLED=true (not recommended)");
}
