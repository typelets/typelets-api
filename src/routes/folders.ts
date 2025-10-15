import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { db, folders, notes } from "../db";
import {
  createFolderSchema,
  updateFolderSchema,
  foldersQuerySchema,
  reorderFolderSchema,
} from "../lib/validation";
import { eq, and, desc, count, asc, isNull } from "drizzle-orm";
import { getCache, setCache, deleteCache } from "../lib/cache";
import { CacheKeys, CacheTTL } from "../lib/cache-keys";
import { logger } from "../lib/logger";

const foldersRouter = new Hono();

foldersRouter.get("/", zValidator("query", foldersQuerySchema), async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");

  // Try cache first (only for page 1, no filters)
  if (query.page === 1 && !query.parentId) {
    const cacheKey = CacheKeys.foldersList(userId);
    const cached = await getCache(cacheKey);
    if (cached) {
      return c.json(cached);
    }
  }

  const conditions = [eq(folders.userId, userId)];

  if (query.parentId !== undefined) {
    conditions.push(eq(folders.parentId, query.parentId));
  }

  const whereClause = and(...conditions);

  const [{ total }] = await db.select({ total: count() }).from(folders).where(whereClause);

  const offset = (query.page - 1) * query.limit;
  const userFolders = await db.query.folders.findMany({
    where: whereClause,
    // Order by user's preferred order (sortOrder), then by creation date as fallback
    orderBy: [asc(folders.sortOrder), desc(folders.createdAt)],
    limit: query.limit,
    offset,
    with: {
      notes: {
        where: and(eq(notes.deleted, false), eq(notes.archived, false)),
      },
      children: {
        // Also order children by sortOrder
        orderBy: [asc(folders.sortOrder), desc(folders.createdAt)],
      },
    },
  });

  const foldersWithCounts = userFolders.map((folder) => ({
    ...folder,
    noteCount: folder.notes.length,
    notes: undefined, // Remove notes from response to keep it clean
  }));

  const result = {
    folders: foldersWithCounts,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };

  // Cache result (only for page 1, no filters)
  if (query.page === 1 && !query.parentId) {
    const cacheKey = CacheKeys.foldersList(userId);
    await setCache(cacheKey, result, CacheTTL.foldersList);
  }

  return c.json(result);
});

foldersRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const folderId = c.req.param("id");

  const folder = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
    with: {
      notes: {
        where: and(eq(notes.deleted, false), eq(notes.archived, false)),
      },
      children: {
        orderBy: [asc(folders.sortOrder), desc(folders.createdAt)],
      },
      parent: true,
    },
  });

  if (!folder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  return c.json({
    ...folder,
    noteCount: folder.notes.length,
  });
});

foldersRouter.post("/", zValidator("json", createFolderSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  // If parentId is provided, verify it exists and belongs to user
  if (data.parentId) {
    const parentFolder = await db.query.folders.findFirst({
      where: and(eq(folders.id, data.parentId), eq(folders.userId, userId)),
    });

    if (!parentFolder) {
      throw new HTTPException(400, { message: "Parent folder not found" });
    }
  }

  // Get the highest sort order for this user/parent to place new folder at the end
  const existingFolders = await db.query.folders.findMany({
    where: and(
      eq(folders.userId, userId),
      data.parentId ? eq(folders.parentId, data.parentId) : isNull(folders.parentId)
    ),
    orderBy: [desc(folders.sortOrder)],
    limit: 1,
  });

  const nextSortOrder = existingFolders.length > 0 ? (existingFolders[0].sortOrder || 0) + 1 : 0;

  const [newFolder] = await db
    .insert(folders)
    .values({
      ...data,
      userId,
      sortOrder: nextSortOrder,
    })
    .returning();

  // Invalidate cache
  await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

  return c.json(newFolder, 201);
});

foldersRouter.put("/:id", zValidator("json", updateFolderSchema), async (c) => {
  const userId = c.get("userId");
  const folderId = c.req.param("id");
  const data = c.req.valid("json");

  // Check if folder exists and belongs to user
  const existingFolder = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
  });

  if (!existingFolder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  // If parentId is being updated, verify it exists and belongs to user
  if (data.parentId) {
    const parentFolder = await db.query.folders.findFirst({
      where: and(eq(folders.id, data.parentId), eq(folders.userId, userId)),
    });

    if (!parentFolder) {
      throw new HTTPException(400, { message: "Parent folder not found" });
    }

    // Prevent circular references
    if (data.parentId === folderId) {
      throw new HTTPException(400, {
        message: "Folder cannot be its own parent",
      });
    }
  }

  const [updatedFolder] = await db
    .update(folders)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(folders.id, folderId))
    .returning();

  // Invalidate cache
  await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

  return c.json(updatedFolder);
});

