import { AuthenticatedWebSocket, WebSocketMessage } from '../types';
import { ConnectionManager } from '../middleware/connection-manager';
import { BaseResourceHandler } from './base';

export class FolderHandler extends BaseResourceHandler {
  constructor(connectionManager: ConnectionManager) {
    super(connectionManager);
  }

  async handleFolderCreated(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    return this.handleResourceOperation(ws, message, {
      resourceType: 'folder',
      operation: 'created',
      idField: 'folderId',
      dataField: 'folderData',
      requiresAuth: false,
      syncMessageType: 'folder_created_sync',
      logAction: `created folder ${message.folderData?.id}`
    });
  }

  async handleFolderUpdated(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    return this.handleResourceOperation(ws, message, {
      resourceType: 'folder',
      operation: 'updated',
      idField: 'folderId',
      requiresAuth: true,
      tableName: 'folders',
      syncMessageType: 'folder_updated_sync',
      logAction: `updated folder ${message.folderId}`
    });
  }

  async handleFolderDeleted(ws: AuthenticatedWebSocket, message: WebSocketMessage): Promise<void> {
    return this.handleResourceOperation(ws, message, {
      resourceType: 'folder',
      operation: 'deleted',
      idField: 'folderId',
      requiresAuth: true,
      tableName: 'folders',
      syncMessageType: 'folder_deleted_sync',
      logAction: `deleted folder ${message.folderId}`
    });
  }
}