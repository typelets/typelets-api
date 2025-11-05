import { z } from "zod";

export const createUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Invalid color format")
    .optional(),
  parentId: z.string().uuid().optional(),
  isDefault: z.boolean().optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const reorderFolderSchema = z.object({
  newIndex: z.number().int().min(0).describe("New position index for the folder"),
});

export const createNoteSchema = z.object({
  title: z
    .string()
    .refine((value) => value === "[ENCRYPTED]", "Title must be '[ENCRYPTED]'")
    .optional(),
  content: z
    .string()
    .refine((value) => value === "[ENCRYPTED]", "Content must be '[ENCRYPTED]'")
    .optional(),
  folderId: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().uuid().nullable().optional()
  ),
  starred: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  type: z.enum(["note", "diagram", "code"]).default("note").optional(),

  encryptedTitle: z.string().optional(),
  encryptedContent: z.string().optional(),
  iv: z.string().optional(),
  salt: z.string().optional(),
});

export const updateNoteSchema = z.object({
  title: z
    .string()
    .refine((value) => value === "[ENCRYPTED]", "Title must be '[ENCRYPTED]'")
    .optional(),
  content: z
    .string()
    .refine((value) => value === "[ENCRYPTED]", "Content must be '[ENCRYPTED]'")
    .optional(),
  folderId: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().uuid().nullable().optional()
  ),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
  hidden: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  type: z.enum(["note", "diagram", "code"]).optional(),

  encryptedTitle: z.string().optional(),
  encryptedContent: z.string().optional(),
  iv: z.string().optional(),
  salt: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20), // Reduced max limit for security
});

export const notesQuerySchema = z
  .object({
    folderId: z.string().uuid().optional(),
    starred: z.coerce.boolean().optional(),
    archived: z.coerce.boolean().optional(),
    deleted: z.coerce.boolean().optional(),
    hidden: z.coerce.boolean().optional(),
    type: z.enum(["note", "diagram", "code"]).optional(),
    search: z
      .string()
      .max(100)
      .regex(/^[a-zA-Z0-9\s\-_.,!?]+$/, "Search contains invalid characters") // Only allow safe characters
      .optional(),
  })
  .merge(paginationSchema);

export const foldersQuerySchema = z
  .object({
    parentId: z.string().uuid().optional(),
  })
  .merge(paginationSchema);

// Allowed MIME types for security
const allowedMimeTypes = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/avif",
  // Apple formats (iPhone/iPad photos)
  "image/heic",
  "image/heif",
  "image/heic-sequence", // Live Photos
  "image/heif-sequence",
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  // Microsoft Office
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  // Other common formats
  "text/html",
  "application/xml",
  "text/xml",
] as const;

export const uploadFileSchema = z.object({
  originalName: z
    .string()
    .min(1)
    .max(255)
    .refine((name) => {
      // Check for dangerous characters and patterns
      const dangerousChars = /[<>:"/\\|?*]/;
      // Check for control characters (ASCII 0-31)
      const hasControlChars = name.split("").some((char) => {
        const code = char.charCodeAt(0);
        return code >= 0 && code <= 31;
      });
      const dangerousPatterns = /^\./; // Files starting with dot

      return !dangerousChars.test(name) && !hasControlChars && !dangerousPatterns.test(name);
    }, "Invalid filename characters"),
  mimeType: z
    .string()
    .refine(
      (type): type is (typeof allowedMimeTypes)[number] =>
        allowedMimeTypes.includes(type as (typeof allowedMimeTypes)[number]),
      "File type not allowed"
    ),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // 10MB max
  encryptedData: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
});
