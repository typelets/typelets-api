import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { db, publicNotes, notes } from "../../db";
import {
  publicNoteSchema,
  publicNoteViewSchema,
  publishNoteRequestSchema,
  updatePublicNoteRequestSchema,
  publicNoteSlugParamSchema,
  publicNoteNoteIdParamSchema,
  unpublishNoteResponseSchema,
} from "../../lib/openapi-schemas";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logger } from "../../lib/logger";
import DOMPurify from "isomorphic-dompurify";

const crudRouter = new OpenAPIHono();

/**
 * Generate a unique URL-safe slug for public notes
 * Uses nanoid for cryptographically secure random generation
 */
function generateSlug(): string {
  return nanoid(10); // e.g., "V1StGXR8_Z"
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows safe HTML tags for rich text content while removing dangerous elements
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // Allow common formatting tags for rich text editors
    ALLOWED_TAGS: [
      // Text formatting
      "p", "br", "span", "div",
      "strong", "b", "em", "i", "u", "s", "strike",
      "h1", "h2", "h3", "h4", "h5", "h6",
      // Lists
      "ul", "ol", "li",
      // Links and media
      "a", "img",
      // Tables
      "table", "thead", "tbody", "tr", "th", "td",
      // Code
      "pre", "code", "blockquote",
      // Other
      "hr", "sub", "sup", "mark",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "id",
      "target", "rel", "width", "height",
      "colspan", "rowspan",
    ],
    // Only allow safe URL protocols (blocks javascript:, data:, vbscript:, etc.)
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
    // Force all links to open in new tab and prevent reverse tabnabbing
    ADD_ATTR: ["target", "rel"],
    // Ensure links have proper security attributes
    FORBID_TAGS: ["script", "style", "iframe", "form", "input", "textarea", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });
}

/**
 * Sanitize plain text fields (strip all HTML)
 */
function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

