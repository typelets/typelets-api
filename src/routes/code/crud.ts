import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "@hono/zod-openapi";
import { logger } from "../../lib/logger";
import {
  executeCodeRequestSchema,
  codeExecutionStatusSchema,
  languageSchema,
  codeHealthResponseSchema,
  tokenParamSchema,
} from "../../lib/openapi-schemas";

const crudRouter = new OpenAPIHono();

// Piston API configuration (private VPC endpoint)
const PISTON_API_URL = process.env.PISTON_API_URL;

if (!PISTON_API_URL) {
  logger.error("PISTON_API_URL environment variable is required - code execution disabled");
  process.exit(1);
}

// Language mapping from Judge0 language_id to Piston language names
const JUDGE0_TO_PISTON_LANGUAGE: Record<number, string | null> = {
  63: "javascript", // JavaScript (Node.js 12.14.0)
  74: "typescript", // TypeScript (3.7.4)
  71: "python", // Python (3.8.1)
  62: "java", // Java (OpenJDK 13.0.1)
  54: "cpp", // C++ (GCC 9.2.0)
  50: "c", // C (GCC 9.2.0)
  51: "csharp", // C# (Mono 6.6.0.161)
  60: "go", // Go (1.13.5)
  73: "rust", // Rust (1.40.0)
  68: "php", // PHP (7.4.1)
  72: "ruby", // Ruby (2.7.0)
  78: "kotlin", // Kotlin (1.3.70)
  83: "swift", // Swift (5.2.3)
  46: "bash", // Bash (5.0.0)
  82: null, // SQL (SQLite 3.27.2) - not supported by Piston
};

// Piston language to version mapping
const PISTON_LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  cpp: "c++", // Note: frontend sends "cpp", Piston expects "c++"
  c: "c",
  csharp: "csharp",
  go: "go",
  rust: "rust",
  php: "php",
  ruby: "ruby",
  kotlin: "kotlin",
  swift: "swift",
  bash: "bash",
};

const PISTON_VERSION_MAP: Record<string, string> = {
  javascript: "20.11.1",
  typescript: "5.0.3",
  python: "3.12.0",
  java: "15.0.2",
  cpp: "10.2.0",
  c: "10.2.0",
  csharp: "5.0.201",
  go: "1.16.2",
  rust: "1.68.2",
  php: "8.2.3",
  ruby: "3.0.1",
  kotlin: "1.8.20",
  swift: "5.3.3",
  bash: "5.2.0",
};

