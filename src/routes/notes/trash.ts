import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { db, notes } from "../../db";
import { eq, and, count } from "drizzle-orm";
import { emptyTrashResponseSchema } from "../../lib/openapi-schemas";

const trashRouter = new OpenAPIHono();

// DELETE /api/notes/empty-trash - Permanently delete all trashed notes
const emptyTrashRoute = createRoute({
  method: "delete",
  path: "/empty-trash",
  summary: "Empty trash",
  description:
    "Permanently delete all notes marked as deleted (in trash). This action cannot be undone",
  tags: ["Notes"],
  responses: {
    200: {
      description: "Trash emptied successfully",
      content: {
        "application/json": {
          schema: emptyTrashResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    500: {
      description: "Failed to empty trash",
    },
  },
  security: [{ Bearer: [] }],
});

trashRouter.openapi(emptyTrashRoute, async (c) => {
  try {
    const userId = c.get("userId");

    const [{ total }] = await db
      .select({ total: count() })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.deleted, true)));

    await db.delete(notes).where(and(eq(notes.userId, userId), eq(notes.deleted, true)));

    return c.json(
      {
        success: true,
        deletedCount: total,
        message: `${total} notes permanently deleted from trash`,
      },
      200
    );
  } catch {
    throw new HTTPException(500, {
      message: "Failed to empty trash. Please try again.",
    });
  }
});

export default trashRouter;
