import "dotenv-flow/config";

// IMPORTANT: Import instrument.ts at the top of the file to initialize Sentry
import "./instrument";

const isDevelopment = process.env.NODE_ENV === "development";

import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { trimTrailingSlash } from "hono/trailing-slash";
import { HTTPException } from "hono/http-exception";
import { createServer } from "http";
import { swaggerUI } from "@hono/swagger-ui";
import { WebSocketManager } from "./websocket";
import { authMiddleware } from "./middleware/auth";
import { securityHeaders } from "./middleware/security";
import { rateLimit, cleanup as rateLimitCleanup } from "./middleware/rate-limit";
import { closeCache } from "./lib/cache";
import foldersCrudRouter from "./routes/folders/crud";
import foldersActionsRouter from "./routes/folders/actions";
import crudRouter from "./routes/notes/crud";
import actionsRouter from "./routes/notes/actions";
import trashRouter from "./routes/notes/trash";
import countsRouter from "./routes/notes/counts";
import usersRouter from "./routes/users/crud";
import filesRouter from "./routes/files/crud";
import codeRouter from "./routes/code/crud";
import { VERSION } from "./version";
import { logger } from "./lib/logger";

// Type for OpenAPI routers - using permissive any to avoid type conflicts with library internals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenAPIRouter = any;

const maxFileSize = process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : 50;
const maxBodySize = Math.ceil(maxFileSize * 1.35);

const app = new Hono();

// Strip trailing slashes from all requests (fixes Swagger UI issue)
app.use("*", trimTrailingSlash());

// Apply security headers
app.use("*", securityHeaders);

// Add request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  if (isDevelopment) {
    console.log(`🌐 [${method}] ${path} - Request started`);
  }

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Skip logging for health check and monitoring endpoints
  const skipLogging = ["/health", "/", "/websocket/status", "/docs", "/api/openapi.json"].includes(
    path
  );

  // Log HTTP request with structured logging
  if (!skipLogging) {
    const userId = c.get("userId");
    logger.httpRequest(method, path, status, duration, userId);
  }

  if (isDevelopment) {
    const emoji =
      status >= 200 && status < 300 ? "✅" : status >= 400 && status < 500 ? "⚠️" : "❌";
    console.log(`${emoji} [${method}] ${path} - ${status} (${duration}ms)`);
  }
});

// Sentry user context middleware
app.use("*", async (c, next) => {
  // Set user context if available (after auth middleware runs, userId will be set)
  const userId = c.get("userId");
  if (userId) {
    Sentry.setUser({ id: userId });
  }

  return next();
});

// HTTP API Rate Limiting Configuration
const httpRateLimitWindow = process.env.HTTP_RATE_LIMIT_WINDOW_MS
  ? parseInt(process.env.HTTP_RATE_LIMIT_WINDOW_MS)
  : 15 * 60 * 1000; // 15 minutes

const httpRateLimitMax = process.env.HTTP_RATE_LIMIT_MAX_REQUESTS
  ? parseInt(process.env.HTTP_RATE_LIMIT_MAX_REQUESTS)
  : 1000;

const fileRateLimitMax = process.env.HTTP_FILE_RATE_LIMIT_MAX
  ? parseInt(process.env.HTTP_FILE_RATE_LIMIT_MAX)
  : process.env.NODE_ENV === "development"
    ? 1000
    : 100;

logger.info("HTTP rate limiting configured", {
  windowMinutes: httpRateLimitWindow / 1000 / 60,
  maxRequests: httpRateLimitMax,
  fileMaxRequests: fileRateLimitMax,
});

// Apply rate limiting
app.use(
  "*",
  rateLimit({
    windowMs: httpRateLimitWindow,
    max: httpRateLimitMax,
  })
);

// Rate limiting for file uploads
app.use(
  "/api/files/*",
  rateLimit({
    windowMs: httpRateLimitWindow,
    max: fileRateLimitMax,
  })
);

// Code execution rate limiting will be applied AFTER auth middleware

app.use(
  "*",
  bodyLimit({
    maxSize: maxBodySize * 1024 * 1024,
    onError: (c) => {
      return c.json(
        {
          error: `Request body too large. Maximum file size is ${maxFileSize}MB`,
          status: 413,
        },
        413
      );
    },
  })
);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

