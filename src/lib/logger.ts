import * as Sentry from "@sentry/node";

interface LogLevel {
  level: string;
  priority: number;
}

type LogMetadata = Record<string, string | number | boolean>;

const LOG_LEVELS: Record<string, LogLevel> = {
  error: { level: "error", priority: 0 },
  warn: { level: "warn", priority: 1 },
  info: { level: "info", priority: 2 },
  debug: { level: "debug", priority: 3 },
};

class Logger {
  private environment: string;
  private service: string;
  private version: string;
  private currentLogLevel: LogLevel;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.service = "typelets-api";
    this.version = process.env.npm_package_version || "1.0.0";

    // Set log level based on environment
    const logLevelName =
      process.env.LOG_LEVEL || (this.environment === "production" ? "info" : "debug");
    this.currentLogLevel = LOG_LEVELS[logLevelName] || LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return level.priority <= this.currentLogLevel.priority;
  }

  private sendToSentry(
    level: "error" | "warning" | "info" | "debug",
    message: string,
    meta: LogMetadata = {}
  ): void {
    // Send as breadcrumb for proper field extraction in Sentry
    Sentry.addBreadcrumb({
      level,
      message,
      category: (meta.type as string) || "app",
      data: {
        service: this.service,
        environment: this.environment,
        version: this.version,
        ...meta,
      },
    });
  }

  error(message: string, meta: LogMetadata = {}, error?: Error): void {
    if (this.shouldLog(LOG_LEVELS.error)) {
      const enrichedMeta = { ...meta };
      if (error) {
        enrichedMeta.errorMessage = error.message;
        enrichedMeta.errorStack = error.stack || "";
      }

      this.sendToSentry("error", message, enrichedMeta);

      // Also send to console for CloudWatch
      if (this.environment === "development") {
        console.error(message, enrichedMeta);
      }
    }
  }

  warn(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.warn)) {
      this.sendToSentry("warning", message, meta);

      if (this.environment === "development") {
        console.warn(message, meta);
      }
    }
  }

  info(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.info)) {
      this.sendToSentry("info", message, meta);

      if (this.environment === "development") {
        console.log(message, meta);
      }
    }
  }

  debug(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.debug)) {
      this.sendToSentry("debug", message, meta);

      if (this.environment === "development") {
        console.log(message, meta);
      }
    }
  }

  // Special methods for different types of events
  httpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    this.info("HTTP request completed", {
      type: "http_request",
      method,
      path,
      statusCode,
      duration,
      userId: userId || "anonymous",
    });
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
      eventType,
      userId: userId || "anonymous",
    };

    if (duration !== undefined) meta.duration = duration;
    if (resourceId) meta.resourceId = resourceId;
    if (resourceType) meta.resourceType = resourceType;
    if (status) meta.status = status;

    this.info("WebSocket event", meta);
  }

  databaseQuery(operation: string, table: string, duration: number, userId?: string): void {
    this.debug("Database query executed", {
      type: "database_query",
      operation,
      table,
      duration,
      userId: userId || "anonymous",
    });
  }

  codeExecution(languageId: number, duration: number, success: boolean, userId?: string): void {
    this.info("Code execution completed", {
      type: "code_execution",
      languageId,
      duration,
      success,
      userId: userId || "anonymous",
    });
  }

  businessEvent(eventName: string, userId: string, metadata: LogMetadata = {}): void {
    this.info("Business event", {
      type: "business_event",
      eventName,
      userId,
      ...metadata,
    });
  }

  securityEvent(
    eventType: string,
    severity: "low" | "medium" | "high" | "critical",
    details: LogMetadata
  ): void {
    this.warn("Security event detected", {
      type: "security_event",
      eventType,
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
      operation,
      key,
    };

    if (hit !== undefined) meta.hit = hit;
    if (duration !== undefined) meta.duration = duration;
    if (ttl !== undefined) meta.ttl = ttl;
    if (keyCount !== undefined) meta.keyCount = keyCount;

    // Log at debug level
    this.debug(`Cache ${operation}${hit !== undefined ? (hit ? " HIT" : " MISS") : ""}`, meta);
  }

  cacheError(operation: string, key: string, error: Error): void {
    this.error(
      `Cache ${operation} error for key ${key}`,
      {
        type: "cache_error",
        operation,
        key,
        error: error.message,
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

    this.info(`File upload ${status}`, {
      type: "file_upload",
      filename,
      size,
      mimeType,
      status,
      userId: userId || "anonymous",
      noteId: noteId || "unknown",
    });
  }

  // Storage tracking method
  storageUpdate(totalBytes: number, operation: "add" | "remove", deltaBytes?: number): void {
    this.debug("Storage updated", {
      type: "storage_update",
      totalBytes,
      operation,
      deltaBytes: deltaBytes || 0,
    });
  }
}

export const logger = new Logger();
