import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { db, notes } from "../../db";
import { eq, and } from "drizzle-orm";
import { noteSchema, noteIdParamSchema } from "../../lib/openapi-schemas";

const actionsRouter = new OpenAPIHono();

// POST /api/notes/:id/star - Toggle star status
const starNoteRoute = createRoute({
  method: "post",
  path: "/{id}/star",
  summary: "Toggle star",
  description: "Toggle the starred status of a note",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note starred status toggled successfully",
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

actionsRouter.openapi(starNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

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

  return c.json(updatedNote, 200);
});

// POST /api/notes/:id/restore - Restore note from trash
const restoreNoteRoute = createRoute({
  method: "post",
  path: "/{id}/restore",
  summary: "Restore note",
  description: "Restore a deleted note from trash and unarchive it",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note restored successfully",
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

actionsRouter.openapi(restoreNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

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

  return c.json(restoredNote, 200);
});

// POST /api/notes/:id/hide - Hide a note
const hideNoteRoute = createRoute({
  method: "post",
  path: "/{id}/hide",
  summary: "Hide note",
  description: "Hide a note from normal view",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note hidden successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    400: {
      description: "Note is already hidden",
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

actionsRouter.openapi(hideNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

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

  return c.json(hiddenNote, 200);
});

// POST /api/notes/:id/unhide - Unhide a note
const unhideNoteRoute = createRoute({
  method: "post",
  path: "/{id}/unhide",
  summary: "Unhide note",
  description: "Unhide a previously hidden note",
  tags: ["Notes"],
  request: {
    params: noteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note unhidden successfully",
      content: {
        "application/json": {
          schema: noteSchema,
        },
      },
    },
    400: {
      description: "Note is not hidden",
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

actionsRouter.openapi(unhideNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { id: noteId } = c.req.valid("param");

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

  return c.json(unhiddenNote, 200);
});

export default actionsRouter;
