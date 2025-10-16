import { z } from "@hono/zod-openapi";

// User schemas
export const userSchema = z
  .object({
    id: z
      .string()
      .openapi({ example: "user_2rbRo9aVQTbhEOmwtORqRLtRPXZ", description: "Clerk user ID" }),
    email: z.string().email().openapi({ example: "user@example.com", description: "User email" }),
    firstName: z.string().nullable().openapi({ example: "Rui", description: "User first name" }),
    lastName: z.string().nullable().openapi({ example: "Costa", description: "User last name" }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-07-24T19:41:24.451Z", description: "Account creation date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-07-24T19:41:24.451Z", description: "Last update date" }),
  })
  .openapi("User");

export const storageUsageSchema = z
  .object({
    totalBytes: z.number().openapi({ example: 1590314, description: "Total bytes used" }),
    totalMB: z.number().openapi({ example: 1.52, description: "Total megabytes used" }),
    totalGB: z.number().openapi({ example: 0, description: "Total gigabytes used" }),
    limitGB: z.number().openapi({ example: 1, description: "Storage limit in GB" }),
    usagePercent: z.number().openapi({ example: 0, description: "Percentage used" }),
    isOverLimit: z.boolean().openapi({ example: false, description: "Is over limit" }),
  })
  .openapi("StorageUsage");

export const noteUsageSchema = z
  .object({
    count: z.number().openapi({ example: 54, description: "Current note count" }),
    limit: z.number().openapi({ example: 1000, description: "Maximum notes allowed" }),
    usagePercent: z.number().openapi({ example: 5.4, description: "Percentage of limit used" }),
    isOverLimit: z.boolean().openapi({ example: false, description: "Is over limit" }),
  })
  .openapi("NoteUsage");

export const usageSchema = z
  .object({
    storage: storageUsageSchema,
    notes: noteUsageSchema,
  })
  .openapi("Usage");

export const userWithUsageSchema = userSchema
  .extend({
    usage: usageSchema,
  })
  .openapi("UserWithUsage");

export const meQuerySchema = z.object({
  include_usage: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "include_usage", in: "query" },
      example: "true",
      description: "Include usage statistics",
    }),
});

export const deleteUserResponseSchema = z
  .object({
    message: z
      .string()
      .openapi({ example: "User account deleted successfully", description: "Success message" }),
  })
  .openapi("DeleteUserResponse");

// Folder schemas (for nested objects in notes)
export const folderSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: "123e4567-e89b-12d3-a456-426614174000", description: "Folder ID" }),
    userId: z.string().openapi({ example: "user_2abc123", description: "User ID" }),
    name: z.string().openapi({ example: "Work", description: "Folder name" }),
    color: z.string().nullable().openapi({ example: "#6b7280", description: "Folder color" }),
    parentId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: null, description: "Parent folder ID" }),
    sortOrder: z.number().openapi({ example: 0, description: "Sort order" }),
    isDefault: z.boolean().nullable().openapi({ example: false, description: "Is default folder" }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z", description: "Created date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z", description: "Updated date" }),
  })
  .openapi("Folder");

// Note schemas
const countsObjectSchema = z.object({
  all: z.number().openapi({ example: 10, description: "Active notes count" }),
  starred: z.number().openapi({ example: 2, description: "Starred notes count" }),
  archived: z.number().openapi({ example: 1, description: "Archived notes count" }),
  trash: z.number().openapi({ example: 0, description: "Deleted notes count" }),
});

export const noteCountsSchema = z
  .object({
    all: z.number().openapi({ example: 42, description: "Total active notes count" }),
    starred: z.number().openapi({ example: 5, description: "Total starred notes count" }),
    archived: z.number().openapi({ example: 12, description: "Total archived notes count" }),
    trash: z.number().openapi({ example: 3, description: "Total deleted notes count" }),
    folders: z.record(z.string(), countsObjectSchema).openapi({
      example: {
        "123e4567-e89b-12d3-a456-426614174000": { all: 10, starred: 2, archived: 1, trash: 0 },
        "223e4567-e89b-12d3-a456-426614174001": { all: 5, starred: 1, archived: 0, trash: 0 },
      },
      description:
        "Counts for each root-level folder (folder IDs as keys, includes descendant notes)",
    }),
  })
  .openapi("NoteCounts");

export const folderCountsSchema = z.record(z.string(), countsObjectSchema).openapi("FolderCounts");

export const countsQueryParamsSchema = z.object({
  folder_id: z
    .string()
    .uuid()
    .optional()
    .openapi({
      param: { name: "folder_id", in: "query" },
      example: "123e4567-e89b-12d3-a456-426614174000",
      description:
        "Optional. Get counts for each direct child folder of this folder ID (includes descendant notes). If omitted, returns total counts plus root-level folder counts",
    }),
});

