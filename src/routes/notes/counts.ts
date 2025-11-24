import { OpenAPIHono, createRoute, RouteHandler } from "@hono/zod-openapi";
import { db, folders, publicNotes } from "../../db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getCache, setCache } from "../../lib/cache";
import { CacheKeys, CacheTTL } from "../../lib/cache-keys";
import { z } from "@hono/zod-openapi";
import { logger } from "../../lib/logger";
import { noteCountsSchema, folderCountsSchema } from "../../lib/openapi-schemas";

const countsRouter = new OpenAPIHono();

// Optimized helper function to get all descendant folder IDs using recursive CTE
async function getAllDescendantFolderIds(
  folderId: string | string[],
  userId: string
): Promise<string[]> {
  const folderIds = Array.isArray(folderId) ? folderId : [folderId];

  if (folderIds.length === 0) {
    return [];
  }

  const queryStart = Date.now();
  // Use a recursive CTE to get all descendants in a single query
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE folder_tree AS (
      -- Base case: start with the specified folder(s)
      SELECT id, parent_id
      FROM folders
      WHERE id IN (${sql.join(
        folderIds.map((id) => sql`${id}`),
        sql`, `
      )})
        AND user_id = ${userId}

      UNION ALL

      -- Recursive case: get all children
      SELECT f.id, f.parent_id
      FROM folders f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
      WHERE f.user_id = ${userId}
    )
    SELECT DISTINCT id FROM folder_tree
  `);
  logger.databaseQuery("select_recursive", "folders", Date.now() - queryStart, userId);

  return (result as unknown as { id: string }[]).map((row) => row.id);
}

// Optimized helper to get counts for multiple folders in a single query
async function getCountsForFolders(
  folderIds: string[],
  userId: string
): Promise<{
  all: number;
  starred: number;
  public: number;
  archived: number;
  trash: number;
}> {
  if (folderIds.length === 0) {
    return { all: 0, starred: 0, public: 0, archived: 0, trash: 0 };
  }

  const queryStart = Date.now();
  // Get all counts in a single query using conditional aggregation
  const result = await db.execute<{
    all_count: string;
    starred_count: string;
    public_count: string;
    archived_count: string;
    trash_count: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE n.deleted = false AND n.archived = false) as all_count,
      COUNT(*) FILTER (WHERE n.starred = true AND n.deleted = false AND n.archived = false) as starred_count,
      COUNT(*) FILTER (WHERE pn.id IS NOT NULL AND n.deleted = false AND n.archived = false) as public_count,
      COUNT(*) FILTER (WHERE n.archived = true AND n.deleted = false) as archived_count,
      COUNT(*) FILTER (WHERE n.deleted = true) as trash_count
    FROM notes n
    LEFT JOIN public_notes pn ON pn.note_id = n.id
    WHERE n.user_id = ${userId}
      AND n.folder_id IN (${sql.join(
        folderIds.map((id) => sql`${id}`),
        sql`, `
      )})
  `);
  logger.databaseQuery("count_aggregate", "notes", Date.now() - queryStart, userId);

  const rows = result as unknown as {
    all_count: string;
    starred_count: string;
    public_count: string;
    archived_count: string;
    trash_count: string;
  }[];
  const row = rows[0];
  return {
    all: parseInt(row.all_count),
    starred: parseInt(row.starred_count),
    public: parseInt(row.public_count),
    archived: parseInt(row.archived_count),
    trash: parseInt(row.trash_count),
  };
}

