import { db, notes, folders } from "../../db";
import { eq, and } from "drizzle-orm";
import { AuthenticatedWebSocket, WebSocketMessage, ResourceOperationConfig } from "../types";
import { ConnectionManager } from "../middleware/connection-manager";

export class BaseResourceHandler {
  constructor(protected readonly _connectionManager: ConnectionManager) {}

  async handleResourceOperation(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage,
    config: ResourceOperationConfig
  ): Promise<void> {
    const resourceId = message[config.idField] as string;
    const resourceData = config.dataField ? message[config.dataField] : undefined;

    // Validate required fields
    if (!ws.userId || !resourceId || (config.dataField && !resourceData)) {
      const missingFields = [];
      if (!ws.userId) missingFields.push("userId");
      if (!resourceId) missingFields.push(config.idField);
      if (config.dataField && !resourceData) missingFields.push(config.dataField);

      ws.send(
        JSON.stringify({
          type: "error",
          message: `Missing ${missingFields.join(", ")}`,
        })
      );
      return;
    }

    // Authorization check - MANDATORY for all operations except creation
    if (config.operation !== "created") {
      if (!config.tableName) {
        throw new Error(
          `Authorization required: tableName must be provided for ${config.operation} operations`
        );
      }

      try {
        let existingResource;

        if (config.tableName === "folders") {
          existingResource = await db.query.folders.findFirst({
            where: and(eq(folders.id, resourceId), eq(folders.userId, ws.userId)),
          });
        } else if (config.tableName === "notes") {
          existingResource = await db.query.notes.findFirst({
            where: and(eq(notes.id, resourceId), eq(notes.userId, ws.userId)),
          });
        } else {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(`Unsupported table name: ${config.tableName}`);
        }

        if (!existingResource) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `${config.resourceType.charAt(0).toUpperCase() + config.resourceType.slice(1)} not found or access denied`,
            })
          );
          return;
        }
      } catch (error) {
        console.error(`Error authorizing ${config.resourceType} ${config.operation}:`, error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Failed to ${config.operation.replace("d", "")} ${config.resourceType}`,
          })
        );
        return;
      }
    }

    // For created operations, ensure the user owns the created resource
    if (config.operation === "created" && resourceData) {
      const createdByUserId = (resourceData as Record<string, unknown>).userId;
      if (createdByUserId !== ws.userId) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Access denied: Cannot broadcast resource created by another user",
          })
        );
        return;
      }
    }

    console.log(`User ${ws.userId} ${config.logAction}`);

    // Build sync message
    const syncMessage: Record<string, unknown> = {
      type: config.syncMessageType,
      timestamp: Date.now(),
      fromUserId: ws.userId,
    };

    // Add resource-specific data
    if (config.operation === "created" && resourceData && config.dataField) {
      syncMessage[config.dataField] = resourceData;
    } else if (config.operation === "updated") {
      syncMessage[config.idField] = resourceId;
      syncMessage.changes = message.changes;

      // Add updated resource data based on resource type
      const updatedFieldName = `updated${config.resourceType.charAt(0).toUpperCase() + config.resourceType.slice(1)}`;
      const updatedData = message[updatedFieldName as keyof WebSocketMessage];
      if (updatedData) {
        syncMessage[updatedFieldName] = updatedData;
      }
    } else if (config.operation === "deleted") {
      syncMessage[config.idField] = resourceId;
    }

    // Broadcast to user devices
    const sentCount = this._connectionManager.broadcastToUserDevices(ws.userId, syncMessage, ws);
    console.log(`Broadcasted message to ${sentCount} devices for user ${ws.userId}`);
  }
}
