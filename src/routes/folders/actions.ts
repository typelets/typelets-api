import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { db, folders } from "../../db";
import { reorderFolderSchema } from "../../lib/validation";
import { eq, and, desc, asc, isNull } from "drizzle-orm";
import { deleteCache } from "../../lib/cache";
import { CacheKeys } from "../../lib/cache-keys";

const actionsRouter = new Hono();

// PUT /api/folders/:id/reorder - Reorder folders
actionsRouter.put("/:id/reorder", zValidator("json", reorderFolderSchema), async (c) => {
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

export default actionsRouter;
