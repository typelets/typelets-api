import { db, notes } from "../../db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedWebSocket, WebSocketMessage } from "../types";
import { ConnectionManager } from "../middleware/connection-manager";
import { BaseResourceHandler } from "./base";

export class NoteHandler extends BaseResourceHandler {
  constructor(connectionManager: ConnectionManager) {
    super(connectionManager);
  }

  async handleJoinNote(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    if (!message.noteId || !ws.userId) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Missing noteId or userId",
        })
      );
      return;
    }

    try {
      // Verify the user owns this note before allowing them to join
      const existingNote = await db.query.notes.findFirst({
        where: and(eq(notes.id, message.noteId), eq(notes.userId, ws.userId)),
      });

      if (!existingNote) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Note not found or access denied",
          })
        );
        return;
      }

      console.log(`User ${ws.userId} joined note ${message.noteId}`);

      // Track this connection for the specific note
      this._connectionManager.addNoteConnection(message.noteId, ws);

      ws.send(
        JSON.stringify({
          type: "note_joined",
          noteId: message.noteId,
          message: "Successfully joined note for real-time sync",
        })
      );
    } catch (error) {
      console.error("Error joining note:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to join note",
        })
      );
    }
  }

  handleLeaveNote(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (!message.noteId) {
      return;
    }

    console.log(`User ${ws.userId} left note ${message.noteId}`);

    // Remove connection from note tracking
    this._connectionManager.removeNoteConnection(message.noteId, ws);

    ws.send(
      JSON.stringify({
        type: "note_left",
        noteId: message.noteId,
      })
    );
  }

  async handleNoteUpdate(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    if (!ws.userId || !message.noteId) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Missing userId or noteId",
        })
      );
      return;
    }

    try {
      // Verify the user owns this note
      const existingNote = await db.query.notes.findFirst({
        where: and(eq(notes.id, message.noteId), eq(notes.userId, ws.userId)),
      });

      if (!existingNote) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Note not found or access denied",
          })
        );
        return;
      }

      // Apply the changes to the database
      if (message.changes && Object.keys(message.changes).length > 0) {
        const allowedFields = [
          "title",
          "content",
          "encryptedTitle",
          "encryptedContent",
          "starred",
          "archived",
          "deleted",
          "hidden",
          "folderId",
        ];
        const filteredChanges: Record<string, unknown> = {};

        Object.keys(message.changes).forEach((key) => {
          if (allowedFields.includes(key)) {
            const value = (message.changes as Record<string, unknown>)[key];

            // Validate title and content fields must be [ENCRYPTED]
            if (
              (key === "title" || key === "content") &&
              typeof value === "string" &&
              value !== "[ENCRYPTED]"
            ) {
              console.warn(
                `Note update: rejected plaintext ${key} for note ${message.noteId} - must be [ENCRYPTED]`
              );
              return;
            }

            filteredChanges[key] = value;
          } else {
            console.warn(
              `Note update: filtered out disallowed field '${key}' for note ${message.noteId}`
            );
          }
        });

        if (Object.keys(filteredChanges).length > 0) {
          console.log(`Note update: applying changes to note ${message.noteId}:`, filteredChanges);
          filteredChanges.updatedAt = new Date();

          const [updatedNote] = await db
            .update(notes)
            .set(filteredChanges)
            .where(eq(notes.id, message.noteId))
            .returning();

          console.log(`Note ${message.noteId} updated by user ${ws.userId}`);

          // Broadcast the successful update to all user devices
          const syncMessage = {
            type: "note_sync",
            noteId: message.noteId,
            changes: filteredChanges,
            updatedNote,
            timestamp: Date.now(),
            fromUserId: ws.userId,
          };

          const sentCount = this._connectionManager.broadcastToUserDevices(
            ws.userId,
            syncMessage,
            ws
          );
          console.log(`Broadcasted message to ${sentCount} devices for user ${ws.userId}`);

          // Send confirmation to the originating device
          ws.send(
            JSON.stringify({
              type: "note_update_success",
              noteId: message.noteId,
              updatedNote,
              timestamp: Date.now(),
            })
          );
        } else {
          console.warn(
            `Note update: no valid changes found for note ${message.noteId}, original changes:`,
            message.changes
          );
          ws.send(
            JSON.stringify({
              type: "error",
              message: "No valid fields to update",
            })
          );
        }
      }
    } catch (error) {
      console.error("Error handling note update:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to update note",
        })
      );
    }
  }

  async handleNoteCreated(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    return this.handleResourceOperation(ws, message, {
      resourceType: "note",
      operation: "created",
      idField: "noteId",
      dataField: "noteData",
      requiresAuth: false,
      syncMessageType: "note_created_sync",
      logAction: `created note ${message.noteData?.id}`,
    });
  }

  async handleNoteDeleted(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    return this.handleResourceOperation(ws, message, {
      resourceType: "note",
      operation: "deleted",
      idField: "noteId",
      tableName: "notes",
      syncMessageType: "note_deleted_sync",
      logAction: `deleted note ${message.noteId}`,
    });
  }
}
