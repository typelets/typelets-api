import { OpenAPIHono, createRoute, RouteHandler } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { db, notes, publicNotes } from "../../db";
import { createNoteSchema, updateNoteSchema } from "../../lib/validation";
import { eq, and, desc, or, ilike, count, SQL, inArray } from "drizzle-orm";
import { checkNoteLimits } from "../../middleware/usage";
import {
  noteSchema,
  notesListResponseSchema,
  createNoteRequestSchema,
  updateNoteRequestSchema,
  notesQueryParamsSchema,
  noteIdParamSchema,
} from "../../lib/openapi-schemas";
import { invalidateNoteCounts, invalidateNoteCountsForMove } from "../../lib/cache";
import { logger } from "../../lib/logger";

const crudRouter = new OpenAPIHono();

// GET /api/notes - List notes with pagination and filtering
const listNotesRoute = createRoute({
  method: "get",
  path: "",
  summary: "List notes",
  description:
    "Get a paginated list of notes with optional filters for folder, starred, archived, deleted, hidden status, and search",
  tags: ["Notes"],
  request: {
    query: notesQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Notes retrieved successfully",
      content: {
        "application/json": {
          schema: notesListResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

// Handler function for listing notes
const listNotesHandler: RouteHandler<typeof listNotesRoute> = async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");

  const conditions: SQL[] = [eq(notes.userId, userId)];

  if (query.folderId !== undefined) {
    conditions.push(eq(notes.folderId, query.folderId));
  }

  if (query.starred !== undefined) {
    const starred = query.starred === "true";
    conditions.push(eq(notes.starred, starred));
  }

  if (query.archived !== undefined) {
    const archived = query.archived === "true";
    conditions.push(eq(notes.archived, archived));
  }

  if (query.deleted !== undefined) {
    const deleted = query.deleted === "true";
    conditions.push(eq(notes.deleted, deleted));
  }

  if (query.hidden !== undefined) {
    const hidden = query.hidden === "true";
    conditions.push(eq(notes.hidden, hidden));
  }

  if (query.type !== undefined) {
    conditions.push(eq(notes.type, query.type));
  }

  if (query.search) {
    const escapedSearch = query.search
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");

    conditions.push(
      or(ilike(notes.title, `%${escapedSearch}%`), ilike(notes.content, `%${escapedSearch}%`))!
    );
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const countStart = Date.now();
  const [{ total }] = await db.select({ total: count() }).from(notes).where(whereClause);
  logger.databaseQuery("count", "notes", Date.now() - countStart, userId);

  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const selectStart = Date.now();
  const userNotes = await db.query.notes.findMany({
    where: whereClause,
    orderBy: [desc(notes.updatedAt)],
    limit,
    offset,
    with: {
      folder: true,
      attachments: {
        // Load attachment metadata but exclude the massive encryptedData field
        columns: {
          id: true,
          noteId: true,
          filename: true,
          originalName: true,
          mimeType: true,
          size: true,
          encryptedTitle: true,
          iv: true,
          salt: true,
          uploadedAt: true,
          encryptedData: false,
        },
      },
    },
  });
  logger.databaseQuery("select", "notes", Date.now() - selectStart, userId);

  // Fetch publish status for all notes in one query
  const noteIds = userNotes.map((note) => note.id);
  let publishStatusMap = new Map<
    string,
    { slug: string; publishedAt: Date; updatedAt: Date }
  >();

  if (noteIds.length > 0) {
    const publishStart = Date.now();
    const publishedNotes = await db
      .select({
        noteId: publicNotes.noteId,
        slug: publicNotes.slug,
        publishedAt: publicNotes.publishedAt,
        updatedAt: publicNotes.updatedAt,
      })
      .from(publicNotes)
      .where(inArray(publicNotes.noteId, noteIds));
    logger.databaseQuery("select", "public_notes", Date.now() - publishStart, userId);

    publishStatusMap = new Map(
      publishedNotes.map((pn) => [
        pn.noteId,
        { slug: pn.slug, publishedAt: pn.publishedAt, updatedAt: pn.updatedAt },
      ])
    );
  }

  // Add attachment counts and publish status to notes
  const notesWithAttachmentCount = userNotes.map((note) => {
    const publishStatus = publishStatusMap.get(note.id);
    return {
      ...note,
      attachmentCount: note.attachments.length,
      isPublished: !!publishStatus,
      publicSlug: publishStatus?.slug ?? null,
      publishedAt: publishStatus?.publishedAt?.toISOString() ?? null,
      publicUpdatedAt: publishStatus?.updatedAt?.toISOString() ?? null,
    };
  });

  return c.json(
    {
      notes: notesWithAttachmentCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    200
  );
};

crudRouter.openapi(listNotesRoute, listNotesHandler);

// Also register with trailing slash (Swagger UI adds trailing slashes)
const listNotesRouteSlash = createRoute({
  method: "get",
  path: "/",
  summary: "List notes",
  description:
    "Get a paginated list of notes with optional filters for folder, starred, archived, deleted, hidden status, and search",
  tags: ["Notes"],
  request: {
    query: notesQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Notes retrieved successfully",
      content: {
        "application/json": {
          schema: notesListResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(listNotesRouteSlash, listNotesHandler);

// GET /api/notes/:id - Get a single note
const getNoteRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "Get note by ID",
  description: "Retrieve a single note by its ID with associated folder information",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note retrieved successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Note not found",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

  const selectStart = Date.now();
  const note = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
    with: {
      folder: true,
    },
  });
  logger.databaseQuery("select", "notes", Date.now() - selectStart, userId);

  if (!note) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  // Fetch publish status
  const publishStart = Date.now();
  const publishedNote = await db.query.publicNotes.findFirst({
    where: eq(publicNotes.noteId, noteId),
    columns: {
      slug: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  logger.databaseQuery("select", "public_notes", Date.now() - publishStart, userId);

  const noteWithPublishStatus = {
    ...note,
    isPublished: !!publishedNote,
    publicSlug: publishedNote?.slug ?? null,
    publishedAt: publishedNote?.publishedAt?.toISOString() ?? null,
    publicUpdatedAt: publishedNote?.updatedAt?.toISOString() ?? null,
  };

  return c.json(noteWithPublishStatus, 200);
});

// POST /api/notes - Create a new note
const createNoteRoute = createRoute({
  method: "post",
  path: "",
  summary: "Create note",
  description:
    "Create a new encrypted note. Title and content must be '[ENCRYPTED]' with actual encrypted data in encryptedTitle/encryptedContent fields",
  tags: ["Notes"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createNoteRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Note created successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    400: {
      description: "Invalid request body",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    402: {
      description: "Payment required - Note limit exceeded",
    },
  },
  security: [{ Bearer: [] }],
});

// Handler function for creating notes
const createNoteHandler: RouteHandler<typeof createNoteRoute> = async (c) => {
  const userId = c.get("userId");

  // Validate with the original schema that has the refinements
  const data = await c.req.json();
  const validatedData = createNoteSchema.parse(data) as {
    title: string;
    content: string;
    folderId?: string | null;
    starred?: boolean;
    tags?: string[];
    type?: "note" | "diagram" | "code";
    encryptedTitle?: string;
    encryptedContent?: string;
    iv?: string;
    salt?: string;
  };

  const insertStart = Date.now();
  const [newNote] = await db
    .insert(notes)
    .values({
      ...validatedData,
      userId,
    })
    .returning();
  logger.databaseQuery("insert", "notes", Date.now() - insertStart, userId);

  // Invalidate counts cache for the user and all ancestor folders
  await invalidateNoteCounts(userId, validatedData.folderId ?? null);

  return c.json(newNote, 201);
};

// Apply middleware before the route handler
crudRouter.use("/", checkNoteLimits);
crudRouter.use("", checkNoteLimits);

crudRouter.openapi(createNoteRoute, createNoteHandler);

// Also register with trailing slash (Swagger UI adds trailing slashes)
const createNoteRouteSlash = createRoute({
  method: "post",
  path: "/",
  summary: "Create note",
  description:
    "Create a new encrypted note. Title and content must be '[ENCRYPTED]' with actual encrypted data in encryptedTitle/encryptedContent fields",
  tags: ["Notes"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createNoteRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Note created successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    400: {
      description: "Invalid request body",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    402: {
      description: "Payment required - Note limit exceeded",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(createNoteRouteSlash, createNoteHandler);

// PUT /api/notes/:id - Update a note
const updateNoteRoute = createRoute({
  method: "put",
  path: "/{id}",
  summary: "Update note",
  description:
    "Update an existing note's properties. Title and content must be '[ENCRYPTED]' if provided",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateNoteRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Note updated successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    400: {
      description: "Invalid request body",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Note not found",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(updateNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

  // Validate with the original schema that has the refinements
  const data = await c.req.json();
  const validatedData = updateNoteSchema.parse(data);

  const selectStart = Date.now();
  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });
  logger.databaseQuery("select", "notes", Date.now() - selectStart, userId);

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const updateStart = Date.now();
  const [updatedNote] = await db
    .update(notes)
    .set({
      ...validatedData,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();
  logger.databaseQuery("update", "notes", Date.now() - updateStart, userId);

  // Invalidate counts cache - check if note moved between folders
  const oldFolderId = existingNote.folderId;
  const newFolderId = "folderId" in validatedData ? (validatedData.folderId ?? null) : oldFolderId;

  if (oldFolderId !== newFolderId) {
    // Note moved between folders - invalidate both hierarchies
    await invalidateNoteCountsForMove(userId, oldFolderId, newFolderId);
  } else {
    // Note stayed in same folder - just invalidate current hierarchy
    await invalidateNoteCounts(userId, oldFolderId);
  }

  return c.json(updatedNote, 200);
});

// DELETE /api/notes/:id - Soft delete a note (move to trash)
const deleteNoteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "Delete note",
  description:
    "Soft delete a note by marking it as deleted (moves to trash). Can be restored later",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note deleted successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Note not found",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(deleteNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

  const selectStart = Date.now();
  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
  });
  logger.databaseQuery("select", "notes", Date.now() - selectStart, userId);

  if (!existingNote) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const updateStart = Date.now();
  const [deletedNote] = await db
    .update(notes)
    .set({
      deleted: true,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, noteId))
    .returning();
  logger.databaseQuery("update", "notes", Date.now() - updateStart, userId);

  // Invalidate counts cache for the note's folder hierarchy
  await invalidateNoteCounts(userId, existingNote.folderId);

  return c.json(deletedNote, 200);
});

export default crudRouter;