foldersRouter.put("/:id/reorder", zValidator("json", reorderFolderSchema), async (c) => {
  const userId = c.get("userId");
  const folderId = c.req.param("id");
  const { newIndex } = c.req.valid("json");

  // Check if folder exists and belongs to user
  const folderToMove = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
  });

  if (!folderToMove) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  // Get all folders in the same parent scope (same parentId) for this user
  const siblingFolders = await db.query.folders.findMany({
    where: and(
      eq(folders.userId, userId),
      folderToMove.parentId ? eq(folders.parentId, folderToMove.parentId) : isNull(folders.parentId)
    ),
    orderBy: [asc(folders.sortOrder), desc(folders.createdAt)],
  });

  // Validate newIndex
  if (newIndex < 0 || newIndex >= siblingFolders.length) {
    throw new HTTPException(400, { message: "Invalid new index" });
  }

  // Find current position of the folder
  const currentIndex = siblingFolders.findIndex((folder) => folder.id === folderId);
  if (currentIndex === -1) {
    throw new HTTPException(404, { message: "Folder not found in siblings" });
  }

  // If already in correct position, no need to do anything
  if (currentIndex === newIndex) {
    return c.json({ message: "Folder already in correct position" });
  }

  try {
    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Create a new array with the folder moved to the new position
      const reorderedFolders = [...siblingFolders];
      const [movedFolder] = reorderedFolders.splice(currentIndex, 1);
      reorderedFolders.splice(newIndex, 0, movedFolder);

      // Update sort order for all affected folders
      const updatePromises = reorderedFolders.map((folder, index) =>
        tx
          .update(folders)
          .set({
            sortOrder: index,
            updatedAt: new Date(),
          })
          .where(eq(folders.id, folder.id))
      );

      await Promise.all(updatePromises);
    });

    // Invalidate cache
    await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

    return c.json({
      message: "Folder reordered successfully",
      folderId,
      newIndex,
    });
  } catch {
    throw new HTTPException(500, { message: "Failed to reorder folders" });
  }
});

foldersRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const folderId = c.req.param("id");

  // Check if folder exists and belongs to user
  const existingFolder = await db.query.folders.findFirst({
    where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
  });

  if (!existingFolder) {
    throw new HTTPException(404, { message: "Folder not found" });
  }

  // Check if folder has notes
  const folderNotes = await db.query.notes.findMany({
    where: and(eq(notes.folderId, folderId), eq(notes.deleted, false)),
  });

  if (folderNotes.length > 0) {
    throw new HTTPException(400, {
      message: "Cannot delete folder with notes. Move or delete notes first.",
    });
  }

  // Check if folder has subfolders
  const subfolders = await db.query.folders.findMany({
    where: eq(folders.parentId, folderId),
  });

  if (subfolders.length > 0) {
    throw new HTTPException(400, {
      message: "Cannot delete folder with subfolders. Delete subfolders first.",
    });
  }

  try {
    await db.transaction(async (tx) => {
      // Delete the folder
      const deleteResult = await tx.delete(folders).where(eq(folders.id, folderId));

      // Verify deletion succeeded
      if (deleteResult.rowCount === 0) {
        throw new Error(`Folder ${folderId} was not found or could not be deleted`);
      }

      // Reorder remaining folders to fill the gap
      const remainingFolders = await tx.query.folders.findMany({
        where: and(
          eq(folders.userId, userId),
          existingFolder.parentId
            ? eq(folders.parentId, existingFolder.parentId)
            : isNull(folders.parentId)
        ),
        orderBy: [asc(folders.sortOrder)],
      });

      // Update sort order for remaining folders
      if (remainingFolders.length > 0) {
        const updatePromises = remainingFolders.map((folder, index) =>
          tx.update(folders).set({ sortOrder: index }).where(eq(folders.id, folder.id))
        );

        const updateResults = await Promise.all(updatePromises);

        // Verify all updates succeeded
        const failedUpdates = updateResults.filter((result) => result.rowCount === 0);
        if (failedUpdates.length > 0) {
          throw new Error(`Failed to reorder ${failedUpdates.length} folder(s) after deletion`);
        }
      }
    });

    // Invalidate cache
    await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

    return c.json({ message: "Folder deleted successfully" });
  } catch (error) {
    logger.error(
      `Failed to delete folder ${folderId}`,
      {
        folderId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : undefined
    );
    throw new HTTPException(500, {
      message: "Failed to delete folder",
      cause: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default foldersRouter;
