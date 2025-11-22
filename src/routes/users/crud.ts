import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getCurrentUser } from "../../middleware/auth";
import {
  userWithUsageSchema,
  meQuerySchema,
  deleteUserResponseSchema,
} from "../../lib/openapi-schemas";
import { db, fileAttachments, notes, users } from "../../db";
import { eq, and, sum, count, isNull, or } from "drizzle-orm";
import { logger } from "../../lib/logger";

const crudRouter = new OpenAPIHono();

// GET /api/users/me - Get current user
const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  summary: "Get current user",
  description:
    "Returns the authenticated user's information. When include_usage=true, includes storage and note usage statistics",
  tags: ["Users"],
  request: {
    query: meQuerySchema,
  },
  responses: {
    200: {
      description:
        "User information retrieved successfully. Returns user with usage when include_usage=true, otherwise just user info",
      content: {
        "application/json": {
          schema: userWithUsageSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getMeRoute, async (c) => {
  const user = getCurrentUser(c);
  const query = c.req.valid("query");
  const includeUsage = query.include_usage === "true";

  if (!includeUsage) {
    return c.json(user, 200);
  }

  const FREE_TIER_STORAGE_GB = process.env.FREE_TIER_STORAGE_GB
    ? parseFloat(process.env.FREE_TIER_STORAGE_GB)
    : 1;
  const FREE_TIER_NOTE_LIMIT = process.env.FREE_TIER_NOTE_LIMIT
    ? parseInt(process.env.FREE_TIER_NOTE_LIMIT)
    : 1000;

  const storageStart = Date.now();
  const storageResult = await db
    .select({
      totalBytes: sum(fileAttachments.size),
    })
    .from(fileAttachments)
    .innerJoin(notes, eq(fileAttachments.noteId, notes.id))
    .where(and(eq(notes.userId, user.id), or(isNull(notes.deleted), eq(notes.deleted, false))));
  logger.databaseQuery("sum", "file_attachments", Date.now() - storageStart, user.id);

  const noteCountStart = Date.now();
  const noteCountResult = await db
    .select({
      count: count(),
    })
    .from(notes)
    .where(and(eq(notes.userId, user.id), or(isNull(notes.deleted), eq(notes.deleted, false))));
  logger.databaseQuery("count", "notes", Date.now() - noteCountStart, user.id);

  const totalBytes = storageResult[0]?.totalBytes ? Number(storageResult[0].totalBytes) : 0;
  const totalMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
  const totalGB = Math.round((totalMB / 1024) * 100) / 100;
  const noteCount = noteCountResult[0]?.count || 0;

  const storageUsagePercent = Math.round((totalGB / FREE_TIER_STORAGE_GB) * 100 * 100) / 100;
  const noteUsagePercent = Math.round((noteCount / FREE_TIER_NOTE_LIMIT) * 100 * 100) / 100;

  return c.json(
    {
      ...user,
      usage: {
        storage: {
          totalBytes,
          totalMB,
          totalGB,
          limitGB: FREE_TIER_STORAGE_GB,
          usagePercent: storageUsagePercent,
          isOverLimit: totalGB > FREE_TIER_STORAGE_GB,
        },
        notes: {
          count: noteCount,
          limit: FREE_TIER_NOTE_LIMIT,
          usagePercent: noteUsagePercent,
          isOverLimit: noteCount > FREE_TIER_NOTE_LIMIT,
        },
      },
    },
    200
  );
});

// DELETE /api/users/me - Delete current user
const deleteMeRoute = createRoute({
  method: "delete",
  path: "/me",
  summary: "Delete current user",
  description:
    "Permanently deletes the authenticated user's account and all associated data (notes, folders, attachments)",
  tags: ["Users"],
  responses: {
    200: {
      description: "User account deleted successfully",
      content: {
        "application/json": {
          schema: deleteUserResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(deleteMeRoute, async (c) => {
  const userId = c.get("userId");

  const deleteStart = Date.now();
  await db.delete(users).where(eq(users.id, userId));
  logger.databaseQuery("delete", "users", Date.now() - deleteStart, userId);

  return c.json({ message: "User account deleted successfully" }, 200);
});

export default crudRouter;