async function makePistonRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${PISTON_API_URL}${endpoint}`;
  const start = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - start;
    logger.debug("Piston API request", {
      method: options.method || "GET",
      endpoint,
      duration,
      status: response.status,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("Piston API Error", {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        errorBody: errorBody.substring(0, 200),
      });

      throw new HTTPException(503, {
        message: "Code execution service temporarily unavailable",
      });
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      logger.error("Piston API timeout", { endpoint });
      throw new HTTPException(504, {
        message: "Code execution timed out. Please try again.",
      });
    }

    logger.error(
      "Piston API request failed",
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

// POST /api/code/execute - Execute code (now synchronous with Piston)
const executeCodeRoute = createRoute({
  method: "post",
  path: "/execute",
  summary: "Execute code",
  description:
    "Execute code immediately via Piston. Returns execution results synchronously. Supports 14+ programming languages.",
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
      description: "Code executed successfully",
      content: {
        "application/json": {
          schema: codeExecutionStatusSchema,
        },
      },
    },
    400: {
      description: "Invalid request body or unsupported language",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
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
  try {
    const body = c.req.valid("json");

    // Convert Judge0 language_id to Piston language
    const pistonLanguageKey = JUDGE0_TO_PISTON_LANGUAGE[body.language_id];

    if (pistonLanguageKey === null) {
      return c.json(
        {
          stdout: "",
          stderr: "Language not supported by Piston execution service",
          compile_output: null,
          message: null,
          status: {
            id: 6,
            description: "Not Supported",
          },
          time: "0",
          memory: null,
        },
        200
      );
    }

    if (pistonLanguageKey === undefined) {
      throw new HTTPException(400, {
        message: `Invalid language_id: ${body.language_id}`,
      });
    }

    const pistonLanguage = PISTON_LANGUAGE_MAP[pistonLanguageKey];
    const pistonVersion = PISTON_VERSION_MAP[pistonLanguageKey];

    if (!pistonLanguage || !pistonVersion) {
      return c.json(
        {
          stdout: "",
          stderr: `Language ${pistonLanguageKey} is not supported`,
          compile_output: null,
          message: null,
          status: {
            id: 6,
            description: "Not Supported",
          },
          time: "0",
          memory: null,
        },
        200
      );
    }

    // Prepare Piston request
    const pistonRequest = {
      language: pistonLanguage,
      version: pistonVersion,
      files: [
        {
          content: body.source_code,
        },
      ],
      stdin: body.stdin || "",
    };

    // Execute code on Piston (synchronous)
    const response = await makePistonRequest("/execute", {
      method: "POST",
      body: JSON.stringify(pistonRequest),
    });

    const result = await response.json();

    // Convert Piston response to Judge0-compatible format for frontend
    const formattedResponse = {
      stdout: result.run?.stdout || "",
      stderr: result.run?.stderr || "",
      compile_output: result.compile?.output || null,
      message: result.run?.signal ? `Process killed by signal: ${result.run.signal}` : null,
      status: {
        id: result.run?.code === 0 ? 3 : 6,
        description: result.run?.code === 0 ? "Accepted" : "Runtime Error",
      },
      time: result.run?.cpu_time ? String(result.run.cpu_time) : "0",
      memory: result.run?.memory || null,
      token: null, // No token needed for synchronous execution
    };

    return c.json(formattedResponse);
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
      message: "Failed to execute code",
    });
  }
});

// GET /api/code/status/:token - Get execution status (legacy endpoint, now unused)
const getStatusRoute = createRoute({
  method: "get",
  path: "/status/{token}",
  summary: "Get execution status (deprecated)",
  description:
    "Legacy endpoint for Judge0 compatibility. Piston executes synchronously, so this endpoint is no longer needed.",
  tags: ["Code Execution"],
  request: {
    params: tokenParamSchema,
  },
  responses: {
    200: {
      description: "Status endpoint deprecated",
      content: {
        "application/json": {
          schema: codeExecutionStatusSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    410: {
      description: "Endpoint deprecated - use /execute directly",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getStatusRoute, async (c) => {
  // Return 410 Gone to indicate this endpoint is deprecated
  return c.json(
    {
      stdout: "",
      stderr: "This endpoint is deprecated. Piston executes code synchronously.",
      compile_output: null,
      message: "Use POST /api/code/execute for immediate results",
      status: {
        id: 6,
        description: "Deprecated",
      },
      time: "0",
      memory: null,
    },
    410
  );
});

// GET /api/code/languages - Get supported languages
const getLanguagesRoute = createRoute({
  method: "get",
  path: "/languages",
  summary: "Get supported languages",
  description:
    "Returns a list of all programming languages supported by Piston, with Judge0-compatible IDs for frontend compatibility.",
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
    // Return static list of supported languages with Judge0-compatible IDs
    const languages = [
      { id: 63, name: "JavaScript (Node.js 20.11.1)" },
      { id: 74, name: "TypeScript (5.0.3)" },
      { id: 71, name: "Python (3.12.0)" },
      { id: 62, name: "Java (OpenJDK 15.0.2)" },
      { id: 54, name: "C++ (GCC 10.2.0)" },
      { id: 50, name: "C (GCC 10.2.0)" },
      { id: 51, name: "C# (Mono 5.0.201)" },
      { id: 60, name: "Go (1.16.2)" },
      { id: 73, name: "Rust (1.68.2)" },
      { id: 68, name: "PHP (8.2.3)" },
      { id: 72, name: "Ruby (3.0.1)" },
      { id: 78, name: "Kotlin (1.8.20)" },
      { id: 83, name: "Swift (5.3.3)" },
      { id: 46, name: "Bash (5.2.0)" },
    ];

    return c.json(languages);
  } catch (error) {
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
  description: "Check the health status of the code execution service and Piston connection.",
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
    // Test Piston with a simple JavaScript execution
    const response = await makePistonRequest("/execute", {
      method: "POST",
      body: JSON.stringify({
        language: "javascript",
        version: "20.11.1",
        files: [{ content: "console.log('health check')" }],
      }),
    });

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
      "Piston health check failed",
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
