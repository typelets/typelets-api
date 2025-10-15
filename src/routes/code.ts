import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { logger } from "../lib/logger";

const codeRouter = new Hono();

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";

if (!JUDGE0_API_KEY) {
  logger.error("JUDGE0_API_KEY environment variable is required - code execution disabled");
  process.exit(1);
}

const executeCodeSchema = z.object({
  language_id: z.number().int().min(1).max(200),
  source_code: z.string().min(1).max(50000),
  stdin: z.string().max(10000).optional().default(""),
  cpu_time_limit: z.number().min(1).max(30).optional().default(5),
  memory_limit: z.number().min(16384).max(512000).optional().default(128000),
  wall_time_limit: z.number().min(1).max(60).optional().default(10),
});

const tokenSchema = z.object({
  token: z.string().min(1),
});

async function makeJudge0Request(endpoint: string, options: RequestInit = {}) {
  const url = `${JUDGE0_API_URL}${endpoint}`;
  const start = Date.now();

  // Judge0 API call timing

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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

    const duration = Date.now() - start;
    logger.debug("Judge0 API request", {
      method: options.method || "GET",
      endpoint,
      duration,
      status: response.status,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("Judge0 API Error", {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        errorBody: errorBody.substring(0, 200), // Limit error body length
      });

      let clientMessage = "Code execution failed. Please try again.";
      let statusCode = response.status;

      if (response.status === 429) {
        clientMessage =
          "Code execution service is temporarily busy. Please try again in a few minutes.";
      } else if (response.status === 401 || response.status === 403) {
        clientMessage =
          "Code execution service is temporarily unavailable. Please contact support.";
        statusCode = 503;
      } else if (response.status >= 500) {
        clientMessage =
          "Code execution service is temporarily unavailable. Please try again later.";
        statusCode = 503;
      }

      // noinspection ExceptionCaughtLocallyJS
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

    if (error.name === "AbortError") {
      logger.error("Judge0 API timeout", { endpoint });
      throw new HTTPException(504, {
        message: "Code execution timed out. Please try again.",
      });
    }

    logger.error(
      "Judge0 API request failed",
      {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    throw new HTTPException(503, {
      message: "Code execution service temporarily unavailable",
    });
  }
}

codeRouter.post("/execute", zValidator("json", executeCodeSchema), async (c) => {
  try {
    const body = c.req.valid("json");

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

    logger.error(
      "Code execution error",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    throw new HTTPException(500, {
      message: "Failed to submit code for execution",
    });
  }
});

codeRouter.get("/status/:token", zValidator("param", tokenSchema), async (c) => {
  try {
    const { token } = c.req.valid("param");

    const response = await makeJudge0Request(`/submissions/${token}?base64_encoded=true`);

    const result = await response.json();

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

    logger.error(
      "Status check error",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    throw new HTTPException(500, {
      message: "Failed to check execution status",
    });
  }
});

codeRouter.get("/languages", async (c) => {
  try {
    const response = await makeJudge0Request("/languages");
    const result = await response.json();
    return c.json(result);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    logger.error(
      "Languages fetch error",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    throw new HTTPException(500, {
      message: "Failed to fetch supported languages",
    });
  }
});

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
      return c.json(
        {
          status: "degraded",
          judge0: "partial_connectivity",
          timestamp: new Date().toISOString(),
        },
        207
      ); // Multi-status
    }
  } catch (error) {
    logger.error(
      "Judge0 health check failed",
      {
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    return c.json(
      {
        status: "unhealthy",
        judge0: "disconnected",
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

export default codeRouter;
