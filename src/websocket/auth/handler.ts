import { verifyToken } from "@clerk/backend";
import { createHash, createHmac } from "crypto";
import { AuthenticatedWebSocket, WebSocketMessage, WebSocketConfig } from "../types";
import { ConnectionManager } from "../middleware/connection-manager";
import { logger } from "../../lib/logger";

interface AuthenticatedMessage {
  payload: WebSocketMessage;
  signature: string;
  timestamp: number;
  nonce: string;
}

export class AuthHandler {
  private usedNonces = new Map<string, number>(); // Store with timestamp
  private readonly MAX_NONCES = 10000; // Prevent memory exhaustion

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly _config: WebSocketConfig
  ) {
    // Cleanup old nonces every 5 minutes
    setInterval(() => this.cleanupOldNonces(), 5 * 60 * 1000);
  }

  private cleanupOldNonces(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Remove expired nonces
    const noncesToDelete: string[] = [];
    this.usedNonces.forEach((timestamp, nonce) => {
      if (timestamp < fiveMinutesAgo) {
        noncesToDelete.push(nonce);
      }
    });

    // Delete expired nonces
    noncesToDelete.forEach((nonce) => {
      this.usedNonces.delete(nonce);
    });

    // Emergency cleanup if too many nonces (DoS protection)
    if (this.usedNonces.size > this.MAX_NONCES) {
      logger.warn("Nonce storage exceeded limit, clearing all nonces", {
        type: "websocket_security",
        maxNonces: this.MAX_NONCES,
      });
      this.usedNonces.clear();
    }
  }

  setupAuthTimeout(ws: AuthenticatedWebSocket): void {
    ws.authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated) {
        if (process.env.NODE_ENV === "development") {
          console.log("WebSocket connection closed due to authentication timeout");
        }
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Authentication timeout. Connection will be closed.",
          })
        );
        ws.close();
      }
    }, this._config.authTimeoutMs);
  }

  async handleAuthentication(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    try {
      if (!message.token) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error("Token is required");
      }

      const payload = await verifyToken(message.token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      const userId = payload.sub;

      // Check connection limit before allowing authentication
      if (!this.connectionManager.checkConnectionLimit(userId)) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Maximum connections exceeded for this user",
          })
        );
        ws.close();
        return;
      }

      ws.userId = userId;
      ws.isAuthenticated = true;
      ws.jwtToken = message.token; // Store JWT token for signature verification

      // Clear authentication timeout since user is now authenticated
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
        ws.authTimeout = undefined;
      }

      // Generate session secret for auth_success response (matching frontend exactly)
      const timestamp = Date.now();
      const flooredTimestamp = Math.floor(timestamp / 300000) * 300000; // 5-minute window

      const sessionSecret = createHash("sha256")
        .update(`${message.token}:${userId}:${flooredTimestamp}`)
        .digest("hex");

      // Store session secret for this connection (for reference only)
      ws.sessionSecret = sessionSecret;

      this.connectionManager.addUserConnection(userId, ws);

      ws.send(
        JSON.stringify({
          type: "auth_success",
          message: "Authentication successful",
          userId: ws.userId,
          sessionSecret: sessionSecret,
        })
      );

      if (process.env.NODE_ENV === "development") {
        console.log(`User ${ws.userId} authenticated via WebSocket`);
      }
    } catch (error: unknown) {
      logger.error(
        "WebSocket authentication failed",
        { type: "websocket_auth_error" },
        error instanceof Error ? error : new Error(String(error))
      );

      const isTokenExpired = (error as Record<string, unknown>)?.reason === "token-expired";

      ws.send(
        JSON.stringify({
          type: "auth_failed",
          message: isTokenExpired ? "Token expired" : "Authentication failed",
          reason: isTokenExpired ? "token-expired" : "auth-failed",
        })
      );
      ws.close();
    }
  }

  /**
   * Verify message signature for authenticated messages (Phase 2)
   * @param authMessage - The authenticated message structure
   * @param storedSessionSecret - The session secret for this connection (hex string)
   * @param jwtToken - The JWT token for regenerating session secret
   * @param userId - The user ID for regenerating session secret
   * @returns Promise<boolean> - True if signature is valid
   */
  async verifyMessageSignature(
    authMessage: AuthenticatedMessage,
    storedSessionSecret: string,
    jwtToken?: string,
    userId?: string
  ): Promise<boolean> {
    const { payload, signature, timestamp, nonce } = authMessage;

    // 1. Timestamp validation (5-minute window + 1 minute tolerance for clock skew)
    const messageAge = Date.now() - timestamp;
    const MAX_MESSAGE_AGE = 5 * 60 * 1000; // 5 minutes
    if (messageAge > MAX_MESSAGE_AGE || messageAge < -60000) {
      // -60 seconds tolerance for clock skew
      logger.warn("Message rejected: timestamp out of range", {
        type: "websocket_security",
        messageAge,
        maxAge: MAX_MESSAGE_AGE,
      });
      return false;
    }

    // 2. Check for replay attack using nonce
    const nonceKey = `${nonce}:${timestamp}`;
    if (this.usedNonces.has(nonceKey)) {
      logger.warn("Message rejected: nonce already used (replay attack)", {
        type: "websocket_security",
      });
      return false;
    }

    try {
      // 3. Validate required parameters
      if (!jwtToken || !userId) {
        logger.warn("Missing JWT token or user ID for signature verification", {
          type: "websocket_security",
        });
        return false;
      }

      // 4. Regenerate session secret for this timestamp window (matching frontend exactly)
      const flooredTimestamp = Math.floor(timestamp / 300000) * 300000;
      const sessionSecretInput = `${jwtToken}:${userId}:${flooredTimestamp}`;

      // 5. FIXED: Use hex session secret directly as HMAC key (matching frontend)
      // Frontend uses the hex string directly, not converted to buffer
      const sessionSecret = createHash("sha256").update(sessionSecretInput, "utf8").digest("hex");

      // 6. Create exact message data that was signed (order matters!)
      const messageToSign = { payload, timestamp, nonce };
      const messageData = JSON.stringify(messageToSign);

      // 7. Generate expected signature using hex string directly
      const expectedSignature = createHmac("sha256", sessionSecret)
        .update(messageData, "utf8")
        .digest("base64");

      // 8. Test stored session secret with same approach
      const storedSecretSignature = createHmac("sha256", storedSessionSecret)
        .update(messageData, "utf8")
        .digest("base64");

      // 9. Compare signatures - check both regenerated and stored secret approaches
      const isValidRegenerated = expectedSignature === signature;
      const isValidStored = storedSecretSignature === signature;
      const isValid = isValidRegenerated || isValidStored;

      if (!isValid) {
        logger.warn("Message signature verification failed", {
          type: "websocket_security",
          userId: userId || "unknown",
        });
      }

      if (isValid) {
        // Mark nonce as used with current timestamp
        this.usedNonces.set(nonceKey, Date.now());
      }

      return isValid;
    } catch (error) {
      logger.error(
        "Error verifying message signature",
        { type: "websocket_auth_error" },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Process incoming WebSocket message with optional authentication
   * @param ws - The WebSocket connection
   * @param rawMessage - The raw message (could be authenticated or plain)
   * @returns The extracted message payload or null if verification fails
   */
  async processIncomingMessage(
    ws: AuthenticatedWebSocket,
    rawMessage: unknown
  ): Promise<WebSocketMessage | null> {
    // Type guard to check if this is an authenticated message structure
    if (this.isAuthenticatedMessage(rawMessage)) {
      // This is an authenticated message, verify signature
      if (!ws.sessionSecret) {
        logger.warn("Authenticated message received but no session secret available", {
          type: "websocket_security",
        });
        return null;
      }

      const isValid = await this.verifyMessageSignature(
        rawMessage,
        ws.sessionSecret,
        ws.jwtToken,
        ws.userId
      );
      if (!isValid) {
        logger.warn("Message signature verification failed", {
          type: "websocket_security",
          userId: ws.userId || "unknown",
        });
        return null;
      }

      // Return the payload from authenticated message
      return rawMessage.payload;
    }

    // Handle non-authenticated messages (backward compatibility)
    return rawMessage as WebSocketMessage;
  }

  /**
   * Type guard to check if a message has authentication structure
   */
  private isAuthenticatedMessage(message: unknown): message is AuthenticatedMessage {
    if (typeof message !== "object" || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;

    return (
      "payload" in msg &&
      "signature" in msg &&
      "timestamp" in msg &&
      "nonce" in msg &&
      typeof msg.signature === "string" &&
      typeof msg.timestamp === "number" &&
      typeof msg.nonce === "string"
    );
  }
}
