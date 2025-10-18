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
  private currentLogLevel: LogLevel;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";

    // Set log level based on environment
    const logLevelName =
      process.env.LOG_LEVEL || (this.environment === "production" ? "info" : "debug");
    this.currentLogLevel = LOG_LEVELS[logLevelName] || LOG_LEVELS.info;
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

  error(message: string, meta: LogMetadata = {}, error?: Error): void {
    if (this.shouldLog(LOG_LEVELS.error)) {
      if (error) {
        // Send exception with stack trace and metadata
        Sentry.captureException(error, {
          contexts: {
            metadata: meta,
          },
          tags: {
            type: (meta.type as string) || "error",
          },
        });
      } else {
        // Send error log with metadata
        Sentry.logger.error(message, meta);
      }
    }
  }

  warn(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.warn)) {
      Sentry.logger.warn(message, meta);
    }
  }

  info(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.info)) {
      Sentry.logger.info(message, meta);
    }
  }

  debug(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.debug)) {
      Sentry.logger.debug(message, meta);
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
    const normalizedPath = this.normalizePath(path);
    this.info(`[API] ${method} ${normalizedPath}`, {
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

    this.info(`WebSocket ${eventType}`, meta);
  }

  databaseQuery(operation: string, table: string, duration: number, userId?: string): void {
    this.debug(`[DB] ${operation} ${table}`, {
      type: "database_query",
      operation,
      table,
      duration,
      userId: userId || "anonymous",
    });
  }

  codeExecution(languageId: number, duration: number, success: boolean, userId?: string): void {
    const status = success ? "success" : "failed";
    this.info(`Code execution ${status}`, {
      type: "code_execution",
      languageId,
      duration,
      success,
      userId: userId || "anonymous",
    });
  }

  businessEvent(eventName: string, userId: string, metadata: LogMetadata = {}): void {
    this.info(`Business event ${eventName}`, {
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
    this.warn(`Security event ${eventType}`, {
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
