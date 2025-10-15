import { WebSocket } from "ws";
import { AuthenticatedWebSocket, WebSocketConfig, ConnectionStats } from "../types";

export class ConnectionManager {
  private userConnections = new Map<string, Set<AuthenticatedWebSocket>>();
  private noteConnections = new Map<string, Set<AuthenticatedWebSocket>>();

  constructor(private readonly _config: WebSocketConfig) {}

  addUserConnection(userId: string, ws: AuthenticatedWebSocket): void {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);
  }

  removeUserConnection(userId: string, ws: AuthenticatedWebSocket): void {
    const connections = this.userConnections.get(userId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  addNoteConnection(noteId: string, ws: AuthenticatedWebSocket): void {
    if (!this.noteConnections.has(noteId)) {
      this.noteConnections.set(noteId, new Set());
    }
    this.noteConnections.get(noteId)!.add(ws);
  }

  removeNoteConnection(noteId: string, ws: AuthenticatedWebSocket): void {
    const noteConnections = this.noteConnections.get(noteId);
    if (noteConnections) {
      noteConnections.delete(ws);
      if (noteConnections.size === 0) {
        this.noteConnections.delete(noteId);
      }
    }
  }

  checkConnectionLimit(userId: string): boolean {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) {
      return true;
    }

    // Clean up closed connections first
    const activeConnections = Array.from(userConnections).filter(
      (conn) => conn.readyState === WebSocket.OPEN
    );

    // Update the set with only active connections
    if (activeConnections.length !== userConnections.size) {
      this.userConnections.set(userId, new Set(activeConnections));
    }

    return activeConnections.length < this._config.maxConnectionsPerUser;
  }

  broadcastToUserDevices(
    userId: string,
    message: Record<string, unknown>,
    excludeWs?: AuthenticatedWebSocket
  ): number {
    const connections = this.userConnections.get(userId);
    if (!connections) return 0;

    let sentCount = 0;
    connections.forEach((conn) => {
      if (conn !== excludeWs && conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify(message));
        sentCount++;
      }
    });

    return sentCount;
  }

  cleanupConnection(ws: AuthenticatedWebSocket): void {
    // Clear authentication timeout if still active
    if (ws.authTimeout) {
      clearTimeout(ws.authTimeout);
      ws.authTimeout = undefined;
    }

    if (ws.userId) {
      this.removeUserConnection(ws.userId, ws);

      // Clean up note connections
      this.noteConnections.forEach((noteConnections, noteId) => {
        if (noteConnections.has(ws)) {
          noteConnections.delete(ws);
          if (noteConnections.size === 0) {
            this.noteConnections.delete(noteId);
          }
        }
      });
    }
  }

  getConnectionStats(totalConnections: number): ConnectionStats {
    return {
      totalConnections,
      authenticatedUsers: this.userConnections.size,
      connectionsPerUser: Array.from(this.userConnections.entries()).map(
        ([userId, connections]) => ({
          userId,
          deviceCount: connections.size,
        })
      ),
    };
  }
}
