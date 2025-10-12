import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { db, notes } from "../db";
import {
  createNoteSchema,
  updateNoteSchema,
  notesQuerySchema,
} from "../lib/validation";
import { eq, and, desc, or, ilike, count, SQL } from "drizzle-orm";
import { checkNoteLimits } from "../middleware/usage";

const notesRouter = new Hono();

notesRouter.get("/", zValidator("query", notesQuerySchema), async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");

  const conditions: SQL[] = [eq(notes.userId, userId)];

  if (query.folderId !== undefined) {
    conditions.push(eq(notes.folderId, query.folderId));
  }

  if (query.starred !== undefined) {
    conditions.push(eq(notes.starred, query.starred));
  }

  if (query.archived !== undefined) {
    conditions.push(eq(notes.archived, query.archived));
  }

  if (query.deleted !== undefined) {
    conditions.push(eq(notes.deleted, query.deleted));
  }

  if (query.hidden !== undefined) {
    conditions.push(eq(notes.hidden, query.hidden));
  }

  if (query.search) {
    const escapedSearch = query.search
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');

    conditions.push(
      or(
        ilike(notes.title, `%${escapedSearch}%`),
        ilike(notes.content, `%${escapedSearch}%`),
      )!,
    );
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  const [{ total }] = await db
    .select({ total: count() })
    .from(notes)
    .where(whereClause);

  const offset = (query.page - 1) * query.limit;
  const userNotes = await db.query.notes.findMany({
    where: whereClause,
    orderBy: [desc(notes.updatedAt)],
    limit: query.limit,
    offset,
    with: {
      folder: true,
      attachments: true,
    },
  });

  // Add attachmentCount to each note and remove full attachments array
  const notesWithAttachmentCount = userNotes.map(note => ({
    ...note,
    attachmentCount: note.attachments.length,
    attachments: undefined,
  }));

  return c.json({
    notes: notesWithAttachmentCount,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  });
});

notesRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");

  const note = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
    with: {
      folder: true,
    },
  });

  if (!note) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  return c.json(note);
});

notesRouter.post("/", checkNoteLimits, zValidator("json", createNoteSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [newNote] = await db
    .insert(notes)
    .values({
      ...data,
      userId,
    })
    .returning();

  return c.json(newNote, 201);
});

notesRouter.put("/:id", zValidator("json", updateNoteSchema), async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");
  const data = c.req.valid("json");

  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const [updatedNote] = await db
    .update(notes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();

  return c.json(updatedNote);
});

notesRouter.delete("/empty-trash", async (c) => {
  try {
    const userId = c.get("userId");

    const [{ total }] = await db
      .select({ total: count() })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.deleted, true)));

    await db
      .delete(notes)
      .where(and(eq(notes.userId, userId), eq(notes.deleted, true)));

    return c.json({
      success: true,
      deletedCount: total,
      message: `${total} notes permanently deleted from trash`,
    });
  } catch {
    throw new HTTPException(500, {
      message: "Failed to empty trash. Please try again.",
    });
  }
});

notesRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");

  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const [deletedNote] = await db
    .update(notes)
    .set({
      deleted: true,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();

  return c.json(deletedNote);
});

notesRouter.post("/:id/star", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");

  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const [updatedNote] = await db
    .update(notes)
    .set({
      starred: !existingNote.starred,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();

  return c.json(updatedNote);
});

notesRouter.post("/:id/restore", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");

  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const [restoredNote] = await db
    .update(notes)
    .set({
      deleted: false,
      archived: false,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();

  return c.json(restoredNote);
});

notesRouter.post("/:id/hide", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");

  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  if (existingNote.hidden) {
    throw new HTTPException(400, { message: "Note is already hidden" });
  }

  const [hiddenNote] = await db
    .update(notes)
    .set({
      hidden: true,
      hiddenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();

  return c.json(hiddenNote);
});

notesRouter.post("/:id/unhide", async (c) => {
  const userId = c.get("userId");
  const noteId = c.req.param("id");

  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  if (!existingNote.hidden) {
    throw new HTTPException(400, { message: "Note is not hidden" });
  }

  const [unhiddenNote] = await db
    .update(notes)
    .set({
      hidden: false,
      hiddenAt: null,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();

  return c.json(unhiddenNote);
});

export default notesRouter;