// Cache warming function - call this after note/folder operations to keep cache fresh
export async function warmNotesCountsCache(userId: string): Promise<void> {
  // Get total counts for all user's notes using single query
  const totalCountsStart = Date.now();
  const totalCountsResult = await db.execute<{
    all_count: string;
    starred_count: string;
    public_count: string;
    archived_count: string;
    trash_count: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE n.deleted = false AND n.archived = false) as all_count,
      COUNT(*) FILTER (WHERE n.starred = true AND n.deleted = false AND n.archived = false) as starred_count,
      COUNT(*) FILTER (WHERE pn.id IS NOT NULL AND n.deleted = false AND n.archived = false) as public_count,
      COUNT(*) FILTER (WHERE n.archived = true AND n.deleted = false) as archived_count,
      COUNT(*) FILTER (WHERE n.deleted = true) as trash_count
    FROM notes n
    LEFT JOIN public_notes pn ON pn.note_id = n.id
    WHERE n.user_id = ${userId}
  `);
  logger.databaseQuery("count_aggregate", "notes", Date.now() - totalCountsStart, userId);

  const totalCountsRows = totalCountsResult as unknown as {
    all_count: string;
    starred_count: string;
    public_count: string;
    archived_count: string;
    trash_count: string;
  }[];
  const totalCounts = totalCountsRows[0];

  // Get root-level folders (no parent)
  const foldersStart = Date.now();
  const rootFolders = await db.query.folders.findMany({
    where: and(eq(folders.userId, userId), isNull(folders.parentId)),
    columns: { id: true },
  });
  logger.databaseQuery("select", "folders", Date.now() - foldersStart, userId);

  const folderCounts: Record<
    string,
    {
      all: number;
      starred: number;
      public: number;
      archived: number;
      trash: number;
    }
  > = {};

  if (rootFolders.length > 0) {
    // Build a map of folder ID to its descendants
    const folderToDescendants = new Map<string, string[]>();

    for (const rootFolder of rootFolders) {
      const descendants = await getAllDescendantFolderIds(rootFolder.id, userId);
      folderToDescendants.set(rootFolder.id, descendants);
    }

    // Get counts for all folders in parallel
    const folderCountsPromises = Array.from(folderToDescendants.entries()).map(
      async ([folderId, descendants]) => {
        const counts = await getCountsForFolders(descendants, userId);
        return { folderId, counts };
      }
    );

    const folderCountsResults = await Promise.all(folderCountsPromises);

    for (const { folderId, counts } of folderCountsResults) {
      folderCounts[folderId] = counts;
    }
  }

  const counts = {
    all: parseInt(totalCounts.all_count),
    starred: parseInt(totalCounts.starred_count),
    public: parseInt(totalCounts.public_count),
    archived: parseInt(totalCounts.archived_count),
    trash: parseInt(totalCounts.trash_count),
    folders: folderCounts,
  };

  // Warm the cache
  const cacheKey = CacheKeys.notesCounts(userId);
  await setCache(cacheKey, counts, CacheTTL.notesCounts);
}

const getNotesCountsRoute = createRoute({
  method: "get",
  path: "",
  summary: "Get note counts",
  description:
    "Returns aggregated counts of notes by category. Without folder_id: returns total counts plus folders object. With folder_id: returns only a folders object (Record<folderId, counts>) with counts for each direct child folder including their descendants",
  tags: ["Notes"],
  request: {
    query: z.object({
      folder_id: z
        .string()
        .optional()
        .openapi({
          param: { name: "folder_id", in: "query" },
          example: "123e4567-e89b-12d3-a456-426614174000",
          description:
            "Optional. Get counts for each direct child folder of this folder ID (includes descendant notes). If omitted, returns total counts plus root-level folder counts",
        }),
    }),
  },
  responses: {
    200: {
      description:
        "Note counts retrieved successfully. Without folder_id: returns {all, starred, public, archived, trash, folders}. With folder_id: returns Record<folderId, {all, starred, public, archived, trash}>",
      content: {
        "application/json": {
          schema: z.union([noteCountsSchema, folderCountsSchema]),
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

const getNotesCountsHandler: RouteHandler<typeof getNotesCountsRoute> = async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");
  const folderId = query.folder_id;

  try {
    // If folder_id is provided, get counts for each direct child folder
    if (folderId) {
      const cacheKey = `notes:${userId}:folder:${folderId}:counts`;

      // Try to get from cache first
      const cachedCounts = await getCache<
        Record<
          string,
          {
            all: number;
            starred: number;
            public: number;
            archived: number;
            trash: number;
          }
        >
      >(cacheKey);

      if (cachedCounts) {
        return c.json(cachedCounts, 200);
      }

      // Get direct children of the specified folder
      const childFoldersStart = Date.now();
      const childFolders = await db.query.folders.findMany({
        where: and(eq(folders.parentId, folderId), eq(folders.userId, userId)),
        columns: { id: true },
      });
      logger.databaseQuery("select", "folders", Date.now() - childFoldersStart, userId);

      if (childFolders.length === 0) {
        // No child folders, return empty object
        await setCache(cacheKey, {}, CacheTTL.notesCounts);
        return c.json({}, 200);
      }

      // Build a map of folder ID to its descendants (including itself)
      const folderToDescendants = new Map<string, string[]>();

      for (const childFolder of childFolders) {
        // Get descendants for this specific child
        const descendants = await getAllDescendantFolderIds(childFolder.id, userId);
        folderToDescendants.set(childFolder.id, descendants);
      }

      // Get counts for all folders in parallel
      const folderCountsPromises = Array.from(folderToDescendants.entries()).map(
        async ([folderId, descendants]) => {
          const counts = await getCountsForFolders(descendants, userId);
          return { folderId, counts };
        }
      );

      const folderCountsResults = await Promise.all(folderCountsPromises);

      const folderCounts: Record<
        string,
        {
          all: number;
          starred: number;
          public: number;
          archived: number;
          trash: number;
        }
      > = {};

      for (const { folderId, counts } of folderCountsResults) {
        folderCounts[folderId] = counts;
      }

      // Cache the results
      await setCache(cacheKey, folderCounts, CacheTTL.notesCounts);

      return c.json(folderCounts, 200);
    }

    // Default behavior: get total counts for the user + root folder counts
    const cacheKey = CacheKeys.notesCounts(userId);

    // Try to get from cache first
    const cachedCounts = await getCache<{
      all: number;
      starred: number;
      public: number;
      archived: number;
      trash: number;
      folders: Record<
        string,
        {
          all: number;
          starred: number;
          public: number;
          archived: number;
          trash: number;
        }
      >;
    }>(cacheKey);

    if (cachedCounts) {
      return c.json(cachedCounts, 200);
    }

    // Get total counts for all user's notes using single query
    const totalCountsStart = Date.now();
    const totalCountsResult = await db.execute<{
      all_count: string;
      starred_count: string;
      public_count: string;
      archived_count: string;
      trash_count: string;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE n.deleted = false AND n.archived = false) as all_count,
        COUNT(*) FILTER (WHERE n.starred = true AND n.deleted = false AND n.archived = false) as starred_count,
        COUNT(*) FILTER (WHERE pn.id IS NOT NULL AND n.deleted = false AND n.archived = false) as public_count,
        COUNT(*) FILTER (WHERE n.archived = true AND n.deleted = false) as archived_count,
        COUNT(*) FILTER (WHERE n.deleted = true) as trash_count
      FROM notes n
      LEFT JOIN public_notes pn ON pn.note_id = n.id
      WHERE n.user_id = ${userId}
    `);
    logger.databaseQuery("count_aggregate", "notes", Date.now() - totalCountsStart, userId);

    const totalCountsRows = totalCountsResult as unknown as {
      all_count: string;
      starred_count: string;
      public_count: string;
      archived_count: string;
      trash_count: string;
    }[];
    const totalCounts = totalCountsRows[0];

    // Get root-level folders (no parent)
    const rootFoldersStart = Date.now();
    const rootFolders = await db.query.folders.findMany({
      where: and(eq(folders.userId, userId), isNull(folders.parentId)),
      columns: { id: true },
    });
    logger.databaseQuery("select", "folders", Date.now() - rootFoldersStart, userId);

    const folderCounts: Record<
      string,
      {
        all: number;
        starred: number;
        public: number;
        archived: number;
        trash: number;
      }
    > = {};

    if (rootFolders.length > 0) {
      // Build a map of folder ID to its descendants (including itself)
      const folderToDescendants = new Map<string, string[]>();

      for (const rootFolder of rootFolders) {
        const descendants = await getAllDescendantFolderIds(rootFolder.id, userId);
        folderToDescendants.set(rootFolder.id, descendants);
      }

      // Get counts for all folders in parallel
      const folderCountsPromises = Array.from(folderToDescendants.entries()).map(
        async ([folderId, descendants]) => {
          const counts = await getCountsForFolders(descendants, userId);
          return { folderId, counts };
        }
      );

      const folderCountsResults = await Promise.all(folderCountsPromises);

      for (const { folderId, counts } of folderCountsResults) {
        folderCounts[folderId] = counts;
      }
    }

    const counts = {
      all: parseInt(totalCounts.all_count),
      starred: parseInt(totalCounts.starred_count),
      public: parseInt(totalCounts.public_count),
      archived: parseInt(totalCounts.archived_count),
      trash: parseInt(totalCounts.trash_count),
      folders: folderCounts,
    };

    // Cache the results
    await setCache(cacheKey, counts, CacheTTL.notesCounts);

    return c.json(counts, 200);
  } catch (error) {
    throw error;
  }
};