export const noteSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: "123e4567-e89b-12d3-a456-426614174001", description: "Note ID" }),
    userId: z.string().openapi({ example: "user_2abc123", description: "User ID" }),
    folderId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: "123e4567-e89b-12d3-a456-426614174000", description: "Folder ID" }),
    title: z.string().openapi({ example: "[ENCRYPTED]", description: "Encrypted note title" }),
    content: z.string().openapi({ example: "[ENCRYPTED]", description: "Encrypted note content" }),
    encryptedTitle: z
      .string()
      .nullable()
      .openapi({ example: "base64_encrypted_data", description: "Encrypted title data" }),
    encryptedContent: z
      .string()
      .nullable()
      .openapi({ example: "base64_encrypted_data", description: "Encrypted content data" }),
    iv: z.string().nullable().openapi({
      example: "initialization_vector",
      description: "Initialization vector for AES-GCM",
    }),
    salt: z
      .string()
      .nullable()
      .openapi({ example: "salt_value", description: "Salt for key derivation" }),
    starred: z.boolean().nullable().openapi({ example: false, description: "Is starred" }),
    archived: z.boolean().nullable().openapi({ example: false, description: "Is archived" }),
    deleted: z
      .boolean()
      .nullable()
      .openapi({ example: false, description: "Is deleted (in trash)" }),
    hidden: z.boolean().nullable().openapi({ example: false, description: "Is hidden" }),
    hiddenAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: null, description: "When note was hidden" }),
    tags: z.array(z.string()).openapi({ example: ["work", "urgent"], description: "Note tags" }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z", description: "Created date" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z", description: "Updated date" }),
    folder: folderSchema.nullable().optional().openapi({ description: "Associated folder" }),
  })
  .openapi("Note");

export const noteWithAttachmentCountSchema = noteSchema
  .extend({
    attachmentCount: z.number().openapi({ example: 2, description: "Number of file attachments" }),
  })
  .openapi("NoteWithAttachmentCount");

export const createNoteRequestSchema = z
  .object({
    title: z
      .string()
      .optional()
      .openapi({ example: "[ENCRYPTED]", description: "Must be '[ENCRYPTED]'" }),
    content: z
      .string()
      .optional()
      .openapi({ example: "[ENCRYPTED]", description: "Must be '[ENCRYPTED]'" }),
    folderId: z.string().uuid().nullable().optional().openapi({
      example: null,
      description: "Folder ID (use null or empty string for root level, or a valid folder UUID)",
    }),
    starred: z.boolean().optional().openapi({ example: false, description: "Is starred" }),
    tags: z
      .array(z.string().max(50))
      .max(20)
      .optional()
      .openapi({ example: ["work"], description: "Up to 20 tags, max 50 chars each" }),
    encryptedTitle: z
      .string()
      .optional()
      .openapi({ example: "base64_encrypted_data", description: "Encrypted title" }),
    encryptedContent: z
      .string()
      .optional()
      .openapi({ example: "base64_encrypted_data", description: "Encrypted content" }),
    iv: z
      .string()
      .optional()
      .openapi({ example: "initialization_vector", description: "Initialization vector" }),
    salt: z.string().optional().openapi({ example: "salt_value", description: "Salt value" }),
  })
  .openapi("CreateNoteRequest");

export const updateNoteRequestSchema = z
  .object({
    title: z
      .string()
      .optional()
      .openapi({ example: "[ENCRYPTED]", description: "Must be '[ENCRYPTED]'" }),
    content: z
      .string()
      .optional()
      .openapi({ example: "[ENCRYPTED]", description: "Must be '[ENCRYPTED]'" }),
    folderId: z.string().uuid().nullable().optional().openapi({
      example: null,
      description: "Folder ID (use null or empty string for root level, or a valid folder UUID)",
    }),
    starred: z.boolean().optional().openapi({ example: false, description: "Is starred" }),
    archived: z.boolean().optional().openapi({ example: false, description: "Is archived" }),
    deleted: z.boolean().optional().openapi({ example: false, description: "Is deleted" }),
    hidden: z.boolean().optional().openapi({ example: false, description: "Is hidden" }),
    tags: z
      .array(z.string().max(50))
      .max(20)
      .optional()
      .openapi({ example: ["work"], description: "Up to 20 tags" }),
    encryptedTitle: z
      .string()
      .optional()
      .openapi({ example: "base64_encrypted_data", description: "Encrypted title" }),
    encryptedContent: z
      .string()
      .optional()
      .openapi({ example: "base64_encrypted_data", description: "Encrypted content" }),
    iv: z
      .string()
      .optional()
      .openapi({ example: "initialization_vector", description: "Initialization vector" }),
    salt: z.string().optional().openapi({ example: "salt_value", description: "Salt value" }),
  })
  .openapi("UpdateNoteRequest");

