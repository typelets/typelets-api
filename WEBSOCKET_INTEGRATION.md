# WebSocket Integration - Backend Implementation

This document describes the backend WebSocket implementation for real-time note synchronization in the Typelets API.

## Overview

The WebSocket server enables:
- **Real-time synchronization** across multiple client sessions
- **Authenticated connections** using Clerk JWT tokens
- **Rate limiting and DoS protection** for production security
- **Optional HMAC message authentication** for enhanced security
- **Connection management** with automatic cleanup

## Architecture

### Core Components

1. **WebSocket Manager** (`src/websocket/index.ts`)
   - Main WebSocket server management
   - Message routing and handling
   - Client connection lifecycle

2. **Authentication Handler** (`src/websocket/auth/handler.ts`)
   - JWT token validation via Clerk
   - Optional HMAC message signing verification
   - Session management and timeouts

3. **Message Handlers**
   - **Note Handler** (`src/websocket/handlers/notes.ts`) - Note operations
   - **Folder Handler** (`src/websocket/handlers/folders.ts`) - Folder operations

4. **Middleware**
   - **Rate Limiter** (`src/websocket/middleware/rate-limiter.ts`)
   - **Connection Manager** (`src/websocket/middleware/connection-manager.ts`)

5. **Type Definitions** (`src/websocket/types.ts`)
   - TypeScript interfaces for all WebSocket messages and connections

## Message Protocol

### Client → Server Messages

```typescript
// Authentication (required first)
{
  type: "auth",
  token: "clerk_jwt_token_here"
}

// Join/leave specific notes for updates
{
  type: "join_note",
  noteId: "uuid"
}

{
  type: "leave_note",
  noteId: "uuid"
}

// Send note updates
{
  type: "note_update",
  noteId: "uuid",
  changes: {
    title?: "New Title",
    content?: "New content",
    encryptedTitle?: "encrypted_title_here",
    encryptedContent?: "encrypted_content_here",
    folderId?: "new_folder_id",
    starred?: true,
    archived?: false,
    deleted?: true,
    hidden?: false
  }
}

// Notify of new notes/folders
{
  type: "note_created",
  noteData: { id: "uuid", title: "New Note", /* full note object */ }
}

{
  type: "folder_created",
  folderData: { id: "uuid", name: "New Folder", /* full folder object */ }
}

// Notify of deletions
{
  type: "note_deleted",
  noteId: "uuid"
}

{
  type: "folder_deleted",
  folderId: "uuid"
}

// Heartbeat
{
  type: "ping"
}
```

### Server → Client Messages

```typescript
// Connection established
{
  type: "connection_established",
  message: "Please authenticate to continue"
}

// Authentication responses
{
  type: "auth_success",
  message: "Authentication successful",
  userId: "user_id",
  sessionSecret?: "hex_string" // For HMAC authentication
}

{
  type: "auth_failed",
  message: "Authentication failed",
  reason?: "token-expired" | "auth-failed"
}

// Real-time sync messages
{
  type: "note_sync",
  noteId: "uuid",
  changes: { title: "Updated Title" },
  updatedNote: { /* complete updated note object */ },
  timestamp: 1234567890,
  fromUserId: "user_id"
}

{
  type: "note_created_sync",
  noteData: { /* complete note object */ },
  timestamp: 1234567890,
  fromUserId: "user_id" | "server"
}

{
  type: "note_deleted_sync",
  noteId: "uuid",
  timestamp: 1234567890,
  fromUserId: "user_id" | "server"
}

// Folder sync messages
{
  type: "folder_created_sync",
  folderData: { /* complete folder object */ },
  timestamp: 1234567890,
  fromUserId: "user_id" | "server"
}

{
  type: "folder_updated_sync",
  folderId: "uuid",
  changes: { name: "Updated Name" },
  updatedFolder: { /* complete folder object */ },
  timestamp: 1234567890,
  fromUserId: "user_id" | "server"
}

{
  type: "folder_deleted_sync",
  folderId: "uuid",
  timestamp: 1234567890,
  fromUserId: "user_id" | "server"
}

// Operation confirmations
{
  type: "note_update_success",
  noteId: "uuid",
  updatedNote: { /* complete note object */ },
  timestamp: 1234567890
}

{
  type: "note_joined",
  noteId: "uuid",
  message: "Successfully joined note for real-time sync"
}

{
  type: "note_left",
  noteId: "uuid"
}

// Heartbeat response
{
  type: "pong",
  timestamp: 1234567890
}

// Errors
{
  type: "error",
  message: "Error description"
}
```