if (corsOrigins.length === 0) {
  logger.warn("CORS_ORIGINS not configured - all cross-origin requests will be blocked", {
    recommendation: "Set CORS_ORIGINS environment variable with your frontend URLs",
  });
}

app.use(
  "*",
  cors({
    origin: corsOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Client-ID", "X-Client-Secret"],
    exposeHeaders: ["Set-Cookie", "X-Auth-Refresh-Required", "WWW-Authenticate"],
  })
);

app.get("/", (c) => {
  return c.json({
    message: "Typelets API",
    status: "healthy",
    version: VERSION,
    docs: "https://github.com/typelets/typelets-api",
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// OpenAPI documentation
app.get(
  "/docs",
  swaggerUI({
    url: "/api/openapi.json",
    persistAuthorization: true, // Save token in browser
  })
);

// Serve OpenAPI spec
app.get("/api/openapi.json", (c) => {
  // Get OpenAPI documents from routers
  const usersDoc = (usersRouter as OpenAPIRouter).getOpenAPIDocument({
    openapi: "3.1.0",
    info: {
      title: "Typelets API",
      version: VERSION,
      description:
        "A secure, encrypted notes management API with folder organization and file attachments",
      contact: {
        name: "Typelets API",
        url: "https://github.com/typelets/typelets-api",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3000",
        description: "API Server",
      },
    ],
  });

  const countsDoc = (countsRouter as OpenAPIRouter).getOpenAPIDocument({});
  const crudDoc = (crudRouter as OpenAPIRouter).getOpenAPIDocument({});
  const actionsDoc = (actionsRouter as OpenAPIRouter).getOpenAPIDocument({});
  const trashDoc = (trashRouter as OpenAPIRouter).getOpenAPIDocument({});
  const filesDoc = (filesRouter as OpenAPIRouter).getOpenAPIDocument({});
  const codeDoc = (codeRouter as OpenAPIRouter).getOpenAPIDocument({});
  const foldersCrudDoc = (foldersCrudRouter as OpenAPIRouter).getOpenAPIDocument({});
  const foldersActionsDoc = (foldersActionsRouter as OpenAPIRouter).getOpenAPIDocument({});

  // Merge paths from all routers into usersDoc
  if (!usersDoc.paths) {
    usersDoc.paths = {};
  }

  // Prefix users paths with /api/users
  const prefixedUsersPaths: Record<string, unknown> = {};
  Object.keys(usersDoc.paths).forEach((path) => {
    prefixedUsersPaths[`/api/users${path}`] = usersDoc.paths[path];
  });
  usersDoc.paths = prefixedUsersPaths;

  // Merge counts paths with /api/notes/counts prefix
  if (countsDoc.paths) {
    Object.keys(countsDoc.paths).forEach((path) => {
      const fullPath =
        path === "" || path === "/" ? "/api/notes/counts" : `/api/notes/counts${path}`;
      usersDoc.paths[fullPath] = countsDoc.paths[path];
    });
  }

  // Merge crud paths with /api/notes prefix
  if (crudDoc.paths) {
    Object.keys(crudDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api/notes" : `/api/notes${path}`;
      usersDoc.paths[fullPath] = crudDoc.paths[path];
    });
  }

  // Merge actions paths with /api/notes prefix
  if (actionsDoc.paths) {
    Object.keys(actionsDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api/notes" : `/api/notes${path}`;
      usersDoc.paths[fullPath] = actionsDoc.paths[path];
    });
  }

  // Merge trash paths with /api/notes prefix
  if (trashDoc.paths) {
    Object.keys(trashDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api/notes" : `/api/notes${path}`;
      usersDoc.paths[fullPath] = trashDoc.paths[path];
    });
  }

  // Merge files paths with /api prefix
  if (filesDoc.paths) {
    Object.keys(filesDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api" : `/api${path}`;
      usersDoc.paths[fullPath] = filesDoc.paths[path];
    });
  }

  // Merge code paths with /api/code prefix
  if (codeDoc.paths) {
    Object.keys(codeDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api/code" : `/api/code${path}`;
      usersDoc.paths[fullPath] = codeDoc.paths[path];
    });
  }

  // Merge folders crud paths with /api/folders prefix
  if (foldersCrudDoc.paths) {
    Object.keys(foldersCrudDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api/folders" : `/api/folders${path}`;
      usersDoc.paths[fullPath] = foldersCrudDoc.paths[path];
    });
  }

  // Merge folders actions paths with /api/folders prefix
  if (foldersActionsDoc.paths) {
    Object.keys(foldersActionsDoc.paths).forEach((path) => {
      const fullPath = path === "" || path === "/" ? "/api/folders" : `/api/folders${path}`;
      usersDoc.paths[fullPath] = foldersActionsDoc.paths[path];
    });
  }

  // Merge schemas from all routers
  if (!usersDoc.components) {
    usersDoc.components = {};
  }
  if (!usersDoc.components.schemas) {
    usersDoc.components.schemas = {};
  }

  if (countsDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, countsDoc.components.schemas);
  }

  if (crudDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, crudDoc.components.schemas);
  }

  if (actionsDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, actionsDoc.components.schemas);
  }

  if (trashDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, trashDoc.components.schemas);
  }

  if (filesDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, filesDoc.components.schemas);
  }

  if (codeDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, codeDoc.components.schemas);
  }

  if (foldersCrudDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, foldersCrudDoc.components.schemas);
  }

  if (foldersActionsDoc.components?.schemas) {
    Object.assign(usersDoc.components.schemas, foldersActionsDoc.components.schemas);
  }

  // Manually add securitySchemes to components
  usersDoc.components.securitySchemes = {
    Bearer: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Clerk authentication token",
    },
  };

  return c.json(usersDoc);
});

