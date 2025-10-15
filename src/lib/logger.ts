import * as newrelic from "newrelic";

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
  private newrelicEnabled: boolean;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.service = "typelets-api";
    this.version = process.env.npm_package_version || "1.0.0";
    // Check if New Relic is properly initialized
    this.newrelicEnabled = typeof newrelic === "object" && !!newrelic;

    // Set log level based on environment
    const logLevelName =
      process.env.LOG_LEVEL || (this.environment === "production" ? "info" : "debug");
    this.currentLogLevel = LOG_LEVELS[logLevelName] || LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return level.priority <= this.currentLogLevel.priority;
  }

  private formatLog(level: string, message: string, meta: LogMetadata = {}): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      version: this.version,
      message,
      ...meta,
    };

    return JSON.stringify(logEntry);
  }

  error(message: string, meta: LogMetadata = {}, error?: Error): void {
    if (this.shouldLog(LOG_LEVELS.error)) {
      console.error(this.formatLog("error", message, meta));

      // Send error to New Relic
      if (this.newrelicEnabled) {
        if (error) {
          newrelic.noticeError(error, meta);
        } else {
          newrelic.noticeError(new Error(message), meta);
        }
      }
    }
  }

  warn(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.warn)) {
      console.warn(this.formatLog("warn", message, meta));

      // Log warning as custom event in New Relic
      if (this.newrelicEnabled) {
        newrelic.recordCustomEvent("ApplicationWarning", {
          message,
          ...meta,
        });
      }
    }
  }

  info(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.info)) {
      console.log(this.formatLog("info", message, meta));
    }
  }

  debug(message: string, meta: LogMetadata = {}): void {
    if (this.shouldLog(LOG_LEVELS.debug)) {
      console.log(this.formatLog("debug", message, meta));
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

    // Record metrics to New Relic
    if (this.newrelicEnabled) {
      // Record response time
      this.recordMetric("Custom/HTTP/ResponseTime", duration);

      // Record status code metrics
      const statusCategory = Math.floor(statusCode / 100);
      this.recordMetric(`Custom/HTTP/Status/${statusCategory}xx`, 1);

      // Record request count by method
      this.recordMetric(`Custom/HTTP/Method/${method}`, 1);
    }
  }

  websocketEvent(eventType: string, userId?: string, connectionCount?: number): void {
    const meta: LogMetadata = {
      type: "websocket_event",
      eventType,
      userId: userId || "anonymous",
    };

    if (connectionCount !== undefined) {
      meta.connectionCount = connectionCount;
    }

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

    // Record business event to New Relic
    if (this.newrelicEnabled) {
      this.recordCustomEvent("BusinessEvent", {
        eventName,
        userId,
        ...metadata,
      });
      this.recordMetric(`Custom/Business/${eventName}`, 1);
    }
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

    // Record security event to New Relic
    if (this.newrelicEnabled) {
      this.recordCustomEvent("SecurityEvent", {
        eventType,
        severity,
        ...details,
      });
      this.recordMetric(`Custom/Security/${severity}`, 1);
    }
  }

  // New Relic specific methods
  recordMetric(name: string, value: number): void {
    if (this.newrelicEnabled) {
      newrelic.recordMetric(name, value);
    }
  }

  recordCustomEvent(eventType: string, attributes: LogMetadata): void {
    if (this.newrelicEnabled) {
      newrelic.recordCustomEvent(eventType, attributes);
    }
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

    // Send metrics to New Relic
    if (this.newrelicEnabled) {
      if (operation === "get" && hit !== undefined) {
        this.recordMetric(`Custom/Cache/${hit ? "Hit" : "Miss"}`, 1);
        if (duration !== undefined) {
          this.recordMetric("Custom/Cache/GetDuration", duration);
        }
      } else if (operation === "set" && duration !== undefined) {
        this.recordMetric("Custom/Cache/Set", 1);
        this.recordMetric("Custom/Cache/SetDuration", duration);
      } else if (operation === "delete") {
        this.recordMetric("Custom/Cache/Delete", keyCount || 1);
        if (duration !== undefined) {
          this.recordMetric("Custom/Cache/DeleteDuration", duration);
        }
      }

      // Record custom event for detailed analysis
      this.recordCustomEvent("CacheOperation", meta);
    }
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

    if (this.newrelicEnabled) {
      this.recordMetric("Custom/Cache/Error", 1);
    }
  }
}

export const logger = new Logger();
