import { WebSocketServer } from "ws";
import { Server } from "http";
import {
  AuthenticatedWebSocket,
  WebSocketMessage,
  WebSocketConfig,
  ConnectionStats,
} from "./types";
import { RateLimiter } from "./middleware/rate-limiter";
import { ConnectionManager } from "./middleware/connection-manager";
import { AuthHandler } from "./auth/handler";
import { NoteHandler } from "./handlers/notes";
import { FolderHandler } from "./handlers/folders";
import { logger } from "../lib/logger";

export class WebSocketManager {
  private wss: WebSocketServer;
  private config: WebSocketConfig;
  private rateLimiter: RateLimiter;
  private connectionManager: ConnectionManager;
  private authHandler: AuthHandler;
  private noteHandler: NoteHandler;
  private folderHandler: FolderHandler;
  private static instance: WebSocketManager | null = null;

  constructor(server: Server) {
    this.config = {
      rateLimitWindowMs: parseInt(process.env.WS_RATE_LIMIT_WINDOW_MS || "60000"),
      rateLimitMaxMessages: parseInt(process.env.WS_RATE_LIMIT_MAX_MESSAGES || "300"), // Increased from 60 to 300
      maxConnectionsPerUser: parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || "20"), // Increased from 10 to 20
      authTimeoutMs: parseInt(process.env.WS_AUTH_TIMEOUT_MS || "30000"),
    };