app.get("/websocket/status", (c) => {
  if (!wsManager) {
    return c.json({ error: "WebSocket not initialized" }, 500);
  }

  return c.json({
    websocket: "operational",
    stats: wsManager.getConnectionStats(),
    timestamp: new Date().toISOString(),
  });
});

app.use("*", authMiddleware);

// Code Execution Rate Limiting Configuration - AFTER auth so users are properly identified
const codeRateLimitMax = process.env.CODE_EXEC_RATE_LIMIT_MAX
  ? parseInt(process.env.CODE_EXEC_RATE_LIMIT_MAX)
  : process.env.NODE_ENV === "development"
    ? 100
    : 50;

const codeRateLimitWindow = process.env.CODE_EXEC_RATE_WINDOW_MS
  ? parseInt(process.env.CODE_EXEC_RATE_WINDOW_MS)
  : 15 * 60 * 1000; // 15 minutes

logger.info("Code execution rate limiting configured", {
  windowMinutes: codeRateLimitWindow / 1000 / 60,
  maxRequests: codeRateLimitMax,
});

app.use(
  "/api/code/*",
  rateLimit({
    windowMs: codeRateLimitWindow,
    max: codeRateLimitMax,
  })
);

app.route("/api/users", usersRouter);
app.route("/api/folders", foldersCrudRouter);
app.route("/api/folders", foldersActionsRouter);
app.route("/api/notes/counts", countsRouter);
app.route("/api/notes", trashRouter); // Register trash router before crud to avoid /{id} catching /empty-trash
app.route("/api/notes", crudRouter);
app.route("/api/notes", actionsRouter);
app.route("/api/code", codeRouter);
app.route("/api", filesRouter);