// POST /api/public-notes - Publish a note
const publishNoteRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Publish a note",
  description:
    "Creates a public, unencrypted copy of a note. The client must decrypt the note content before sending.",
  tags: ["Public Notes"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: publishNoteRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Note published successfully",
      content: {
        "application/json": {
          schema: publicNoteSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    403: {
      description: "Forbidden - User doesn't own the note",
    },
    404: {
      description: "Not Found - Note doesn't exist",
    },
    409: {
      description: "Conflict - Note is already published",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(publishNoteRoute, async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  // 1. Verify user owns the note
  const selectStart = Date.now();
  const existingNote = await db.query.notes.findFirst({
    where: and(eq(notes.id, body.noteId), eq(notes.userId, userId)),
  });
  logger.databaseQuery("select", "notes", Date.now() - selectStart, userId);

  if (!existingNote) {
    // Check if note exists but belongs to someone else
    const noteExistsStart = Date.now();
    const noteExists = await db.query.notes.findFirst({
      where: eq(notes.id, body.noteId),
      columns: { id: true },
    });
    logger.databaseQuery("select", "notes", Date.now() - noteExistsStart, userId);

    if (noteExists) {
      throw new HTTPException(403, { message: "You don't have permission to publish this note" });
    }
    throw new HTTPException(404, { message: "Note not found" });
  }

  // 2. Check if note is already published
  const checkPublishedStart = Date.now();
  const existingPublicNote = await db.query.publicNotes.findFirst({
    where: eq(publicNotes.noteId, body.noteId),
  });
  logger.databaseQuery("select", "public_notes", Date.now() - checkPublishedStart, userId);

  if (existingPublicNote) {
    throw new HTTPException(409, { message: "Note is already published" });
  }

  // 3. Generate unique slug
  let slug = generateSlug();
  let slugExists = true;
  let attempts = 0;
  const maxAttempts = 5;

  while (slugExists && attempts < maxAttempts) {
    const checkSlugStart = Date.now();
    const existing = await db.query.publicNotes.findFirst({
      where: eq(publicNotes.slug, slug),
      columns: { id: true },
    });
    logger.databaseQuery("select", "public_notes", Date.now() - checkSlugStart, userId);

    if (!existing) {
      slugExists = false;
    } else {
      slug = generateSlug();
      attempts++;
    }
  }

  if (slugExists) {
    throw new HTTPException(500, { message: "Failed to generate unique slug" });
  }

  // 4. Sanitize content to prevent XSS attacks
  const sanitizedTitle = sanitizeText(body.title);
  const sanitizedContent = sanitizeHtml(body.content);
  const sanitizedAuthorName = body.authorName ? sanitizeText(body.authorName) : null;

  // 5. Insert into public_notes table
  const insertStart = Date.now();
  const [newPublicNote] = await db
    .insert(publicNotes)
    .values({
      slug,
      noteId: body.noteId,
      userId,
      title: sanitizedTitle,
      content: sanitizedContent,
      type: body.type || "note",
      authorName: sanitizedAuthorName,
    })
    .returning();
  logger.databaseQuery("insert", "public_notes", Date.now() - insertStart, userId);

  logger.info("[PUBLIC_NOTES] Note published", {
    type: "public_note_event",
    event_type: "note_published",
    "user.id": userId,
    publicNoteId: newPublicNote.id,
    slug: newPublicNote.slug,
    noteId: body.noteId,
  });

  return c.json(newPublicNote, 201);
});

// GET /api/public-notes/:slug - Get public note (NO AUTH REQUIRED)
const getPublicNoteRoute = createRoute({
  method: "get",
  path: "/{slug}",
  summary: "Get public note",
  description: "Fetches a public note for viewing. This is a public endpoint - no authentication required. Sensitive fields (id, noteId, userId) are excluded from the response.",
  tags: ["Public Notes"],
  request: {
    params: publicNoteSlugParamSchema,
  },
  responses: {
    200: {
      description: "Public note retrieved successfully",
      content: {
        "application/json": {
          schema: publicNoteViewSchema,
        },
      },
    },
    404: {
      description: "Not Found - Public note doesn't exist",
    },
  },
  // No security - public endpoint
});

crudRouter.openapi(getPublicNoteRoute, async (c) => {
  const { slug } = c.req.valid("param");

  const selectStart = Date.now();
  const publicNote = await db.query.publicNotes.findFirst({
    where: eq(publicNotes.slug, slug),
    columns: {
      // Only select public-safe fields (exclude id, noteId, userId)
      slug: true,
      title: true,
      content: true,
      type: true,
      authorName: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  logger.databaseQuery("select", "public_notes", Date.now() - selectStart);

  if (!publicNote) {
    throw new HTTPException(404, { message: "Public note not found" });
  }

  return c.json(publicNote, 200);
});

// PUT /api/public-notes/:slug - Update public note
const updatePublicNoteRoute = createRoute({
  method: "put",
  path: "/{slug}",
  summary: "Update public note",
  description: "Updates the content of a published note. Called automatically when user saves.",
  tags: ["Public Notes"],
  request: {
    params: publicNoteSlugParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updatePublicNoteRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Public note updated successfully",
      content: {
        "application/json": {
          schema: publicNoteSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    403: {
      description: "Forbidden - User doesn't own the public note",
    },
    404: {
      description: "Not Found - Public note doesn't exist",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(updatePublicNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { slug } = c.req.valid("param");
  const body = c.req.valid("json");

  // 1. Find public note by slug
  const selectStart = Date.now();
  const existingPublicNote = await db.query.publicNotes.findFirst({
    where: eq(publicNotes.slug, slug),
  });
  logger.databaseQuery("select", "public_notes", Date.now() - selectStart, userId);

  if (!existingPublicNote) {
    throw new HTTPException(404, { message: "Public note not found" });
  }

  // 2. Verify user owns it
  if (existingPublicNote.userId !== userId) {
    throw new HTTPException(403, { message: "You don't have permission to update this public note" });
  }

  // 3. Sanitize and update fields
  const updateData: Partial<typeof publicNotes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) {
    updateData.title = sanitizeText(body.title);
  }
  if (body.content !== undefined) {
    updateData.content = sanitizeHtml(body.content);
  }
  if (body.authorName !== undefined) {
    updateData.authorName = body.authorName ? sanitizeText(body.authorName) : null;
  }

  const updateStart = Date.now();
  const [updatedPublicNote] = await db
    .update(publicNotes)
    .set(updateData)
    .where(eq(publicNotes.id, existingPublicNote.id))
    .returning();
  logger.databaseQuery("update", "public_notes", Date.now() - updateStart, userId);

  return c.json(updatedPublicNote, 200);
});

// DELETE /api/public-notes/:slug - Unpublish note
const unpublishNoteRoute = createRoute({
  method: "delete",
  path: "/{slug}",
  summary: "Unpublish note",
  description: "Removes the public version of a note.",
  tags: ["Public Notes"],
  request: {
    params: publicNoteSlugParamSchema,
  },
  responses: {
    200: {
      description: "Note unpublished successfully",
      content: {
        "application/json": {
          schema: unpublishNoteResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    403: {
      description: "Forbidden - User doesn't own the public note",
    },
    404: {
      description: "Not Found - Public note doesn't exist",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(unpublishNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { slug } = c.req.valid("param");

  // 1. Find public note by slug
  const selectStart = Date.now();
  const existingPublicNote = await db.query.publicNotes.findFirst({
    where: eq(publicNotes.slug, slug),
  });
  logger.databaseQuery("select", "public_notes", Date.now() - selectStart, userId);

  if (!existingPublicNote) {
    throw new HTTPException(404, { message: "Public note not found" });
  }

  // 2. Verify user owns it
  if (existingPublicNote.userId !== userId) {
    throw new HTTPException(403, { message: "You don't have permission to unpublish this note" });
  }

  // 3. Delete from public_notes table
  const deleteStart = Date.now();
  await db.delete(publicNotes).where(eq(publicNotes.id, existingPublicNote.id));
  logger.databaseQuery("delete", "public_notes", Date.now() - deleteStart, userId);

  logger.info("[PUBLIC_NOTES] Note unpublished", {
    type: "public_note_event",
    event_type: "note_unpublished",
    "user.id": userId,
    publicNoteId: existingPublicNote.id,
    slug,
    noteId: existingPublicNote.noteId,
  });

  return c.json({ message: "Note unpublished successfully" }, 200);
});

// GET /api/public-notes/note/:noteId - Check if note is published
const checkPublicNoteRoute = createRoute({
  method: "get",
  path: "/note/{noteId}",
  summary: "Check if note is published",
  description: "Checks if a specific note has been published and returns its public info.",
  tags: ["Public Notes"],
  request: {
    params: publicNoteNoteIdParamSchema,
  },
  responses: {
    200: {
      description: "Note is published",
      content: {
        "application/json": {
          schema: publicNoteSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    403: {
      description: "Forbidden - User doesn't own the note",
    },
    404: {
      description: "Not Found - Note is not published",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(checkPublicNoteRoute, async (c) => {
  const userId = c.get("userId");
  const { noteId } = c.req.valid("param");

  // 1. Find public note by note_id
  const selectStart = Date.now();
  const publicNote = await db.query.publicNotes.findFirst({
    where: eq(publicNotes.noteId, noteId),
  });
  logger.databaseQuery("select", "public_notes", Date.now() - selectStart, userId);

  if (!publicNote) {
    throw new HTTPException(404, { message: "Note is not published" });
  }

  // 2. Verify user owns it
  if (publicNote.userId !== userId) {
    throw new HTTPException(403, { message: "You don't have permission to view this public note status" });
  }

  return c.json(publicNote, 200);
});

export default crudRouter;
