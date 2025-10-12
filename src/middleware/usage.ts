import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Middleware to check if user would exceed free tier limits
 * Returns appropriate error messages for frontend upgrade prompts
 */

export const checkNoteLimits = async (c: Context, next: Next) => {
  const userId = c.get("userId");

  const FREE_TIER_NOTE_LIMIT = process.env.FREE_TIER_NOTE_LIMIT ? parseInt(process.env.FREE_TIER_NOTE_LIMIT) : 1000;
  
  const { db, notes } = await import("../db");
  const { eq, and, count, isNull, or } = await import("drizzle-orm");
  
  const noteCountResult = await db
    .select({
      count: count(),
    })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        or(isNull(notes.deleted), eq(notes.deleted, false))
      )
    );
  
  const currentNoteCount = noteCountResult[0]?.count || 0;
  
  if (currentNoteCount >= FREE_TIER_NOTE_LIMIT) {
    throw new HTTPException(402, {
      message: `Note limit reached. You have ${currentNoteCount}/${FREE_TIER_NOTE_LIMIT} notes. Upgrade to create more notes.`,
      cause: {
        code: "NOTE_LIMIT_EXCEEDED",
        currentCount: currentNoteCount,
        limit: FREE_TIER_NOTE_LIMIT,
        upgradeRequired: true,
      },
    });
  }
  
  await next();
};

export const checkStorageLimits = (expectedFileSizeBytes: number) => {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    
      const FREE_TIER_STORAGE_GB = process.env.FREE_TIER_STORAGE_GB ? parseFloat(process.env.FREE_TIER_STORAGE_GB) : 1;
    const FREE_TIER_STORAGE_BYTES = FREE_TIER_STORAGE_GB * 1024 * 1024 * 1024;
    
    const { db, fileAttachments, notes } = await import("../db");
    const { eq, and, sum, isNull, or } = await import("drizzle-orm");
    
    const storageResult = await db
      .select({
        totalBytes: sum(fileAttachments.size),
      })
      .from(fileAttachments)
      .innerJoin(notes, eq(fileAttachments.noteId, notes.id))
      .where(
        and(
          eq(notes.userId, userId),
          or(isNull(notes.deleted), eq(notes.deleted, false))
        )
      );
    
    const currentStorageBytes = storageResult[0]?.totalBytes ? Number(storageResult[0].totalBytes) : 0;
    const currentStorageMB = Math.round((currentStorageBytes / (1024 * 1024)) * 100) / 100;
    const expectedTotalBytes = currentStorageBytes + expectedFileSizeBytes;
    const expectedTotalMB = Math.round((expectedTotalBytes / (1024 * 1024)) * 100) / 100;
    
    if (expectedTotalBytes > FREE_TIER_STORAGE_BYTES) {
      const fileSizeMB = Math.round((expectedFileSizeBytes / (1024 * 1024)) * 100) / 100;
      
      throw new HTTPException(402, {
        message: `Storage limit would be exceeded. Current: ${currentStorageMB}MB, File: ${fileSizeMB}MB, Total: ${expectedTotalMB}MB, Limit: ${FREE_TIER_STORAGE_GB}GB. Upgrade for more storage.`,
        cause: {
          code: "STORAGE_LIMIT_EXCEEDED",
          currentStorageMB,
          fileSizeMB,
          expectedTotalMB,
          limitGB: FREE_TIER_STORAGE_GB,
          upgradeRequired: true,
        },
      });
    }
    
    c.set("currentStorageMB", currentStorageMB);
    c.set("expectedTotalMB", expectedTotalMB);
    
    await next();
  };
};

/**
 * Generic usage check that can be used for both notes and storage
 */
export const checkUsageLimits = async (c: Context, next: Next) => {
  const userId = c.get("userId");

  const FREE_TIER_STORAGE_GB = process.env.FREE_TIER_STORAGE_GB ? parseFloat(process.env.FREE_TIER_STORAGE_GB) : 1;
  const FREE_TIER_NOTE_LIMIT = process.env.FREE_TIER_NOTE_LIMIT ? parseInt(process.env.FREE_TIER_NOTE_LIMIT) : 1000;
  
  const { db, fileAttachments, notes } = await import("../db");
  const { eq, and, sum, count, isNull, or } = await import("drizzle-orm");
  
  const [storageResult, noteCountResult] = await Promise.all([
    db
      .select({
        totalBytes: sum(fileAttachments.size),
      })
      .from(fileAttachments)
      .innerJoin(notes, eq(fileAttachments.noteId, notes.id))
      .where(
        and(
          eq(notes.userId, userId),
          or(isNull(notes.deleted), eq(notes.deleted, false))
        )
      ),
    db
      .select({
        count: count(),
      })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          or(isNull(notes.deleted), eq(notes.deleted, false))
        )
      ),
  ]);
  
  const currentStorageBytes = storageResult[0]?.totalBytes ? Number(storageResult[0].totalBytes) : 0;
  const currentStorageGB = currentStorageBytes / (1024 * 1024 * 1024);
  const currentNoteCount = noteCountResult[0]?.count || 0;
  
  c.set("currentStorageBytes", currentStorageBytes);
  c.set("currentStorageGB", currentStorageGB);
  c.set("currentNoteCount", currentNoteCount);
  c.set("storageLimitGB", FREE_TIER_STORAGE_GB);
  c.set("noteLimitCount", FREE_TIER_NOTE_LIMIT);
  
  await next();
};