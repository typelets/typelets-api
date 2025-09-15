import { AuthenticatedWebSocket, WebSocketConfig } from '../types';

export class RateLimiter {
  constructor(private readonly _config: WebSocketConfig) {}

  checkRateLimit(ws: AuthenticatedWebSocket): boolean {
    const now = Date.now();

    // Initialize rate limiting if not present
    if (!ws.rateLimit) {
      ws.rateLimit = {
        count: 1,
        windowStart: now
      };
      return true;
    }

    // Check if we need to reset the window (atomic check and reset)
    const windowElapsed = now - ws.rateLimit.windowStart;
    if (windowElapsed >= this._config.rateLimitWindowMs) {
      ws.rateLimit = {
        count: 1,
        windowStart: now
      };
      return true;
    }

    // Check if within rate limit
    if (ws.rateLimit.count >= this._config.rateLimitMaxMessages) {
      return false;
    }

    // Increment counter atomically
    ws.rateLimit.count++;
    return true;
  }
}