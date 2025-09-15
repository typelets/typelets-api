import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

class InMemoryRateLimitStore {
  private store = new Map<string, RateLimitStore>();

  get(key: string): RateLimitStore | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: RateLimitStore): void {
    this.store.set(key, value);
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const store = new InMemoryRateLimitStore();

// Cleanup expired entries every 5 minutes
let cleanupInterval: ReturnType<typeof setInterval> | null = setInterval(() => store.cleanup(), 5 * 60 * 1000);

// Graceful cleanup function
export const cleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyGenerator = (c: Context) => {
      // Use combination of IP and user ID for authenticated requests
      const userId = c.get("userId");
      const ip = c.env?.CF_CONNECTING_IP ||
               c.req.header("x-forwarded-for")?.split(",")[0] ||
               c.req.header("x-real-ip") ||
               "unknown";
      return userId ? `${userId}:${ip}` : ip;
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (c: Context, next: Next): Promise<void> => {
    const key = keyGenerator(c);
    const now = Date.now();
    const resetTime = now + windowMs;

    let entry = store.get(key);

    if (!entry) {
      entry = { count: 0, resetTime };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      throw new HTTPException(429, {
        message: "Too Many Requests",
        cause: {
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          limit: max,
          remaining: 0,
          reset: entry.resetTime,
        }
      });
    }

    // Add rate limit headers
    c.res.headers.set("X-RateLimit-Limit", max.toString());
    c.res.headers.set("X-RateLimit-Remaining", Math.max(0, max - entry.count).toString());
    c.res.headers.set("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());

    await next();

    // Optionally skip counting successful/failed requests
    const shouldSkip =
      (skipSuccessfulRequests && c.res.status < 400) ||
      (skipFailedRequests && c.res.status >= 400);

    if (shouldSkip) {
      entry.count--;
    }
  };
};