app.onError((err, c) => {
  // Generate unique error ID for tracking
  const errorId = crypto.randomUUID();

  // Get user context
  const userId = c.get("userId") || "anonymous";

  // Capture exception in Sentry
  Sentry.captureException(err, {
    extra: {
      errorId,
      url: c.req.url,
      method: c.req.method,
      userId,
    },
  });

  // Log full error details server-side only
  logger.error(
    "API Error",
    {
      errorId,
      message: err.message,
      url: c.req.url,
      method: c.req.method,
      userId,
      stack: err.stack ?? "no stack trace",
    },
    err
  );

  // Error context logged above

  if (err instanceof HTTPException) {
    // Log usage limit errors for billing analytics
    if (err.status === 402 && err.cause) {
      const userId = c.get("userId") || "anonymous";
      const cause = err.cause as {
        code: string;
        currentCount?: number;
        limit?: number;
        currentStorageMB?: number;
        fileSizeMB?: number;
        expectedTotalMB?: number;
        limitGB?: number;
      };

      if (cause.code === "NOTE_LIMIT_EXCEEDED") {
        logger.businessEvent("note_limit_exceeded", userId, {
          currentCount: cause.currentCount ?? 0,
          limit: cause.limit ?? 0,
        });
      } else if (cause.code === "STORAGE_LIMIT_EXCEEDED") {
        logger.businessEvent("storage_limit_exceeded", userId, {
          currentStorageMB: cause.currentStorageMB ?? 0,
          fileSizeMB: cause.fileSizeMB ?? 0,
          expectedTotalMB: cause.expectedTotalMB ?? 0,
          limitGB: cause.limitGB ?? 0,
        });
      }
    }

    // Return sanitized error response
    return c.json(
      {
        error: err.message,
        status: err.status,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === "development" && { errorId }),
      },
      err.status
    );
  }

  // For non-HTTP exceptions, return generic error in production
  const isProduction = process.env.NODE_ENV === "production";

  return c.json(
    {
      error: isProduction ? "Internal Server Error" : err.message,
      status: 500,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && {
        errorId,
        stack: err.stack ?? "no stack trace",
      }),
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      status: 404,
      path: c.req.url,
      method: c.req.method,
      timestamp: new Date().toISOString(),
    },
    404
  );
});

const port = Number(process.env.PORT) || 3000;

const freeStorageGB = process.env.FREE_TIER_STORAGE_GB
  ? parseFloat(process.env.FREE_TIER_STORAGE_GB)
  : 1;
const freeNoteLimit = process.env.FREE_TIER_NOTE_LIMIT
  ? parseInt(process.env.FREE_TIER_NOTE_LIMIT)
  : 1000;

logger.info("Typelets API server starting", {
  version: VERSION,
  port,
  maxFileSize,
  maxBodySize,
  freeStorageGB,
  freeNoteLimit,
  corsOrigins: corsOrigins.join(","),
  environment: process.env.NODE_ENV || "development",
});

console.log("🚀 Typelets API v" + VERSION + " started at:", new Date().toISOString());
console.log(`📡 Listening on port ${port}`);
console.log(`📁 Max file size: ${maxFileSize}MB (body limit: ${maxBodySize}MB)`);
console.log(`💰 Free tier limits: ${freeStorageGB}GB storage, ${freeNoteLimit} notes`);
console.log(`🌐 CORS origins:`, corsOrigins);

const httpServer = createServer((req, res) => {
  let body = Buffer.alloc(0);

  req.on("data", (chunk: Buffer) => {
    body = Buffer.concat([body, chunk]);
  });

  req.on("end", async () => {
    try {
      const requestInit: RequestInit = {
        method: req.method,
        headers: req.headers as Record<string, string>,
      };

      if (body.length > 0) {
        requestInit.body = new Uint8Array(body) as BodyInit;
      }

      const response = await app.fetch(new Request(`http://localhost${req.url}`, requestInit));

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    } catch (err) {
      logger.error(
        "Request handling error",
        {
          error: err instanceof Error ? err.message : String(err),
        },
        err instanceof Error ? err : undefined
      );
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  req.on("error", (err: Error) => {
    logger.error("Request error", { error: err.message }, err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  });
});

const wsManager = new WebSocketManager(httpServer);

// Graceful shutdown handling

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info("HTTP server closed");

    // Cleanup rate limiter
    rateLimitCleanup();
    logger.info("Rate limiter cleanup completed");

    // Close cache connection
    await closeCache();

    logger.info("Graceful shutdown completed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

httpServer.listen(port, () => {
  console.log(`🚀 Typelets API v${VERSION} with WebSocket started at:`, new Date().toISOString());
  console.log(`📡 HTTP & WebSocket server listening on port ${port}`);
  console.log(`📁 Max file size: ${maxFileSize}MB (body limit: ${maxBodySize}MB)`);
  console.log(`💰 Free tier limits: ${freeStorageGB}GB storage, ${freeNoteLimit} notes`);
  console.log(`🌐 CORS origins:`, corsOrigins);
});