    this.rateLimiter = new RateLimiter(this.config);
    this.connectionManager = new ConnectionManager(this.config);
    this.authHandler = new AuthHandler(this.connectionManager, this.config);
    this.noteHandler = new NoteHandler(this.connectionManager);
    this.folderHandler = new FolderHandler(this.connectionManager);

    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
    WebSocketManager.instance = this;
  }

  public static getInstance(): WebSocketManager | null {
    return WebSocketManager.instance;
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: AuthenticatedWebSocket) => {
      const connectionStart = Date.now();
      // Add connection start time for duration tracking
      ws.connectionStart = connectionStart;

      if (process.env.NODE_ENV === "development") {
        logger.websocketEvent(
          "connection",
          "anonymous",
          undefined,
          undefined,
          undefined,
          "established"
        );
      }

      // Set authentication timeout
      this.authHandler.setupAuthTimeout(ws);

      ws.on("message", async (data: Buffer): Promise<void> => {
        let rawMessage: { type?: string } | undefined;
        try {
          // Message size validation (prevent DoS attacks)
          const maxMessageSize = 1024 * 1024; // 1MB limit
          if (data.length > maxMessageSize) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Message too large. Maximum size is 1MB.",
              })
            );
            console.warn(
              `WebSocket message too large: ${data.length} bytes from user ${ws.userId || "unauthenticated"}`
            );
            return;
          }

          // Rate limiting check
          if (!this.rateLimiter.checkRateLimit(ws)) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Rate limit exceeded. Please slow down.",
              })
            );
            return;
          }

          rawMessage = JSON.parse(data.toString());

          // Track WebSocket message processing performance
          const messageStart = Date.now();

          // Process message with optional authentication verification
          const message = await this.authHandler.processIncomingMessage(ws, rawMessage);

          if (message === null) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Message authentication failed",
              })
            );
            return;
          }

          await this.handleMessage(ws, message);

          const messageDuration = Date.now() - messageStart;

          // Log WebSocket performance in development
          if (process.env.NODE_ENV === "development") {
            logger.websocketEvent(
              message.type,
              ws.userId || "anonymous",
              messageDuration,
              undefined,
              undefined,
              messageDuration > 2000 ? "slow" : messageDuration > 1000 ? "medium" : "fast"
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("Error handling WebSocket message", {
            messageType: rawMessage?.type || "unknown",
            error: errorMessage,
          });

          // WebSocket metrics WebSocket message errors
          // Error tracking available via console logs

          ws.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
            })
          );
        }
      });

      ws.on("close", (): void => {
        // Track connection duration
        const connectionDuration = Date.now() - (ws.connectionStart || Date.now());

        if (process.env.NODE_ENV === "development") {
          logger.websocketEvent(
            "disconnection",
            ws.userId || "anonymous",
            connectionDuration,
            undefined,
            undefined,
            "closed"
          );
        }

        this.handleDisconnection(ws);
      });

      ws.on("error", (error: Error): void => {
        console.error("WebSocket error", { error: error.message });

        // Send WebSocket connection errors to New Relic
        // WebSocket metrics WebSocket connection errors
        // Error tracking available via console logs
      });

      ws.send(
        JSON.stringify({
          type: "connection_established",
          message: "Please authenticate to continue",
        })
      );
    });
  }

  private async handleMessage(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    switch (message.type) {
      case "auth":
        await this.authHandler.handleAuthentication(ws, message);
        break;
      case "note_update":
        if (ws.isAuthenticated) {
          await this.noteHandler.handleNoteUpdate(ws, message);
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Authentication required",
            })
          );
        }
        break;
      case "join_note":
        if (ws.isAuthenticated) {
          await this.noteHandler.handleJoinNote(ws, message);
        }
        break;
      case "leave_note":
        if (ws.isAuthenticated) {
          this.noteHandler.handleLeaveNote(ws, message);
        }
        break;
      case "note_created":
        if (ws.isAuthenticated) {
          await this.noteHandler.handleNoteCreated(ws, message);
        }
        break;
      case "note_deleted":
        if (ws.isAuthenticated) {
          await this.noteHandler.handleNoteDeleted(ws, message);
        }
        break;
      case "folder_created":
        if (ws.isAuthenticated) {
          await this.folderHandler.handleFolderCreated(ws, message);
        }
        break;
      case "folder_updated":
        if (ws.isAuthenticated) {
          await this.folderHandler.handleFolderUpdated(ws, message);
        }
        break;
      case "folder_deleted":
        if (ws.isAuthenticated) {
          await this.folderHandler.handleFolderDeleted(ws, message);
        }
        break;
      case "ping":
        ws.send(
          JSON.stringify({
            type: "pong",
            timestamp: Date.now(),
          })
        );
        break;
      default:
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Unknown message type",
          })
        );
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    this.connectionManager.cleanupConnection(ws);
  }

  public getConnectionStats(): ConnectionStats {
    return this.connectionManager.getConnectionStats(this.wss.clients.size);
  }

  // Public methods for server-triggered notifications
  public notifyNoteUpdate(
    userId: string,
    noteId: string,
    changes: Record<string, unknown>,
    updatedNote: Record<string, unknown>
  ): void {
    const syncMessage = {
      type: "note_sync",
      noteId,
      changes,
      updatedNote,
      timestamp: Date.now(),
      fromUserId: "server",
    };

    const sentCount = this.connectionManager.broadcastToUserDevices(userId, syncMessage);

    if (process.env.NODE_ENV === "development") {
      logger.websocketEvent(
        "note_update_notification",
        userId,
        undefined,
        noteId,
        "note",
        `${sentCount}_devices`
      );
    }
  }

  public notifyNoteCreated(userId: string, noteData: Record<string, unknown>): void {
    const createMessage = {
      type: "note_created_sync",
      noteData,
      timestamp: Date.now(),
      fromUserId: "server",
    };

    const sentCount = this.connectionManager.broadcastToUserDevices(userId, createMessage);

    if (process.env.NODE_ENV === "development") {
      logger.websocketEvent(
        "note_created_notification",
        userId,
        undefined,
        noteData.id as string,
        "note",
        `${sentCount}_devices`
      );
    }
  }

  public notifyNoteDeleted(userId: string, noteId: string): void {
    const deleteMessage = {
      type: "note_deleted_sync",
      noteId,
      timestamp: Date.now(),
      fromUserId: "server",
    };

    const sentCount = this.connectionManager.broadcastToUserDevices(userId, deleteMessage);

    if (process.env.NODE_ENV === "development") {
      logger.websocketEvent(
        "note_deleted_notification",
        userId,
        undefined,
        noteId,
        "note",
        `${sentCount}_devices`
      );
    }
  }

  public notifyFolderCreated(userId: string, folderData: Record<string, unknown>): void {
    const createMessage = {
      type: "folder_created_sync",
      folderData,
      timestamp: Date.now(),
      fromUserId: "server",
    };

    const sentCount = this.connectionManager.broadcastToUserDevices(userId, createMessage);

    if (process.env.NODE_ENV === "development") {
      logger.websocketEvent(
        "folder_created_notification",
        userId,
        undefined,
        folderData.id as string,
        "folder",
        `${sentCount}_devices`
      );
    }
  }

  public notifyFolderUpdated(
    userId: string,
    folderId: string,
    changes: Record<string, unknown>,
    updatedFolder: Record<string, unknown>
  ): void {
    const updateMessage = {
      type: "folder_updated_sync",
      folderId,
      changes,
      updatedFolder,
      timestamp: Date.now(),
      fromUserId: "server",
    };

    const sentCount = this.connectionManager.broadcastToUserDevices(userId, updateMessage);

    if (process.env.NODE_ENV === "development") {
      logger.websocketEvent(
        "folder_updated_notification",
        userId,
        undefined,
        folderId,
        "folder",
        `${sentCount}_devices`
      );
    }
  }

  public notifyFolderDeleted(userId: string, folderId: string): void {
    const deleteMessage = {
      type: "folder_deleted_sync",
      folderId,
      timestamp: Date.now(),
      fromUserId: "server",
    };

    const sentCount = this.connectionManager.broadcastToUserDevices(userId, deleteMessage);

    if (process.env.NODE_ENV === "development") {
      logger.websocketEvent(
        "folder_deleted_notification",
        userId,
        undefined,
        folderId,
        "folder",
        `${sentCount}_devices`
      );
    }
  }
}

// Export the class and types for external use
export * from "./types";
export { WebSocketManager as default };
