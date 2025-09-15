/// <reference lib="dom" />
import "dotenv-flow/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
// import { serve } from "@hono/node-server"; // Unused since we use custom HTTP server
import { createServer } from "http";
import { WebSocketManager } from "./websocket";
import { authMiddleware } from "./middleware/auth";
import { securityHeaders } from "./middleware/security";
import { rateLimit, cleanup as rateLimitCleanup } from "./middleware/rate-limit";
import foldersRouter from "./routes/folders";
import notesRouter from "./routes/notes";
import usersRouter from "./routes/users";
import filesRouter from "./routes/files";
import { VERSION } from "./version";

const maxFileSize = process.env.MAX_FILE_SIZE_MB
  ? parseInt(process.env.MAX_FILE_SIZE_MB)
  : 50;
const maxBodySize = Math.ceil(maxFileSize * 1.35);

const app = new Hono();

// Apply security headers first
app.use("*", securityHeaders);

// Apply rate limiting
app.use(
  "*",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window (increased from 100)
  })
);

// Rate limiting for file uploads
app.use(
  "/api/files/*",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 file operations per window (increased from 10)
  })
);

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
        413,
      );
    },
  }),
);

app.use("*", async (c, next) => {
  await next();
});

const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(
  "*",
  cors({
    origin: corsOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Client-ID",
      "X-Client-Secret",
    ],
    exposeHeaders: [
      "Set-Cookie",
      "X-Auth-Refresh-Required",
      "WWW-Authenticate",
    ],
  }),
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

app.route("/api/users", usersRouter);
app.route("/api/folders", foldersRouter);
app.route("/api/notes", notesRouter);
app.route("/api", filesRouter);

app.onError((err, c) => {
  // Generate unique error ID for tracking
  const errorId = crypto.randomUUID();

  // Log full error details server-side only
  console.error(`[ERROR ${errorId}] API Error:`, err.message);
  console.error(`[ERROR ${errorId}] Stack:`, err.stack);
  console.error(`[ERROR ${errorId}] URL:`, c.req.url);
  console.error(`[ERROR ${errorId}] Method:`, c.req.method);
  console.error(`[ERROR ${errorId}] User:`, c.get("userId") || "anonymous");

  if (err instanceof HTTPException) {
    // Log usage limit errors for billing analytics
    if (err.status === 402 && err.cause) {
      const userId = c.get("userId") || "anonymous";
      const cause = err.cause as { code: string; currentCount?: number; limit?: number; currentStorageMB?: number; fileSizeMB?: number; expectedTotalMB?: number; limitGB?: number };

      if (cause.code === "NOTE_LIMIT_EXCEEDED") {
        console.log(`[BILLING] Note limit exceeded - User: ${userId}, Count: ${cause.currentCount}/${cause.limit}`);
      } else if (cause.code === "STORAGE_LIMIT_EXCEEDED") {
        console.log(`[BILLING] Storage limit exceeded - User: ${userId}, Storage: ${cause.currentStorageMB}MB + ${cause.fileSizeMB}MB = ${cause.expectedTotalMB}MB (Limit: ${cause.limitGB}GB)`);
      }
    }

    // Return sanitized error response
    return c.json(
      {
        error: err.message,
        status: err.status,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === "development" && { errorId })
      },
      err.status,
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
        stack: err.stack
      })
    },
    500,
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
    404,
  );
});

const port = Number(process.env.PORT) || 3000;

const freeStorageGB = process.env.FREE_TIER_STORAGE_GB ? parseFloat(process.env.FREE_TIER_STORAGE_GB) : 1;
const freeNoteLimit = process.env.FREE_TIER_NOTE_LIMIT ? parseInt(process.env.FREE_TIER_NOTE_LIMIT) : 100;

console.log(
  "🚀 Typelets API v" + VERSION + " started at:",
  new Date().toISOString(),
);
console.log(`📡 Listening on port ${port}`);
console.log(
  `📁 Max file size: ${maxFileSize}MB (body limit: ${maxBodySize}MB)`,
);
console.log(`💰 Free tier limits: ${freeStorageGB}GB storage, ${freeNoteLimit} notes`);
console.log(`🌐 CORS origins:`, corsOrigins);

const httpServer = createServer((req, res) => {
  let body = Buffer.alloc(0);

  req.on('data', (chunk: Buffer) => {
    body = Buffer.concat([body, chunk]);
  });

  req.on('end', async () => {
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
      console.error('Request handling error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  req.on('error', (err: Error) => {
    console.error('Request error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
});

const wsManager = new WebSocketManager(httpServer);

httpServer.listen(port, () => {
  console.log(`🚀 Typelets API v${VERSION} with WebSocket started at:`, new Date().toISOString());
  console.log(`📡 HTTP & WebSocket server listening on port ${port}`);
  console.log(`📁 Max file size: ${maxFileSize}MB (body limit: ${maxBodySize}MB)`);
  console.log(`💰 Free tier limits: ${freeStorageGB}GB storage, ${freeNoteLimit} notes`);
  console.log(`🌐 CORS origins:`, corsOrigins);
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(() => {
    console.log('📴 HTTP server closed');

    // Cleanup rate limiter
    rateLimitCleanup();
    console.log('🧹 Rate limiter cleanup completed');

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
