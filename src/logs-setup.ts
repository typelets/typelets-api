// Minimal setup for OpenTelemetry logs (auto-instrumentation handles traces/metrics)
import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Only set up logs if OTEL is configured
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "typelets-api",
  });

  // Explicitly configure the exporter with endpoint
  const logExporter = new OTLPLogExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
  });

  // Use SimpleLogRecordProcessor for immediate export (no batching)
  const logRecordProcessor = new SimpleLogRecordProcessor(logExporter);

  const loggerProvider = new LoggerProvider({
    resource,
    logRecordProcessors: [logRecordProcessor],
  });

  logs.setGlobalLoggerProvider(loggerProvider);
}