## Security Features

### Authentication

All WebSocket operations require valid Clerk JWT authentication:

1. **Connection Flow:**
   - Client connects to WebSocket endpoint
   - Server sends `connection_established` message
   - Client must send `auth` message with JWT token within 30 seconds
   - Server validates token with Clerk and responds with `auth_success` or `auth_failed`

2. **JWT Validation:**
   - Uses `@clerk/backend` for secure token verification
   - Extracts user ID from token for authorization
   - Validates token signature and expiration

### Optional HMAC Message Authentication

For enhanced security, the server supports HMAC-SHA256 message signing:

1. **Session Secret Generation:**
   ```typescript
   // Generated after successful authentication
   const sessionSecret = createHash('sha256')
     .update(`${jwtToken}:${userId}:${flooredTimestamp}`)
     .digest('hex');
   ```

2. **Message Signing (Client-side):**
   ```typescript
   const messageData = JSON.stringify({ payload, timestamp, nonce });
   const signature = hmacSHA256(sessionSecret, messageData).toBase64();

   // Send signed message
   {
     payload: originalMessage,
     signature: signature,
     timestamp: Date.now(),
     nonce: randomBase64String
   }
   ```

3. **Message Verification (Server-side):**
   - Regenerates session secret using message timestamp
   - Verifies HMAC signature matches
   - Checks nonce for replay attack prevention
   - Validates message age (5-minute window)

### Rate Limiting & DoS Protection

1. **Connection Limits:**
   - Maximum 20 connections per user (configurable)
   - Automatic cleanup of stale connections

2. **Message Rate Limiting:**
   - 300 messages per minute per connection (configurable)
   - 1MB maximum message size
   - Sliding window rate limiting

3. **Nonce Replay Protection:**
   - Tracks used nonces with timestamps
   - Automatic cleanup of expired nonces (5-minute windows)
   - Memory usage limits with emergency cleanup

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `WS_RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` | No |
| `WS_RATE_LIMIT_MAX_MESSAGES` | Max messages per window | `300` | No |
| `WS_MAX_CONNECTIONS_PER_USER` | Max connections per user | `20` | No |
| `WS_AUTH_TIMEOUT_MS` | Authentication timeout | `30000` | No |
| `CLERK_SECRET_KEY` | Clerk secret for JWT verification | - | Yes |

### Production Configuration

```env
# WebSocket Security Settings
WS_RATE_LIMIT_MAX_MESSAGES=300
WS_MAX_CONNECTIONS_PER_USER=20
WS_AUTH_TIMEOUT_MS=30000

# Authentication
CLERK_SECRET_KEY=sk_live_your_production_key

# CORS for WebSocket upgrade requests
CORS_ORIGINS=https://app.yourdomain.com,https://yourdomain.com
```

## Database Integration

### Authorization Checks

All note/folder operations include ownership validation:

```typescript
// Example from note update handler
const existingNote = await db.query.notes.findFirst({
  where: and(eq(notes.id, noteId), eq(notes.userId, userId))
});

if (!existingNote) {
  // Access denied - user doesn't own this note
  return sendError("Note not found or access denied");
}
```

### Allowed Field Updates

Note updates are restricted to safe fields only:

```typescript
const allowedFields = [
  'title', 'content', 'encryptedTitle', 'encryptedContent',
  'starred', 'archived', 'deleted', 'hidden', 'folderId'
];
```

Fields like `id`, `userId`, `createdAt` are protected from modification.

## Error Handling

### Client Errors

- **Authentication timeout**: Connection closed after 30 seconds without auth
- **Rate limit exceeded**: Temporary message rejection with retry advice
- **Invalid message format**: Error response with format requirements
- **Authorization failed**: Access denied for unauthorized operations

### Server Errors

- **Database errors**: Logged server-side, generic error to client
- **JWT validation errors**: Specific error types for debugging
- **Message processing errors**: Detailed logging with correlation IDs

## Performance Considerations

### Memory Management

1. **Connection Tracking:**
   - WeakMap references for automatic garbage collection
   - Periodic cleanup of stale connections
   - Memory usage monitoring and limits

2. **Nonce Storage:**
   - Time-based cleanup every 5 minutes
   - Emergency cleanup at 10,000 nonces
   - LRU eviction for memory efficiency

3. **Message Queuing:**
   - No persistent message queuing (stateless design)
   - Clients responsible for handling missed messages
   - Connection status indicators for client awareness

### Scalability

