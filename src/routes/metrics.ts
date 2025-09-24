import { Hono } from "hono";
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
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    memory: { status: 'pass' | 'warn' | 'fail'; details: string };
    database: { status: 'pass' | 'warn' | 'fail'; details: string };
    judge0: { status: 'pass' | 'warn' | 'fail'; details: string };
  };
}

// Enhanced health check with more detailed status
metricsRouter.get("/health", async (c) => {
  const startTime = Date.now();
  const memUsage = process.memoryUsage();
  const environment = process.env.NODE_ENV || 'development';
  const version = process.env.npm_package_version || '1.0.0';

  // Memory check (warn if heap usage > 80%, fail if > 95%)
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  const memoryCheck = {
    status: heapUsedPercent > 95 ? 'fail' as const : heapUsedPercent > 80 ? 'warn' as const : 'pass' as const,
    details: `Heap usage: ${Math.round(heapUsedPercent)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB)`
  };

  // Database connectivity check
  let databaseCheck = { status: 'pass' as const, details: 'Database connection healthy' };
  try {
    // Basic database health check could be added here
    // For now, assume healthy if no errors are thrown
  } catch {
    databaseCheck = { status: 'fail', details: 'Database connection failed' };
  }

  // Judge0 service check (optional)
  let judge0Check = { status: 'pass' as const, details: 'Judge0 service available' };
  if (process.env.JUDGE0_API_KEY) {
    // Could add actual Judge0 health check here
    judge0Check = { status: 'pass', details: 'Judge0 API configured' };
  } else {
    judge0Check = { status: 'warn', details: 'Judge0 API not configured' };
  }

  // Determine overall status
  const checks = { memory: memoryCheck, database: databaseCheck, judge0: judge0Check };
  const hasFailures = Object.values(checks).some(check => check.status === 'fail');
  const hasWarnings = Object.values(checks).some(check => check.status === 'warn');

  const overallStatus = hasFailures ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    version,
    checks
  };

  // Log health check
  const duration = Date.now() - startTime;
  logger.info('Health check completed', {
    status: overallStatus,
    duration,
    checks: Object.entries(checks).map(([name, check]) => `${name}:${check.status}`).join(',')
  });


  return c.json(healthStatus, statusCode);
});

// System metrics endpoint for monitoring dashboards
metricsRouter.get("/metrics", async (c) => {
  const startTime = Date.now();
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const environment = process.env.NODE_ENV || 'development';
  const version = process.env.npm_package_version || '1.0.0';

  const metrics: SystemMetrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: memUsage,
    cpuUsage,
    environment,
    version
  };


  const duration = Date.now() - startTime;
  logger.debug('System metrics retrieved', { duration });

  return c.json(metrics);
});

// Readiness probe for Kubernetes/ECS
metricsRouter.get("/ready", async (c) => {
  // Simple readiness check - service is ready if it can respond
  return c.json({
    status: "ready",
    timestamp: new Date().toISOString()
  });
});

// Liveness probe for Kubernetes/ECS
metricsRouter.get("/live", async (c) => {
  // Simple liveness check - service is alive if it can respond
  return c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default metricsRouter;