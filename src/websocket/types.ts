import { WebSocket } from 'ws';

export interface RateLimitInfo {
  count: number;
  windowStart: number;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  rateLimit?: RateLimitInfo;
  authTimeout?: ReturnType<typeof setTimeout>;
  sessionSecret?: string;
  jwtToken?: string;
}

export interface WebSocketMessage {
  type: string;
  token?: string;
  noteId?: string;
  folderId?: string;
  noteData?: Record<string, unknown>;
  folderData?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  updatedNote?: Record<string, unknown>;
  updatedFolder?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ResourceOperationConfig {
  resourceType: 'folder' | 'note';
  operation: 'created' | 'updated' | 'deleted';
  idField: string;
  dataField?: string;
  requiresAuth?: boolean;
  tableName?: 'folders' | 'notes';
  syncMessageType: string;
  logAction: string;
}

export interface ConnectionStats {
  totalConnections: number;
  authenticatedUsers: number;
  connectionsPerUser: Array<{
    userId: string;
    deviceCount: number;
  }>;
}

export interface WebSocketConfig {
  rateLimitWindowMs: number;
  rateLimitMaxMessages: number;
  maxConnectionsPerUser: number;
  authTimeoutMs: number;
}