import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const codeRouter = new Hono();

// Environment variables
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";

if (!JUDGE0_API_KEY) {
  console.error("❌ JUDGE0_API_KEY environment variable is required");
  process.exit(1);
}

// Validation schemas with proper security limits
const executeCodeSchema = z.object({
  language_id: z.number().int().min(1).max(200), // Reasonable language ID range
  source_code: z.string().min(1).max(50000), // 50KB max source code
  stdin: z.string().max(10000).optional().default(""), // 10KB max stdin
  cpu_time_limit: z.number().min(1).max(30).optional().default(5), // 1-30 seconds
  memory_limit: z.number().min(16384).max(512000).optional().default(128000), // 16MB-512MB
  wall_time_limit: z.number().min(1).max(60).optional().default(10), // 1-60 seconds
});

const tokenSchema = z.object({
  token: z.string().min(1),
});

// Helper function to make Judge0 API requests
async function makeJudge0Request(endpoint: string, options: RequestInit = {}) {
  const url = `${JUDGE0_API_URL}${endpoint}`;

  // Add timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "X-RapidAPI-Host": JUDGE0_API_HOST,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Log full error details server-side only
      const errorBody = await response.text().catch(() => '');
      console.error(`Judge0 API Error: ${response.status} ${response.statusText} - ${errorBody}`);

      // Return sanitized error messages to frontend
      let clientMessage = "Code execution failed. Please try again.";
      let statusCode = response.status;

      if (response.status === 429) {
        clientMessage = "Code execution service is temporarily busy. Please try again in a few minutes.";
      } else if (response.status === 401 || response.status === 403) {
        clientMessage = "Code execution service is temporarily unavailable. Please contact support.";
        statusCode = 503; // Don't expose auth issues
      } else if (response.status >= 500) {
        clientMessage = "Code execution service is temporarily unavailable. Please try again later.";
        statusCode = 503;
      }

      throw new HTTPException(statusCode, {
        message: clientMessage,
      });
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof HTTPException) {
      throw error;
    }

    if (error.name === 'AbortError') {
      console.error("Judge0 API timeout");
      throw new HTTPException(504, {
        message: "Code execution timed out. Please try again."
      });
    }

    console.error("Judge0 API request failed:", error);
    throw new HTTPException(503, {
      message: "Code execution service temporarily unavailable",
    });
  }
}

// POST /api/code/execute - Submit code for execution
codeRouter.post(
  "/execute",
  zValidator("json", executeCodeSchema),
  async (c) => {
    try {
      const body = c.req.valid("json");

      // Base64 encode the source code and stdin for Judge0
      const submissionData = {
        ...body,
        source_code: Buffer.from(body.source_code).toString("base64"),
        stdin: Buffer.from(body.stdin || "").toString("base64"),
      };

      const response = await makeJudge0Request("/submissions?base64_encoded=true", {
        method: "POST",
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();
      return c.json(result);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      console.error("Code execution error:", error);
      throw new HTTPException(500, {
        message: "Failed to submit code for execution",
      });
    }
  }
);

// GET /api/code/status/:token - Get execution status and results
codeRouter.get(
  "/status/:token",
  zValidator("param", tokenSchema),
  async (c) => {
    try {
      const { token } = c.req.valid("param");

      const response = await makeJudge0Request(
        `/submissions/${token}?base64_encoded=true`
      );

      const result = await response.json();

      // Decode base64 encoded fields if they exist
      if (result.stdout) {
        result.stdout = Buffer.from(result.stdout, "base64").toString("utf-8");
      }
      if (result.stderr) {
        result.stderr = Buffer.from(result.stderr, "base64").toString("utf-8");
      }
      if (result.compile_output) {
        result.compile_output = Buffer.from(result.compile_output, "base64").toString("utf-8");
      }
      if (result.message) {
        result.message = Buffer.from(result.message, "base64").toString("utf-8");
      }

      return c.json(result);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      console.error("Status check error:", error);
      throw new HTTPException(500, {
        message: "Failed to check execution status",
      });
    }
  }
);

// GET /api/code/languages - Get supported languages (optional endpoint)
codeRouter.get("/languages", async (c) => {
  try {
    const response = await makeJudge0Request("/languages");
    const result = await response.json();
    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error("Languages fetch error:", error);
    throw new HTTPException(500, {
      message: "Failed to fetch supported languages",
    });
  }
});

// GET /api/code/health - Health check for Judge0 service connectivity
codeRouter.get("/health", async (c) => {
  try {
    const response = await makeJudge0Request("/languages");

    if (response.ok) {
      return c.json({
        status: "healthy",
        judge0: "connected",
        timestamp: new Date().toISOString(),
      });
    } else {
      return c.json({
        status: "degraded",
        judge0: "partial_connectivity",
        timestamp: new Date().toISOString(),
      }, 207); // Multi-status
    }
  } catch (error) {
    console.error("Judge0 health check failed:", error);
    return c.json({
      status: "unhealthy",
      judge0: "disconnected",
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

export default codeRouter;