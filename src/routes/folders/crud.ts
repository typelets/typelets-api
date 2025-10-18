import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { db, folders, notes } from "../../db";
import {
  folderWithCountsSchema,
  foldersListResponseSchema,
  foldersQueryParamsSchema,
  folderIdParamSchema,
  createFolderRequestSchema,
  updateFolderRequestSchema,
  folderSchema,
  deleteFolderResponseSchema,
} from "../../lib/openapi-schemas";
import { eq, and, desc, count, asc, isNull } from "drizzle-orm";
import { getCache, setCache, deleteCache, invalidateNoteCounts } from "../../lib/cache";
import { CacheKeys, CacheTTL } from "../../lib/cache-keys";
import { logger } from "../../lib/logger";

const crudRouter = new OpenAPIHono();

// GET /api/folders - List folders with pagination and filtering
const listFoldersRoute = createRoute({
  method: "get",
  path: "/",
  summary: "List folders",
  description:
    "Returns a paginated list of folders. Supports filtering by parent folder. Results include note counts and child folders.",
  tags: ["Folders"],
  request: {
    query: foldersQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Folders retrieved successfully",
      content: {
        "application/json": {
          schema: foldersListResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(listFoldersRoute, async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");

  // Set defaults for pagination
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  // Try cache first (only for page 1, no filters)
  if (page === 1 && !query.parentId) {
    const cacheKey = CacheKeys.foldersList(userId);
    const cached = await getCache(cacheKey);
    if (cached) {
      return c.json(cached, 200);
    }
  }

  const conditions = [eq(folders.userId, userId)];

  if (query.parentId !== undefined) {
    conditions.push(eq(folders.parentId, query.parentId));
  }

  const whereClause = and(...conditions);

  // Count total folders with metrics
  const countStart = Date.now();
  const [{ total }] = await db.select({ total: count() }).from(folders).where(whereClause);
  logger.databaseQuery("count", "folders", Date.now() - countStart, userId);

  const offset = (page - 1) * limit;

  // Fetch folders with metrics
  const queryStart = Date.now();
  const userFolders = await db.query.folders.findMany({
    where: whereClause,
    orderBy: [asc(folders.sortOrder), desc(folders.createdAt)],
    limit: limit,
    offset,
    with: {
      notes: {
        where: and(eq(notes.deleted, false), eq(notes.archived, false)),
      },
      children: {
        orderBy: [asc(folders.sortOrder), desc(folders.createdAt)],
      },
    },
  });
  logger.databaseQuery("select", "folders", Date.now() - queryStart, userId);

  const foldersWithCounts = userFolders.map((folder) => ({
    ...folder,
    noteCount: folder.notes.length,
    notes: undefined,
  }));

  const result = {
    folders: foldersWithCounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };

  // Cache result (only for page 1, no filters)
  if (page === 1 && !query.parentId) {
    const cacheKey = CacheKeys.foldersList(userId);
    await setCache(cacheKey, result, CacheTTL.foldersList);
  }

  return c.json(result, 200);
});

// GET /api/folders/:id - Get a single folder
const getFolderRoute = createRoute({
  method: "get",
  path: "/{id}",
  summary: "Get folder by ID",
  description:
    "Returns a single folder with note count, child folders, and parent folder information.",
  tags: ["Folders"],
  request: {
    params: folderIdParamSchema,
  },
  responses: {
    200: {
      description: "Folder retrieved successfully",
      content: {
        "application/json": {
          schema: folderWithCountsSchema,
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Folder not found",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(getFolderRoute, async (c) => {
  const userId = c.get("userId");
  const { id: folderId } = c.req.valid("param");

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

  return c.json(
    {
      ...folder,
      noteCount: folder.notes.length,
    },
    200
  );
});

// POST /api/folders - Create a new folder
const createFolderRoute = createRoute({
  method: "post",
  path: "/",
  summary: "Create folder",
  description: "Creates a new folder. Optionally specify a parent folder for nested organization.",
  tags: ["Folders"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createFolderRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Folder created successfully",
      content: {
        "application/json": {
          schema: folderSchema,
        },
      },
    },
    400: {
      description: "Bad request - Invalid input or parent folder not found",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(createFolderRoute, async (c) => {
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

  // Insert folder with metrics
  const insertStart = Date.now();
  const [newFolder] = await db
    .insert(folders)
    .values({
      ...data,
      userId,
      sortOrder: nextSortOrder,
    })
    .returning();
  logger.databaseQuery("insert", "folders", Date.now() - insertStart, userId);

  // Invalidate folder list cache
  await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

  // Invalidate note counts cache for parent folder (or global if root-level)
  // This ensures the counts endpoint reflects the new folder structure
  await invalidateNoteCounts(userId, data.parentId || null);

  return c.json(newFolder, 201);
});

// PUT /api/folders/:id - Update a folder
const updateFolderRoute = createRoute({
  method: "put",
  path: "/{id}",
  summary: "Update folder",
  description: "Updates folder properties (name, color, parent). Prevents circular references.",
  tags: ["Folders"],
  request: {
    params: folderIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateFolderRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Folder updated successfully",
      content: {
        "application/json": {
          schema: folderSchema,
        },
      },
    },
    400: {
      description: "Bad request - Invalid input, parent not found, or circular reference",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Folder not found",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(updateFolderRoute, async (c) => {
  const userId = c.get("userId");
  const { id: folderId } = c.req.valid("param");
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

  // Update folder with metrics
  const updateStart = Date.now();
  const [updatedFolder] = await db
    .update(folders)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(folders.id, folderId))
    .returning();
  logger.databaseQuery("update", "folders", Date.now() - updateStart, userId);

  // Invalidate folder list cache
  await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

  // Invalidate note counts cache if folder moved between parents
  const oldParentId = existingFolder.parentId;
  const newParentId = "parentId" in data ? data.parentId || null : oldParentId;

  if (oldParentId !== newParentId) {
    // Folder moved - invalidate both old and new parent counts
    await invalidateNoteCounts(userId, oldParentId);
    if (newParentId !== oldParentId) {
      await invalidateNoteCounts(userId, newParentId);
    }
  } else {
    // Folder properties changed but didn't move - invalidate current parent
    await invalidateNoteCounts(userId, oldParentId);
  }

  return c.json(updatedFolder, 200);
});

// DELETE /api/folders/:id - Delete a folder
const deleteFolderRoute = createRoute({
  method: "delete",
  path: "/{id}",
  summary: "Delete folder",
  description: "Deletes an empty folder. Folder must not contain notes or subfolders.",
  tags: ["Folders"],
  request: {
    params: folderIdParamSchema,
  },
  responses: {
    200: {
      description: "Folder deleted successfully",
      content: {
        "application/json": {
          schema: deleteFolderResponseSchema,
        },
      },
    },
    400: {
      description: "Bad request - Folder contains notes or subfolders",
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
    404: {
      description: "Folder not found",
    },
    500: {
      description: "Internal server error - Failed to delete folder",
    },
  },
  security: [{ Bearer: [] }],
});

crudRouter.openapi(deleteFolderRoute, async (c) => {
  const userId = c.get("userId");
  const { id: folderId } = c.req.valid("param");

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
    const txStart = Date.now();
    await db.transaction(async (tx) => {
      // Delete the folder
      await tx.delete(folders).where(eq(folders.id, folderId));

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

        await Promise.all(updatePromises);
      }
    });
    logger.databaseQuery("delete", "folders", Date.now() - txStart, userId);

    // Invalidate folder list cache
    await deleteCache(CacheKeys.foldersList(userId), CacheKeys.folderTree(userId));

    // Invalidate note counts cache for parent folder (or global if root-level)
    await invalidateNoteCounts(userId, existingFolder.parentId);

    return c.json({ message: "Folder deleted successfully" }, 200);
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

export default crudRouter;
