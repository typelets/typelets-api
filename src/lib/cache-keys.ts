// Cache key generators for consistent naming
export const CacheKeys = {
  // User-related
  userMetadata: (userId: string) => `user:${userId}:metadata`,
  userUsage: (userId: string) => `user:${userId}:usage`,

  // Folder-related
  foldersList: (userId: string) => `folders:${userId}`,
  folderTree: (userId: string) => `folders:${userId}:tree`,
  folderNoteCount: (folderId: string) => `folder:${folderId}:noteCount`,

  // Note-related
  notesList: (userId: string, page: number) => `notes:${userId}:page:${page}`,
  notesStarred: (userId: string) => `notes:${userId}:starred`,
  notesArchived: (userId: string) => `notes:${userId}:archived`,
  notesDeleted: (userId: string) => `notes:${userId}:deleted`,
  notesDeletedCount: (userId: string) => `notes:${userId}:deletedCount`,
  notesCounts: (userId: string) => `notes:${userId}:counts`,

  // Attachment-related
  noteAttachments: (noteId: string) => `attachments:note:${noteId}`,

  // Public notes (no auth required, cached by slug)
  publicNote: (slug: string) => `public:note:${slug}`,
} as const;

// Cache TTL values (in seconds)
export const CacheTTL = {
  userMetadata: 300, // 5 minutes
  userUsage: 300, // 5 minutes
  foldersList: 600, // 10 minutes
  folderTree: 900, // 15 minutes
  folderNoteCount: 600, // 10 minutes
  notesList: 120, // 2 minutes
  notesStarred: 300, // 5 minutes
  notesArchived: 300, // 5 minutes
  notesDeleted: 300, // 5 minutes
  notesCounts: 120, // 2 minutes
  noteAttachments: 1800, // 30 minutes
  publicNote: 86400, // 24 hours (same as Cloudflare CDN)
} as const;
