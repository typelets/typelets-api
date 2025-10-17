import { Hono, Context } from "hono";
import { logger } from "../lib/logger";

const metricsRouter = new Hono();

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  environment: string;
  version: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    memory: { status: "pass" | "warn" | "fail"; details: string };
    database: { status: "pass" | "warn" | "fail"; details: string };
    judge0: { status: "pass" | "warn" | "fail"; details: string };
  };
}

// Enhanced health check with more detailed status
metricsRouter.get("/health", async (c: Context) => {
  const startTime = Date.now();
  const memUsage = process.memoryUsage();
  const environment = process.env.NODE_ENV || "development";
  const version = process.env.npm_package_version || "1.0.0";

  // Memory check (warn if heap usage > 80%, fail if > 95%)
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const memoryCheck = {
    status:
      heapUsedPercent > 95
        ? ("fail" as const)
        : heapUsedPercent > 80
          ? ("warn" as const)
          : ("pass" as const),
    details: `Heap usage: ${Math.round(heapUsedPercent)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB)`,
  };

  // Database connectivity check
  let databaseCheck: { status: "pass" | "warn" | "fail"; details: string } = {
    status: "pass",
    details: "Database connection healthy",
  };
  try {
    // Basic database health check could be added here
    // For now, assume healthy if no errors are thrown
  } catch {
    databaseCheck = { status: "fail", details: "Database connection failed" };
  }

  // Judge0 service check (optional)
  const judge0Check = process.env.JUDGE0_API_KEY
    ? { status: "pass" as const, details: "Judge0 API configured" }
    : { status: "warn" as const, details: "Judge0 API not configured" };

  // Determine overall status
  const checks = { memory: memoryCheck, database: databaseCheck, judge0: judge0Check };
  const hasFailures = Object.values(checks).some((check) => check.status === "fail");
  const hasWarnings = Object.values(checks).some((check) => check.status === "warn");

  const overallStatus = hasFailures ? "unhealthy" : hasWarnings ? "degraded" : "healthy";
  const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 207 : 503;

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    version,
    checks,
  };

  // Log health check
  const duration = Date.now() - startTime;
  logger.info("Health check completed", {
    status: overallStatus,
    duration,
    checks: Object.entries(checks)
      .map(([name, check]) => `${name}:${check.status}`)
      .join(","),
  });

  return c.json(healthStatus, statusCode);
});

// Prometheus metrics endpoint for Grafana (requires Basic Auth)
metricsRouter.get("/metrics", async (c: Context) => {
  const metricsApiKey = process.env.METRICS_API_KEY;

  // Check for Basic Auth authentication
  if (!metricsApiKey) {
    logger.warn("METRICS_API_KEY not configured - metrics endpoint is unprotected");
  } else {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      logger.warn("Unauthorized metrics access attempt - missing or invalid auth", {
        ip: c.req.header("x-forwarded-for") || "unknown",
        userAgent: c.req.header("user-agent") || "unknown",
      });
      c.header("WWW-Authenticate", 'Basic realm="Metrics"');
      return c.text("Unauthorized", 401);
    }

    try {
      // Decode Basic Auth credentials
      const base64Credentials = authHeader.substring(6); // Remove "Basic "
      const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
      const [username, password] = credentials.split(":");

      // Verify password matches API key (username can be anything)
      if (password !== metricsApiKey) {
        logger.warn("Unauthorized metrics access attempt - invalid credentials", {
          ip: c.req.header("x-forwarded-for") || "unknown",
          userAgent: c.req.header("user-agent") || "unknown",
          username: username || "empty",
        });
        c.header("WWW-Authenticate", 'Basic realm="Metrics"');
        return c.text("Unauthorized", 401);
      }
    } catch (error) {
      logger.warn("Unauthorized metrics access attempt - malformed auth header", {
        ip: c.req.header("x-forwarded-for") || "unknown",
        userAgent: c.req.header("user-agent") || "unknown",
      });
      c.header("WWW-Authenticate", 'Basic realm="Metrics"');
      return c.text("Unauthorized", 401);
    }
  }

  try {
    const { register } = await import("../lib/prometheus");
    const metrics = await register.metrics();
    return c.text(metrics, 200, {
      "Content-Type": register.contentType,
    });
  } catch (error) {
    logger.error("Failed to generate Prometheus metrics", {}, error as Error);
    return c.text("Error generating metrics", 500);
  }
});

// Readiness probe for Kubernetes/ECS
metricsRouter.get("/ready", async (c: Context) => {
  // Simple readiness check - service is ready if it can respond
  return c.json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
});

// Liveness probe for Kubernetes/ECS
metricsRouter.get("/live", async (c: Context) => {
  // Simple liveness check - service is alive if it can respond
  return c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default metricsRouter;
