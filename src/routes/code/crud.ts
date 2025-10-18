import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "@hono/zod-openapi";
import { logger } from "../../lib/logger";
import {
  executeCodeRequestSchema,
  codeSubmissionResponseSchema,
  codeExecutionStatusSchema,
  languageSchema,
  codeHealthResponseSchema,
  tokenParamSchema,
} from "../../lib/openapi-schemas";

const crudRouter = new OpenAPIHono();

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";

if (!JUDGE0_API_KEY) {
  logger.error("JUDGE0_API_KEY environment variable is required - code execution disabled");
  process.exit(1);
}

async function makeJudge0Request(endpoint: string, options: RequestInit = {}) {
  const url = `${JUDGE0_API_URL}${endpoint}`;
  const start = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "X-RapidAPI-Key": JUDGE0_API_KEY!,
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
        errorBody: errorBody.substring(0, 200),
      });

      let clientMessage = "Code execution failed. Please try again.";
      let statusCode: number = response.status;

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

      throw new HTTPException(statusCode as any, {
        message: clientMessage,
      });
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
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

// POST /api/code/execute - Execute code
const executeCodeRoute = createRoute({
  method: "post",
  path: "/execute",
  summary: "Execute code",
  description:
    "Submit code for execution via Judge0. Returns a token that can be used to check execution status. Supports 50+ programming languages.",
  tags: ["Code Execution"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: executeCodeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Code submitted successfully",
      content: {
        "application/json": {
          schema: codeSubmissionResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request body",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    429: {
      description: "Rate limit exceeded - Too many requests",
    },
    503: {
      description: "Code execution service temporarily unavailable",
    },
    504: {
      description: "Request timeout - Code execution took too long",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(executeCodeRoute, async (c) => {
  const startTime = Date.now();
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

// GET /api/code/status/:token - Get execution status
const getStatusRoute = createRoute({
  method: "get",
  path: "/status/{token}",
  summary: "Get execution status",
  description:
    "Check the status of a code execution submission. Returns stdout, stderr, execution time, memory usage, and status information.",
  tags: ["Code Execution"],
  request: {
    params: tokenParamSchema,
  },
  responses: {
    200: {
      description: "Execution status retrieved successfully",
      content: {
        "application/json": {
          schema: codeExecutionStatusSchema,
        },
      },
    },
    400: {
      description: "Invalid token format",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Submission not found",
    },
    503: {
      description: "Code execution service temporarily unavailable",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getStatusRoute, async (c) => {
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

// GET /api/code/languages - Get supported languages
const getLanguagesRoute = createRoute({
  method: "get",
  path: "/languages",
  summary: "Get supported languages",
  description:
    "Returns a list of all programming languages supported by the code execution service, including language IDs and versions.",
  tags: ["Code Execution"],
  responses: {
    200: {
      description: "Languages retrieved successfully",
      content: {
        "application/json": {
          schema: z.array(languageSchema),
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    503: {
      description: "Code execution service temporarily unavailable",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getLanguagesRoute, async (c) => {
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

// GET /api/code/health - Health check
const getHealthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Health check",
  description: "Check the health status of the code execution service and Judge0 connection.",
  tags: ["Code Execution"],
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: codeHealthResponseSchema,
        },
      },
    },
    207: {
      description: "Service is degraded but partially functional",
      content: {
        "application/json": {
          schema: codeHealthResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    503: {
      description: "Service is unhealthy",
      content: {
        "application/json": {
          schema: codeHealthResponseSchema,
        },
      },
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getHealthRoute, async (c) => {
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
      );
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

export default crudRouter;
