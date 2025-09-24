interface LogLevel {
  level: string;
  priority: number;
}

const LOG_LEVELS: Record<string, LogLevel> = {
  error: { level: 'error', priority: 0 },
  warn: { level: 'warn', priority: 1 },
  info: { level: 'info', priority: 2 },
  debug: { level: 'debug', priority: 3 }
};

class Logger {
  private environment: string;
  private service: string;
  private version: string;
  private currentLogLevel: LogLevel;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.service = 'typelets-api';
    this.version = process.env.npm_package_version || '1.0.0';

    // Set log level based on environment
    const logLevelName = process.env.LOG_LEVEL || (this.environment === 'production' ? 'info' : 'debug');
    this.currentLogLevel = LOG_LEVELS[logLevelName] || LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return level.priority <= this.currentLogLevel.priority;
  }

  private formatLog(level: string, message: string, meta: Record<string, unknown> = {}): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      version: this.version,
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    if (this.shouldLog(LOG_LEVELS.error)) {
      console.error(this.formatLog('error', message, meta));
    }
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    if (this.shouldLog(LOG_LEVELS.warn)) {
      console.warn(this.formatLog('warn', message, meta));
    }
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    if (this.shouldLog(LOG_LEVELS.info)) {
      console.log(this.formatLog('info', message, meta));
    }
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    if (this.shouldLog(LOG_LEVELS.debug)) {
      console.log(this.formatLog('debug', message, meta));
    }
  }

  // Special methods for different types of events
  httpRequest(method: string, path: string, statusCode: number, duration: number, userId?: string): void {
    this.info('HTTP request completed', {
      type: 'http_request',
      method,
      path,
      statusCode,
      duration,
      userId: userId || 'anonymous'
    });
  }

  websocketEvent(eventType: string, userId?: string, connectionCount?: number): void {
    this.info('WebSocket event', {
      type: 'websocket_event',
      eventType,
      userId: userId || 'anonymous',
      connectionCount
    });
  }

  databaseQuery(operation: string, table: string, duration: number, userId?: string): void {
    this.debug('Database query executed', {
      type: 'database_query',
      operation,
      table,
      duration,
      userId: userId || 'anonymous'
    });
  }

  codeExecution(languageId: number, duration: number, success: boolean, userId?: string): void {
    this.info('Code execution completed', {
      type: 'code_execution',
      languageId,
      duration,
      success,
      userId: userId || 'anonymous'
    });
  }

  businessEvent(eventName: string, userId: string, metadata: Record<string, unknown> = {}): void {
    this.info('Business event', {
      type: 'business_event',
      eventName,
      userId,
      ...metadata
    });
  }

  securityEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, unknown>): void {
    this.warn('Security event detected', {
      type: 'security_event',
      eventType,
      severity,
      ...details
    });
  }
}

export const logger = new Logger();