export const notesQueryParamsSchema = z
  .object({
    folderId: z
      .string()
      .uuid()
      .optional()
      .openapi({
        param: { name: "folderId", in: "query" },
        example: "123e4567-e89b-12d3-a456-426614174000",
        description: "Filter by folder ID",
      }),
    starred: z
      .enum(["true", "false"])
      .optional()
      .openapi({
        param: { name: "starred", in: "query" },
        example: "true",
        description: "Filter by starred status",
      }),
    archived: z
      .enum(["true", "false"])
      .optional()
      .openapi({
        param: { name: "archived", in: "query" },
        example: "false",
        description: "Filter by archived status",
      }),
    deleted: z
      .enum(["true", "false"])
      .optional()
      .openapi({
        param: { name: "deleted", in: "query" },
        example: "false",
        description: "Filter by deleted status",
      }),
    hidden: z
      .enum(["true", "false"])
      .optional()
      .openapi({
        param: { name: "hidden", in: "query" },
        example: "false",
        description: "Filter by hidden status",
      }),
    search: z
      .string()
      .max(100)
      .optional()
      .openapi({
        param: { name: "search", in: "query" },
        example: "meeting notes",
        description: "Search in title and content (max 100 chars, alphanumeric only)",
      }),
    page: z.coerce
      .number()
      .min(1)
      .optional()
      .openapi({
        param: { name: "page", in: "query" },
        example: "1",
        description: "Page number (default: 1)",
      }),
    limit: z.coerce
      .number()
      .min(1)
      .max(50)
      .optional()
      .openapi({
        param: { name: "limit", in: "query" },
        example: "20",
        description: "Items per page (1-50, default: 20)",
      }),
  })
  .openapi("NotesQueryParams");

export const paginationSchema = z
  .object({
    page: z.number().openapi({ example: 1, description: "Current page" }),
    limit: z.number().openapi({ example: 20, description: "Items per page" }),
    total: z.number().openapi({ example: 100, description: "Total items" }),
    pages: z.number().openapi({ example: 5, description: "Total pages" }),
  })
  .openapi("Pagination");

export const notesListResponseSchema = z
  .object({
    notes: z
      .array(noteWithAttachmentCountSchema)
      .openapi({ description: "Array of notes with attachment counts" }),
    pagination: paginationSchema,
  })
  .openapi("NotesListResponse");

export const emptyTrashResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true, description: "Operation success" }),
    deletedCount: z
      .number()
      .openapi({ example: 5, description: "Number of notes permanently deleted" }),
    message: z.string().openapi({
      example: "5 notes permanently deleted from trash",
      description: "Success message",
    }),
  })
  .openapi("EmptyTrashResponse");

export const noteIdParamSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { name: "id", in: "path" },
      example: "123e4567-e89b-12d3-a456-426614174001",
      description: "Note ID",
    }),
});

// File attachment schemas
export const fileAttachmentSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: "123e4567-e89b-12d3-a456-426614174002", description: "File ID" }),
    noteId: z
      .string()
      .uuid()
      .openapi({ example: "123e4567-e89b-12d3-a456-426614174001", description: "Note ID" }),
    filename: z.string().openapi({
      example: "550e8400-e29b-41d4-a716-446655440000_1234567890",
      description: "Unique filename",
    }),
    originalName: z.string().openapi({ example: "document.pdf", description: "Original filename" }),
    mimeType: z.string().openapi({ example: "application/pdf", description: "File MIME type" }),
    size: z.number().openapi({ example: 1024000, description: "File size in bytes" }),
    uploadedAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z", description: "Upload date" }),
  })
  .openapi("FileAttachment");

export const fileWithEncryptedDataSchema = z
  .object({
    encryptedData: z
      .string()
      .openapi({ example: "base64_encrypted_file_data", description: "Encrypted file data" }),
    iv: z.string().openapi({
      example: "initialization_vector",
      description: "Initialization vector for AES-GCM",
    }),
    salt: z.string().openapi({ example: "salt_value", description: "Salt for key derivation" }),
    mimeType: z.string().openapi({ example: "application/pdf", description: "File MIME type" }),
    originalName: z.string().openapi({ example: "document.pdf", description: "Original filename" }),
    noteSalt: z
      .string()
      .nullable()
      .openapi({ example: "note_salt_value", description: "Note's salt (for decryption)" }),
  })
  .openapi("FileWithEncryptedData");