countsRouter.openapi(getNotesCountsRoute, getNotesCountsHandler);

// Also register with trailing slash (Swagger UI adds trailing slashes)
const getNotesCountsRouteSlash = createRoute({
  method: "get",
  path: "/",
  summary: "Get note counts",
  description:
    "Returns aggregated counts of notes by category. Without folder_id: returns total counts plus folders object. With folder_id: returns only a folders object (Record<folderId, counts>) with counts for each direct child folder including their descendants",
  tags: ["Notes"],
  request: {
    query: z.object({
      folder_id: z
        .string()
        .optional()
        .openapi({
          param: { name: "folder_id", in: "query" },
          example: "123e4567-e89b-12d3-a456-426614174000",
          description:
            "Optional. Get counts for each direct child folder of this folder ID (includes descendant notes). If omitted, returns total counts plus root-level folder counts",
        }),
    }),
  },
  responses: {
    200: {
      description:
        "Note counts retrieved successfully. Without folder_id: returns {all, starred, public, archived, trash, folders}. With folder_id: returns Record<folderId, {all, starred, public, archived, trash}>",
      content: {
        "application/json": {
          schema: z.union([noteCountsSchema, folderCountsSchema]),
        },
      },
    },
    401: {
      description: "Unauthorized - Invalid or missing authentication",
    },
  },
  security: [{ Bearer: [] }],
});

countsRouter.openapi(getNotesCountsRouteSlash, getNotesCountsHandler);

export default countsRouter;
