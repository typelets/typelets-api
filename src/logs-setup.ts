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

  const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

  const loggerProvider = new LoggerProvider({
    resource,
    logRecordProcessors: [logRecordProcessor],
  });

  logs.setGlobalLoggerProvider(loggerProvider);

  console.log("✅ OpenTelemetry logs configured");
}
