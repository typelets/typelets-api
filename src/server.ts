import "dotenv-flow/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { serve } from "@hono/node-server";
import { authMiddleware } from "./middleware/auth";
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

if (!process.env.CORS_ORIGINS) {
  throw new Error(
    "Missing CORS_ORIGINS - Please add CORS_ORIGINS to your environment variables",
  );
}

const corsOrigins = process.env.CORS_ORIGINS.split(",").map((origin) =>
  origin.trim(),
);

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
    env: process.env.NODE_ENV || "development",
  });
});

app.use("*", authMiddleware);

app.route("/api/users", usersRouter);
app.route("/api/folders", foldersRouter);
app.route("/api/notes", notesRouter);
app.route("/api", filesRouter);

app.onError((err, c) => {
  console.error("API Error:", err.message);
  console.error("Stack:", err.stack);

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
    
    return c.json(
      {
        error: err.message,
        status: err.status,
        timestamp: new Date().toISOString(),
      },
      err.status,
    );
  }

  return c.json(
    {
      error: "Internal Server Error",
      status: 500,
      timestamp: new Date().toISOString(),
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

serve({
  fetch: app.fetch,
  port,
});
