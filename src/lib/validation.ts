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
  newIndex: z
    .number()
    .int()
    .min(0)
    .describe("New position index for the folder"),
});

export const createNoteSchema = z.object({
  title: z.string().min(1, "Note title is required").max(200),
  content: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),

  encryptedTitle: z.string().optional(),
  encryptedContent: z.string().optional(),
  iv: z.string().optional(),
  salt: z.string().optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
  deleted: z.boolean().optional(),
  hidden: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),

  encryptedTitle: z.string().optional(),
  encryptedContent: z.string().optional(),
  iv: z.string().optional(),
  salt: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const notesQuerySchema = z
  .object({
    folderId: z.string().uuid().optional(),
    starred: z.coerce.boolean().optional(),
    archived: z.coerce.boolean().optional(),
    deleted: z.coerce.boolean().optional(),
    hidden: z.coerce.boolean().optional(),
    search: z.string().max(100).optional(),
  })
  .merge(paginationSchema);

export const foldersQuerySchema = z
  .object({
    parentId: z.string().uuid().optional(),
  })
  .merge(paginationSchema);

export const uploadFileSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // 10MB max
  encryptedData: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
});
