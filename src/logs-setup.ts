// Minimal setup for OpenTelemetry logs (auto-instrumentation handles traces/metrics)
import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Only set up logs if OTEL is configured
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  console.log("🔍 OTEL Debug - Endpoint:", process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  console.log("🔍 OTEL Debug - Headers set:", !!process.env.OTEL_EXPORTER_OTLP_HEADERS);
  console.log("🔍 OTEL Debug - Service name:", process.env.OTEL_SERVICE_NAME);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "typelets-api",
  });

  const logExporter = new OTLPLogExporter();

  // Add error handling to the exporter
  const originalExport = logExporter.export.bind(logExporter);
  logExporter.export = (logs, resultCallback) => {
    console.log(`📤 Attempting to export ${logs.length} log records to OTLP...`);
    originalExport(logs, (result) => {
      if (result.code === 0) {
        console.log(`✅ Successfully exported ${logs.length} logs to Grafana`);
      } else {
        console.error(`❌ Failed to export logs:`, result.error);
      }
      resultCallback(result);
    });
  };

  // Configure batch processor with shorter intervals for testing
  const logRecordProcessor = new BatchLogRecordProcessor(logExporter, {
    maxExportBatchSize: 30, // Export when we have 30 logs
    maxQueueSize: 100,
    scheduledDelayMillis: 5000, // Export every 5 seconds (default is 30s)
  });

  const loggerProvider = new LoggerProvider({
    resource,
    logRecordProcessors: [logRecordProcessor],
  });

  logs.setGlobalLoggerProvider(loggerProvider);

  console.log("✅ OpenTelemetry logs configured");

  // Test: emit a log immediately to verify OTLP connection
  const testLogger = loggerProvider.getLogger("test-logger");
  testLogger.emit({
    severityNumber: 9, // INFO
    severityText: "INFO",
    body: "🧪 Test log - OTLP connection verification",
    attributes: { test: true },
  });
  console.log("🧪 Test log emitted - should export in ~5 seconds");
}
