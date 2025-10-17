import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({ prefix: "typelets_" });

// HTTP Request Metrics
export const httpRequestsTotal = new Counter({
  name: "typelets_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"],
});

export const httpRequestDuration = new Histogram({
  name: "typelets_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "path", "status"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

// Cache Metrics
export const cacheOperationsTotal = new Counter({
  name: "typelets_cache_operations_total",
  help: "Total number of cache operations",
  labelNames: ["operation", "status"],
});

export const cacheOperationDuration = new Histogram({
  name: "typelets_cache_operation_duration_ms",
  help: "Cache operation duration in milliseconds",
  labelNames: ["operation"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

export const cacheHitRate = new Counter({
  name: "typelets_cache_hits_total",
  help: "Total number of cache hits and misses",
  labelNames: ["result"], // "hit" or "miss"
});

// WebSocket Metrics
export const websocketConnectionsTotal = new Gauge({
  name: "typelets_websocket_connections_total",
  help: "Current number of WebSocket connections",
});

export const websocketMessagesTotal = new Counter({
  name: "typelets_websocket_messages_total",
  help: "Total number of WebSocket messages",
  labelNames: ["type", "direction"], // direction: "inbound" or "outbound"
});

// Database Metrics
export const databaseQueriesTotal = new Counter({
  name: "typelets_database_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation", "table"],
});

export const databaseQueryDuration = new Histogram({
  name: "typelets_database_query_duration_ms",
  help: "Database query duration in milliseconds",
  labelNames: ["operation", "table"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

// Code Execution Metrics
export const codeExecutionsTotal = new Counter({
  name: "typelets_code_executions_total",
  help: "Total number of code executions",
  labelNames: ["language_id", "success"],
});

export const codeExecutionDuration = new Histogram({
  name: "typelets_code_execution_duration_ms",
  help: "Code execution duration in milliseconds",
  labelNames: ["language_id"],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 30000],
});

// Business Metrics
export const businessEventsTotal = new Counter({
  name: "typelets_business_events_total",
  help: "Total number of business events",
  labelNames: ["event_name"],
});

// Security Metrics
export const securityEventsTotal = new Counter({
  name: "typelets_security_events_total",
  help: "Total number of security events",
  labelNames: ["event_type", "severity"],
});

// Export the Prometheus registry
export { register };