Current implementation uses in-memory storage suitable for single-instance deployments. For multi-instance scaling:

- **Recommended**: Redis for shared rate limiting and nonce storage
- **Alternative**: Database-backed connection management
- **Load Balancing**: Sticky sessions or Redis pub/sub for message broadcasting

## Development

### Starting the WebSocket Server

The WebSocket server starts automatically with the main API server:

```bash
# Development
npm run dev

# Production
npm run start
```

WebSocket endpoint available at: `ws://localhost:3000` (or configured port)

### Debugging

Enable detailed logging in development:

```bash
# Set debug environment
DEBUG=websocket:* npm run dev

# Or enable in code
console.log('WebSocket debug info:', {
  connectionCount: connectionManager.getConnectionStats(),
  messageType: message.type,
  userId: ws.userId
});
```

### Testing with Multiple Clients

1. Open multiple browser tabs to your frontend
2. Authenticate each session
3. Join the same note in different tabs
4. Make changes in one tab to see real-time sync in others

## API Integration

### Server-Triggered Notifications

The WebSocket manager provides methods for server-initiated sync:

```typescript
// From REST API endpoints, trigger WebSocket sync
const wsManager = WebSocketManager.getInstance();

// Notify user's devices of note changes
wsManager?.notifyNoteUpdate(userId, noteId, changes, updatedNote);
wsManager?.notifyNoteCreated(userId, noteData);
wsManager?.notifyNoteDeleted(userId, noteId);

// Notify folder changes
wsManager?.notifyFolderCreated(userId, folderData);
wsManager?.notifyFolderUpdated(userId, folderId, changes, updatedFolder);
wsManager?.notifyFolderDeleted(userId, folderId);
```

### Connection Statistics

Monitor WebSocket health via REST endpoint:

```http
GET /websocket/status

Response:
{
  "status": "healthy",
  "connections": {
    "total": 15,
    "authenticated": 12,
    "perUser": [
      {"userId": "user_123", "deviceCount": 3}
    ]
  },
  "uptime": "2h 30m"
}
```

## Security Best Practices

### Production Deployment

1. **Use HTTPS/WSS**: Always use secure WebSocket connections in production
2. **JWT Secret Rotation**: Regularly rotate Clerk secret keys
3. **Rate Limiting**: Configure appropriate limits based on usage patterns
4. **Connection Monitoring**: Track connection patterns for abuse detection
5. **Error Logging**: Log security events without exposing sensitive data

### Client Implementation

1. **Token Management**: Handle JWT token refresh gracefully
2. **Reconnection Logic**: Implement exponential backoff for reconnections
3. **Message Validation**: Validate all incoming messages on client-side
4. **Error Handling**: Graceful degradation when WebSocket unavailable

### Monitoring

1. **Connection Metrics**: Track connection counts and patterns
2. **Message Metrics**: Monitor message rates and types
3. **Error Rates**: Alert on authentication failures or rate limiting
4. **Performance**: Monitor message latency and processing time

## Troubleshooting

### Common Issues

**WebSocket connections fail:**
- Verify CORS configuration allows WebSocket upgrades
- Check that Clerk secret key is correctly configured
- Ensure no proxy/firewall blocking WebSocket connections

**Authentication errors:**
- Validate JWT tokens are not expired
- Check Clerk configuration matches frontend
- Verify token is passed correctly in auth message

**Missing sync messages:**
- Ensure clients properly join notes with `join_note` message
- Check that database updates are triggering WebSocket broadcasts
- Verify no errors in message handlers preventing broadcast

**Memory usage issues:**
- Monitor nonce storage cleanup frequency
- Check for connection leaks in connection manager
- Review rate limiting settings for efficiency

### Debug Logging

Key logging points for troubleshooting:

```typescript
// Connection events
console.log(`WebSocket connection established for user ${userId}`);

// Authentication events
console.log(`JWT authentication successful for user ${userId}`);

// Message processing
console.log(`Processing ${message.type} message from user ${userId}`);

// Broadcasting
console.log(`Broadcasted to ${sentCount} devices for user ${userId}`);
```

## Contributing

When modifying the WebSocket implementation:

1. **Update type definitions** in `src/websocket/types.ts`
2. **Maintain backward compatibility** with existing message formats
3. **Add security validation** for new message types
4. **Update this documentation** with any protocol changes
5. **Test with multiple clients** to verify real-time sync works
6. **Consider rate limiting impact** of new message types

## License

This WebSocket implementation is part of the Typelets API and follows the same MIT license.