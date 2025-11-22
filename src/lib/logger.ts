import { trace, context } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

interface LogLevel {
  level: string;
  priority: number;
  severity: SeverityNumber;
}

type LogMetadata = Record<string, string | number | boolean>;

// Headers that should be redacted for security
const SENSITIVE_HEADER_PATTERNS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-client-secret",
  "x-api-key",
  "api-key",
  "authentication",
  "proxy-authorization",
  "x-auth-token",
];

/**
 * Sanitize headers by redacting sensitive values (tokens, secrets, cookies)
 */
export function sanitizeHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  // Convert headers to entries array based on type
  let entries: [string, string][];
  if (headers instanceof Headers) {
    entries = [];
    headers.forEach((value, key) => {
      entries.push([key, value]);
    });
  } else {
    entries = Object.entries(headers);
  }

  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();

    // Check if this header should be redacted
    const isSensitive = SENSITIVE_HEADER_PATTERNS.some((pattern) => lowerKey.includes(pattern));

    if (isSensitive) {
      // Show that the header was present but redact the value
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

const LOG_LEVELS: Record<string, LogLevel> = {
  error: { level: "error", priority: 0, severity: SeverityNumber.ERROR },
  warn: { level: "warn", priority: 1, severity: SeverityNumber.WARN },
  info: { level: "info", priority: 2, severity: SeverityNumber.INFO },
  debug: { level: "debug", priority: 3, severity: SeverityNumber.DEBUG },
};

class Logger {
  private environment: string;
  private currentLogLevel: LogLevel;
  private serviceName: string;
  private serviceVersion: string;
  private otelLogger: ReturnType<ReturnType<typeof logs.getLoggerProvider>["getLogger"]> | null =
    null;
  private otelLoggerInitialized: boolean = false;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.serviceName = process.env.OTEL_SERVICE_NAME || "typelets-api";
    this.serviceVersion = process.env.npm_package_version || "1.0.0";

    // Set log level based on environment
    const logLevelName =
      process.env.LOG_LEVEL || (this.environment === "production" ? "info" : "debug");
    this.currentLogLevel = LOG_LEVELS[logLevelName] || LOG_LEVELS.info;
  }

  // Lazy-load OpenTelemetry logger on first use (after OTEL SDK is initialized)
  private getOtelLogger(): ReturnType<
    ReturnType<typeof logs.getLoggerProvider>["getLogger"]
  > | null {
    if (this.otelLoggerInitialized) {
      return this.otelLogger;
    }

    try {
      const loggerProvider = logs.getLoggerProvider();
      this.otelLogger = loggerProvider.getLogger(this.serviceName, this.serviceVersion);
      this.otelLoggerInitialized = true;
      if (this.environment === "development") {
        console.log("✅ OpenTelemetry logger initialized for application logs");
      }
    } catch {
      // OpenTelemetry not initialized, fall back to console logging
      this.otelLogger = null;
      this.otelLoggerInitialized = true;
    }

    return this.otelLogger;
  }

  private shouldLog(level: LogLevel): boolean {
    return level.priority <= this.currentLogLevel.priority;
  }

  private normalizePath(path: string): string {
    // Take first two path segments and replace UUIDs/IDs with {id}
    const segments = path.split("/").filter((s) => s.length > 0);
    const normalized = segments
      .slice(0, 2)
      .map((segment) => {
        // Replace UUIDs, numeric IDs, or other dynamic identifiers with {id}
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
          /^\d+$/.test(segment) ||
          /^[a-zA-Z0-9_-]{20,}$/.test(segment)
        ) {
          return "{id}";
        }
        return segment;
      })
      .join("/");

    return `/${normalized}`;
  }

  private getTraceContext(): { trace_id?: string; span_id?: string } {
    try {
      const span = trace.getSpan(context.active());
      if (span) {
        const spanContext = span.spanContext();
        return {
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
        };
      }
    } catch {
      // OpenTelemetry not initialized or no active span
    }
    return {};
  }

  private log(level: LogLevel, message: string, meta: LogMetadata = {}, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const traceContext = this.getTraceContext();

    // Grafana/Loki standardized log structure
    const logData: Record<string, unknown> = {
      // Timestamps - ISO 8601 format
      timestamp: new Date().toISOString(),
      "@timestamp": new Date().toISOString(), // For Elasticsearch/Loki compatibility

      // Service identification (critical for Grafana)
      service: this.serviceName,
      service_name: this.serviceName, // Alternative field name
      service_version: this.serviceVersion,
      environment: this.environment,

      // Log level
      level: level.level,
      severity: level.level.toUpperCase(), // Alternative field for severity

      // Message
      message: message,
      msg: message, // Alternative field name

      // OpenTelemetry trace correlation
      ...traceContext,

      // Custom metadata
      ...meta,
    };

    // Standardized error formatting
    if (error) {
      logData.error = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        // Include error cause if present (Error chaining)
        ...(error.cause && { cause: String(error.cause) }),
      };
      logData.error_message = error.message; // Top-level for easy filtering
      logData.error_type = error.name;
    }

    // Emit log via OpenTelemetry if available
    const otelLogger = this.getOtelLogger();
    if (otelLogger) {
      try {
        otelLogger.emit({
          severityNumber: level.severity,
          severityText: level.level.toUpperCase(),
          body: message,
          attributes: {
            ...meta,
            service_name: this.serviceName,
            service_version: this.serviceVersion,
            environment: this.environment,
            ...(traceContext.trace_id && { trace_id: traceContext.trace_id }),
            ...(traceContext.span_id && { span_id: traceContext.span_id }),
            ...(error && {
              "error.message": error.message,
              "error.name": error.name,
              "error.stack": error.stack,
            }),
          },
        });
      } catch {
        // If OTEL logging fails, fall back to console
      }
    }

    // Also log to console for CloudWatch (dual output)
    const logMessage = JSON.stringify(logData);
    switch (level.level) {
      case "error":
        console.error(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "info":
        console.info(logMessage);
        break;
      case "debug":
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  error(message: string, meta: LogMetadata = {}, error?: Error): void {
    this.log(LOG_LEVELS.error, message, meta, error);
  }

  warn(message: string, meta: LogMetadata = {}): void {
    this.log(LOG_LEVELS.warn, message, meta);
  }

  info(message: string, meta: LogMetadata = {}): void {
    this.log(LOG_LEVELS.info, message, meta);
  }

  debug(message: string, meta: LogMetadata = {}): void {
    this.log(LOG_LEVELS.debug, message, meta);
  }

  // Special methods for different types of events
  httpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    headers?: Record<string, string>
  ): void {
    const normalizedPath = this.normalizePath(path);

    // Build metadata object
    const meta: LogMetadata = {
      // Event type
      type: "http_request",
      event_type: "http_request",

      // HTTP-specific fields (OpenTelemetry semantic conventions)
      "http.method": method,
      "http.route": normalizedPath,
      "http.path": path,
      "http.status_code": statusCode,

      // Legacy fields for backward compatibility
      method,
      statusCode,

      // Performance
      duration_ms: duration,
      duration,

      // User context
      "user.id": userId || "anonymous",
      userId: userId || "anonymous",
    };

    // Add sanitized headers if provided (useful for debugging in Grafana)
    if (headers) {
      // Add common useful headers as individual fields for easy filtering
      if (headers["user-agent"]) meta["http.user_agent"] = headers["user-agent"];
      if (headers["content-type"]) meta["http.content_type"] = headers["content-type"];
      if (headers["host"]) meta["http.host"] = headers["host"];
      if (headers["referer"]) meta["http.referer"] = headers["referer"];
      if (headers["accept-language"]) meta["http.accept_language"] = headers["accept-language"];

      // Extract client IP from various headers (in order of priority)
      // x-forwarded-for: Standard proxy header (may contain comma-separated list)
      // x-real-ip: Nginx proxy header
      // cf-connecting-ip: Cloudflare header
      const clientIp =
        headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        headers["x-real-ip"] ||
        headers["cf-connecting-ip"];

      if (clientIp) {
        meta["http.client_ip"] = clientIp;
      }

      // Store full headers as JSON string for detailed debugging
      meta["http.request_headers"] = JSON.stringify(headers);
    }

    this.info(`[API] ${method} ${normalizedPath}`, meta);
  }

  websocketEvent(
    eventType: string,
    userId?: string,
    duration?: number,
    resourceId?: string,
    resourceType?: string,
    status?: string
  ): void {
    const meta: LogMetadata = {
      type: "websocket_event",
      event_type: "websocket_event",
      eventType,
      "user.id": userId || "anonymous",
      userId: userId || "anonymous",
    };

    if (duration !== undefined) {
      meta.duration_ms = duration;
      meta.duration = duration;
    }
    if (resourceId) {
      meta.resource_id = resourceId;
      meta.resourceId = resourceId;
    }
    if (resourceType) {
      meta.resource_type = resourceType;
      meta.resourceType = resourceType;
    }
    if (status) meta.status = status;

    this.info(`[WS] ${eventType}`, meta);
  }

  databaseQuery(operation: string, table: string, duration: number, userId?: string): void {
    const meta = {
      type: "database_query",
      event_type: "database_query",

      // Database fields (OpenTelemetry semantic conventions)
      "db.operation": operation,
      "db.table": table,

      // Legacy fields
      operation,
      table,

      // Performance
      duration_ms: duration,
      duration,

      // User context
      "user.id": userId || "anonymous",
      userId: userId || "anonymous",
    };

    // Log all queries at info level for production visibility
    if (duration > 1000) {
      this.warn(`[DB] Slow query: ${operation} ${table} took ${duration}ms`, meta);
    } else {
      this.info(`[DB] ${operation} ${table}`, meta);
    }
  }

  codeExecution(languageId: number, duration: number, success: boolean, userId?: string): void {
    const status = success ? "success" : "failed";
    this.info(`[CODE] Execution ${status} (language: ${languageId})`, {
      type: "code_execution",
      event_type: "code_execution",
      language_id: languageId,
      languageId,
      duration_ms: duration,
      duration,
      success,
      status,
      "user.id": userId || "anonymous",
      userId: userId || "anonymous",
    });
  }

  businessEvent(eventName: string, userId: string, metadata: LogMetadata = {}): void {
    this.info(`[NOTE] ${eventName}`, {
      type: "business_event",
      event_type: "business_event",
      event_name: eventName,
      eventName,
      "user.id": userId,
      userId,
      ...metadata,
    });
  }

  securityEvent(
    eventType: string,
    severity: "low" | "medium" | "high" | "critical",
    details: LogMetadata
  ): void {
    this.warn(`[SECURITY] ${eventType} (${severity})`, {
      type: "security_event",
      event_type: "security_event",
      security_event_type: eventType,
      eventType,
      security_severity: severity,
      severity,
      ...details,
    });
  }

  // Cache-specific logging methods
  cacheOperation(
    operation: "get" | "set" | "delete",
    key: string,
    hit?: boolean,
    duration?: number,
    ttl?: number,
    keyCount?: number
  ): void {
    const meta: LogMetadata = {
      type: "cache_operation",
      event_type: "cache_operation",
      "cache.operation": operation,
      "cache.key": key,
      operation,
      key,
    };

    if (hit !== undefined) {
      meta["cache.hit"] = hit;
      meta.hit = hit;
    }
    if (duration !== undefined) {
      meta.duration_ms = duration;
      meta.duration = duration;
    }
    if (ttl !== undefined) {
      meta["cache.ttl"] = ttl;
      meta.ttl = ttl;
    }
    if (keyCount !== undefined) {
      meta["cache.key_count"] = keyCount;
      meta.keyCount = keyCount;
    }

    // Log at info level for production visibility
    this.info(`[CACHE] ${operation}${hit !== undefined ? (hit ? " HIT" : " MISS") : ""}`, meta);
  }

  cacheError(operation: string, key: string, error: Error): void {
    this.error(
      `[CACHE] ${operation} error - ${key}`,
      {
        type: "cache_error",
        event_type: "cache_error",
        "cache.operation": operation,
        "cache.key": key,
        operation,
        key,
      },
      error
    );
  }

  // File upload logging methods
  fileUpload(
    filename: string,
    size: number,
    mimeType: string,
    success: boolean,
    userId?: string,
    noteId?: string
  ): void {
    const status = success ? "success" : "failed";

    this.info(`[FILE] Upload ${status} - ${filename}`, {
      type: "file_upload",
      event_type: "file_upload",
      "file.name": filename,
      "file.size": size,
      "file.mime_type": mimeType,
      filename,
      size,
      mimeType,
      status,
      "user.id": userId || "anonymous",
      userId: userId || "anonymous",
      note_id: noteId || "unknown",
      noteId: noteId || "unknown",
    });
  }

  // Storage tracking method
  storageUpdate(totalBytes: number, operation: "add" | "remove", deltaBytes?: number): void {
    this.debug(`[STORAGE] ${operation} - Total: ${totalBytes} bytes`, {
      type: "storage_update",
      event_type: "storage_update",
      "storage.total_bytes": totalBytes,
      "storage.operation": operation,
      totalBytes,
      operation,
      delta_bytes: deltaBytes || 0,
      deltaBytes: deltaBytes || 0,
    });
  }
}

export const logger = new Logger();
