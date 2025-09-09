import { Hono } from "hono";
import { getCurrentUser } from "../middleware/auth";

const usersRouter = new Hono();

usersRouter.get("/me", async (c) => {
  const user = getCurrentUser(c);
  const includeUsage = c.req.query("include_usage") === "true";
  
  if (!includeUsage) {
    return c.json(user);
  }
  
  const FREE_TIER_STORAGE_GB = process.env.FREE_TIER_STORAGE_GB ? parseFloat(process.env.FREE_TIER_STORAGE_GB) : 1;
  const FREE_TIER_NOTE_LIMIT = process.env.FREE_TIER_NOTE_LIMIT ? parseInt(process.env.FREE_TIER_NOTE_LIMIT) : 100;
  
  const { db, fileAttachments, notes } = await import("../db");
  const { eq, and, sum, count, isNull, or } = await import("drizzle-orm");
  
  const storageResult = await db
    .select({
      totalBytes: sum(fileAttachments.size),
    })
    .from(fileAttachments)
    .innerJoin(notes, eq(fileAttachments.noteId, notes.id))
    .where(
      and(
        eq(notes.userId, user.id),
        or(isNull(notes.deleted), eq(notes.deleted, false)) // Only count files from non-deleted notes
      )
    );
  
  const noteCountResult = await db
    .select({
      count: count(),
    })
    .from(notes)
    .where(
      and(
        eq(notes.userId, user.id),
        or(isNull(notes.deleted), eq(notes.deleted, false))
      )
    );
  
  const totalBytes = storageResult[0]?.totalBytes ? Number(storageResult[0].totalBytes) : 0;
  const totalMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
  const totalGB = Math.round((totalMB / 1024) * 100) / 100;
  const noteCount = noteCountResult[0]?.count || 0;
  
  const storageUsagePercent = Math.round((totalGB / FREE_TIER_STORAGE_GB) * 100 * 100) / 100;
  const noteUsagePercent = Math.round((noteCount / FREE_TIER_NOTE_LIMIT) * 100 * 100) / 100;
  
  return c.json({
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
  });
});

usersRouter.delete("/me", async (c) => {
  const { db, users } = await import("../db");
  const { eq } = await import("drizzle-orm");

  const userId = c.get("userId");

  await db.delete(users).where(eq(users.id, userId));

  return c.json({ message: "User account deleted successfully" });
});

export default usersRouter;
