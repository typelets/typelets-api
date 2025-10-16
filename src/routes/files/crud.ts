import { OpenAPIHono, createRoute, RouteHandler } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { db, notes, fileAttachments } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { uploadFileSchema } from "../../lib/validation";
import { checkStorageLimits } from "../../middleware/usage";
import {
  fileAttachmentSchema,
  fileWithEncryptedDataSchema,
  uploadFileRequestSchema,
  fileIdParamSchema,
  noteIdForFilesParamSchema,
} from "../../lib/openapi-schemas";
import { z } from "@hono/zod-openapi";

const crudRouter = new OpenAPIHono();

const maxFileSize = process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : 50;
const maxNoteSize = process.env.MAX_NOTE_SIZE_MB ? parseInt(process.env.MAX_NOTE_SIZE_MB) : 1024;

// POST /api/notes/:noteId/files - Upload a file attachment to a note
const uploadFileRoute = createRoute({
  method: "post",
  path: "/notes/{noteId}/files",
  summary: "Upload file",
  description: `Upload an encrypted file attachment to a note. Maximum file size: ${maxFileSize}MB. Maximum total attachments per note: ${maxNoteSize}MB`,
  tags: ["Files"],
  request: {
    params: noteIdForFilesParamSchema,
    body: {
      content: {
        "application/json": {
          schema: uploadFileRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "File uploaded successfully",
      content: {
        "application/json": {
          schema: fileAttachmentSchema,
        },
      },
    },
    400: {
      description: "Invalid request body",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    403: {
      description: "Access denied - Note not found or not owned by user",
    },
    413: {
      description: "File too large or total attachment size limit exceeded",
    },
  },
  security: [{ Bearer: [] }],
});

const uploadFileHandler: RouteHandler<typeof uploadFileRoute> = async (c) => {
  const userId = c.get("userId");
  const { noteId } = c.req.valid("param");

  // Validate with the original schema that has the refinements
  const rawData = await c.req.json();
  const data = uploadFileSchema.parse(rawData);

  await checkStorageLimits(data.size)(c, async () => {});

  const note = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!note) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  const maxFileSizeBytes = maxFileSize * 1024 * 1024;
  if (data.size > maxFileSizeBytes) {
    throw new HTTPException(413, {
      message: `File too large. Maximum size is ${maxFileSize}MB`,
    });
  }

  // noinspection SqlNoDataSourceInspection
  const result = await db
    .select({ totalSize: sql<string>`COALESCE(SUM(size), 0)` })
    .from(fileAttachments)
    .where(eq(fileAttachments.noteId, noteId));

  const totalSize = Number(result[0]?.totalSize || 0);
  const newFileSize = Number(data.size);
  const combinedSize = totalSize + newFileSize;
  const maxNoteSizeBytes = maxNoteSize * 1024 * 1024;

  if (combinedSize > maxNoteSizeBytes) {
    throw new HTTPException(413, {
      message: `Total attachment size for this note would exceed ${maxNoteSize}MB limit`,
    });
  }

  const filename = `${randomUUID()}_${Date.now()}`;

  const [newAttachment] = await db
    .insert(fileAttachments)
    .values({
      noteId,
      filename,
      originalName: data.originalName,
      mimeType: data.mimeType,
      size: data.size,
      encryptedData: data.encryptedData,
      iv: data.iv,
      salt: data.salt,
    })
    .returning({
      id: fileAttachments.id,
      noteId: fileAttachments.noteId,
      filename: fileAttachments.filename,
      originalName: fileAttachments.originalName,
      mimeType: fileAttachments.mimeType,
      size: fileAttachments.size,
      uploadedAt: fileAttachments.uploadedAt,
    });

  return c.json(newAttachment, 201);
};

crudRouter.openapi(uploadFileRoute, uploadFileHandler);

// GET /api/notes/:noteId/files - List all file attachments for a note
const listFilesRoute = createRoute({
  method: "get",
  path: "/notes/{noteId}/files",
  summary: "List files",
  description: "Get all file attachments for a specific note",
  tags: ["Files"],
  request: {
    params: noteIdForFilesParamSchema,
  },
  responses: {
    200: {
      description: "Files retrieved successfully",
      content: {
        "application/json": {
          schema: z.array(fileAttachmentSchema),
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    403: {
      description: "Access denied - Note not found or not owned by user",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(listFilesRoute, async (c) => {
  const userId = c.get("userId");
  const { noteId } = c.req.valid("param");

  const note = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!note) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  const attachments = await db
    .select({
      id: fileAttachments.id,
      noteId: fileAttachments.noteId,
      filename: fileAttachments.filename,
      originalName: fileAttachments.originalName,
      mimeType: fileAttachments.mimeType,
      size: fileAttachments.size,
      uploadedAt: fileAttachments.uploadedAt,
    })
    .from(fileAttachments)
    .where(eq(fileAttachments.noteId, noteId))
    .orderBy(fileAttachments.uploadedAt);

  return c.json(attachments);
});

// GET /api/files/:fileId - Get a single file attachment
const getFileRoute = createRoute({
  method: "get",
  path: "/files/{fileId}",
  summary: "Get file",
  description:
    "Retrieve an encrypted file attachment by ID. Returns the encrypted data with decryption metadata",
  tags: ["Files"],
  request: {
    params: fileIdParamSchema,
  },
  responses: {
    200: {
      description: "File retrieved successfully",
      content: {
        "application/json": {
          schema: fileWithEncryptedDataSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "File not found or access denied",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getFileRoute, async (c) => {
  const userId = c.get("userId");
  const { fileId } = c.req.valid("param");

  const file = await db
    .select({
      encryptedData: fileAttachments.encryptedData,
      iv: fileAttachments.iv,
      salt: fileAttachments.salt,
      mimeType: fileAttachments.mimeType,
      originalName: fileAttachments.originalName,
      noteSalt: notes.salt, // Include note's salt in case frontend needs it
    })
    .from(fileAttachments)
    .innerJoin(notes, eq(fileAttachments.noteId, notes.id))
    .where(and(eq(fileAttachments.id, fileId), eq(notes.userId, userId)))
    .limit(1);

  if (!file || file.length === 0) {
    throw new HTTPException(404, { message: "File not found" });
  }

  return c.json(file[0]);
});

// DELETE /api/files/:fileId - Delete a file attachment
const deleteFileRoute = createRoute({
  method: "delete",
  path: "/files/{fileId}",
  summary: "Delete file",
  description: "Permanently delete a file attachment",
  tags: ["Files"],
  request: {
    params: fileIdParamSchema,
  },
  responses: {
    204: {
      description: "File deleted successfully",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "File not found or access denied",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(deleteFileRoute, async (c) => {
  const userId = c.get("userId");
  const { fileId } = c.req.valid("param");

  const file = await db
    .select({ id: fileAttachments.id })
    .from(fileAttachments)
    .innerJoin(notes, eq(fileAttachments.noteId, notes.id))
    .where(and(eq(fileAttachments.id, fileId), eq(notes.userId, userId)))
    .limit(1);

  if (!file || file.length === 0) {
    throw new HTTPException(404, { message: "File not found" });
  }

  await db.delete(fileAttachments).where(eq(fileAttachments.id, fileId));

  return c.body(null, 204);
});

export default crudRouter;
