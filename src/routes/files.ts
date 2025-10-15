import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { db, notes, fileAttachments } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { uploadFileSchema } from "../lib/validation";
import { checkStorageLimits } from "../middleware/usage";

const filesRouter = new Hono();

const maxFileSize = process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : 50;
const maxNoteSize = process.env.MAX_NOTE_SIZE_MB ? parseInt(process.env.MAX_NOTE_SIZE_MB) : 1024;

filesRouter.post("/notes/:noteId/files", zValidator("json", uploadFileSchema), async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("noteId");
  const data = c.req.valid("json");

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
});

filesRouter.get("/files/:fileId", async (c) => {
  const userId = c.get("userId");
  const fileId = c.req.param("fileId");

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

filesRouter.delete("/files/:fileId", async (c) => {
  const userId = c.get("userId");
  const fileId = c.req.param("fileId");

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

filesRouter.get("/notes/:noteId/files", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("noteId");

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

export default filesRouter;
