// Minimal setup for OpenTelemetry logs (auto-instrumentation handles traces/metrics)
import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Only set up logs if OTEL is configured
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "typelets-api",
  });

  const logExporter = new OTLPLogExporter();
  const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

  const loggerProvider = new LoggerProvider({
    resource,
    logRecordProcessors: [logRecordProcessor],
  });

  logs.setGlobalLoggerProvider(loggerProvider);

  console.log("✅ OpenTelemetry logs configured");
}