export const uploadFileRequestSchema = z
  .object({
    originalName: z
      .string()
      .min(1)
      .max(255)
      .openapi({ example: "document.pdf", description: "Original filename (1-255 chars)" }),
    mimeType: z
      .string()
      .min(1)
      .max(100)
      .openapi({ example: "application/pdf", description: "File MIME type (max 100 chars)" }),
    size: z
      .number()
      .int()
      .positive()
      .openapi({ example: 1024000, description: "File size in bytes (must be positive)" }),
    encryptedData: z.string().min(1).openapi({
      example: "base64_encrypted_file_data",
      description: "Encrypted file data (base64)",
    }),
    iv: z
      .string()
      .min(1)
      .openapi({ example: "initialization_vector", description: "Initialization vector" }),
    salt: z
      .string()
      .min(1)
      .openapi({ example: "salt_value", description: "Salt for key derivation" }),
  })
  .openapi("UploadFileRequest");

export const fileIdParamSchema = z.object({
  fileId: z
    .string()
    .uuid()
    .openapi({
      param: { name: "fileId", in: "path" },
      example: "123e4567-e89b-12d3-a456-426614174002",
      description: "File ID",
    }),
});

export const noteIdForFilesParamSchema = z.object({
  noteId: z
    .string()
    .uuid()
    .openapi({
      param: { name: "noteId", in: "path" },
      example: "123e4567-e89b-12d3-a456-426614174001",
      description: "Note ID",
    }),
});

// Code execution schemas
export const executeCodeRequestSchema = z
  .object({
    language_id: z.number().int().min(1).max(200).openapi({
      example: 71,
      description: "Language ID (e.g., 71 for Python 3, 63 for JavaScript)",
    }),
    source_code: z.string().min(1).max(50000).openapi({
      example: 'print("Hello, World!")',
      description: "Source code to execute (max 50,000 chars)",
    }),
    stdin: z.string().max(10000).optional().openapi({
      example: "",
      description: "Standard input for the program (max 10,000 chars)",
    }),
    cpu_time_limit: z
      .number()
      .min(1)
      .max(30)
      .optional()
      .openapi({ example: 5, description: "CPU time limit in seconds (1-30, default: 5)" }),
    memory_limit: z.number().min(16384).max(512000).optional().openapi({
      example: 128000,
      description: "Memory limit in KB (16384-512000, default: 128000)",
    }),
    wall_time_limit: z
      .number()
      .min(1)
      .max(60)
      .optional()
      .openapi({ example: 10, description: "Wall time limit in seconds (1-60, default: 10)" }),
  })
  .openapi("ExecuteCodeRequest");

export const codeSubmissionResponseSchema = z
  .object({
    token: z.string().openapi({
      example: "d85cd024-1548-4165-96c7-7bc88673f194",
      description: "Submission token",
    }),
  })
  .openapi("CodeSubmissionResponse");

export const codeExecutionStatusSchema = z
  .object({
    stdout: z
      .string()
      .nullable()
      .openapi({ example: "Hello, World!\n", description: "Standard output" }),
    stderr: z.string().nullable().openapi({ example: null, description: "Standard error" }),
    compile_output: z
      .string()
      .nullable()
      .openapi({ example: null, description: "Compilation output" }),
    message: z.string().nullable().openapi({ example: null, description: "Execution message" }),
    status: z
      .object({
        id: z.number().openapi({ example: 3, description: "Status ID" }),
        description: z.string().openapi({ example: "Accepted", description: "Status description" }),
      })
      .openapi({ description: "Execution status" }),
    time: z
      .string()
      .nullable()
      .openapi({ example: "0.01", description: "Execution time in seconds" }),
    memory: z.number().nullable().openapi({ example: 3456, description: "Memory used in KB" }),
    token: z.string().openapi({
      example: "d85cd024-1548-4165-96c7-7bc88673f194",
      description: "Submission token",
    }),
  })
  .openapi("CodeExecutionStatus");

export const languageSchema = z
  .object({
    id: z.number().openapi({ example: 71, description: "Language ID" }),
    name: z
      .string()
      .openapi({ example: "Python (3.8.1)", description: "Language name and version" }),
  })
  .openapi("Language");

export const codeHealthResponseSchema = z
  .object({
    status: z
      .enum(["healthy", "degraded", "unhealthy"])
      .openapi({ example: "healthy", description: "Service health status" }),
    judge0: z
      .enum(["connected", "partial_connectivity", "disconnected"])
      .openapi({ example: "connected", description: "Judge0 connection status" }),
    timestamp: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-01T00:00:00.000Z", description: "Timestamp" }),
  })
  .openapi("CodeHealthResponse");

export const tokenParamSchema = z.object({
  token: z
    .string()
    .min(1)
    .openapi({
      param: { name: "token", in: "path" },
      example: "d85cd024-1548-4165-96c7-7bc88673f194",
      description: "Submission token",
    }),
});
