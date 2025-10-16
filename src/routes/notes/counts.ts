import { OpenAPIHono, createRoute, RouteHandler } from "@hono/zod-openapi";
import { db, notes, folders } from "../../db";
import { eq, and, count, inArray, isNull } from "drizzle-orm";
import { getCache, setCache } from "../../lib/cache";
import { CacheKeys, CacheTTL } from "../../lib/cache-keys";
import { z } from "@hono/zod-openapi";

const countsRouter = new OpenAPIHono();

// Helper function to recursively get all descendant folder IDs
async function getAllDescendantFolderIds(folderId: string, userId: string): Promise<string[]> {
  const childFolders = await db.query.folders.findMany({
    where: and(eq(folders.parentId, folderId), eq(folders.userId, userId)),
    columns: { id: true },
  });

  if (childFolders.length === 0) {
    return [folderId];
  }

  const allIds = [folderId];
  for (const child of childFolders) {
    const descendantIds = await getAllDescendantFolderIds(child.id, userId);
    allIds.push(...descendantIds);
  }

  return allIds;
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
        "Note counts retrieved successfully. Without folder_id: returns {all, starred, archived, trash, folders}. With folder_id: returns Record<folderId, {all, starred, archived, trash}>",
      content: {
        "application/json": {
          schema: z.any().openapi({
            example: {
              all: 42,
              starred: 5,
              archived: 12,
              trash: 3,
              folders: {
                "123e4567-e89b-12d3-a456-426614174000": {
                  all: 10,
                  starred: 2,
                  archived: 1,
                  trash: 0,
                },
              },
            },
          }),
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
          archived: number;
          trash: number;
        }
      >
    >(cacheKey);

    if (cachedCounts) {
      return c.json(cachedCounts, 200);
    }

    // Get direct children of the specified folder
    const childFolders = await db.query.folders.findMany({
      where: and(eq(folders.parentId, folderId), eq(folders.userId, userId)),
      columns: { id: true },
    });

    const folderCounts: Record<
      string,
      {
        all: number;
        starred: number;
        archived: number;
        trash: number;
      }
    > = {};

    // For each child folder, get all descendant folder IDs and count notes
    for (const childFolder of childFolders) {
      const allFolderIds = await getAllDescendantFolderIds(childFolder.id, userId);

      const [allCount] = await db
        .select({ total: count() })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            inArray(notes.folderId, allFolderIds),
            eq(notes.deleted, false),
            eq(notes.archived, false)
          )
        );

      const [starredCount] = await db
        .select({ total: count() })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            inArray(notes.folderId, allFolderIds),
            eq(notes.starred, true),
            eq(notes.deleted, false),
            eq(notes.archived, false)
          )
        );

      const [archivedCount] = await db
        .select({ total: count() })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            inArray(notes.folderId, allFolderIds),
            eq(notes.archived, true),
            eq(notes.deleted, false)
          )
        );

      const [trashCount] = await db
        .select({ total: count() })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            inArray(notes.folderId, allFolderIds),
            eq(notes.deleted, true)
          )
        );

      folderCounts[childFolder.id] = {
        all: allCount.total,
        starred: starredCount.total,
        archived: archivedCount.total,
        trash: trashCount.total,
      };
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
    archived: number;
    trash: number;
    folders: Record<
      string,
      {
        all: number;
        starred: number;
        archived: number;
        trash: number;
      }
    >;
  }>(cacheKey);

  if (cachedCounts) {
    return c.json(cachedCounts, 200);
  }

  // If not in cache, query the database for total counts
  const [allCount] = await db
    .select({ total: count() })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.deleted, false), eq(notes.archived, false)));

  const [starredCount] = await db
    .select({ total: count() })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.starred, true),
        eq(notes.deleted, false),
        eq(notes.archived, false)
      )
    );

  const [archivedCount] = await db
    .select({ total: count() })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.archived, true), eq(notes.deleted, false)));

  const [trashCount] = await db
    .select({ total: count() })
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.deleted, true)));

  // Get root-level folders (no parent)
  const rootFolders = await db.query.folders.findMany({
    where: and(eq(folders.userId, userId), isNull(folders.parentId)),
    columns: { id: true },
  });

  const folderCounts: Record<
    string,
    {
      all: number;
      starred: number;
      archived: number;
      trash: number;
    }
  > = {};

  // For each root folder, get all descendant folder IDs and count notes
  for (const rootFolder of rootFolders) {
    const allFolderIds = await getAllDescendantFolderIds(rootFolder.id, userId);

    const [folderAllCount] = await db
      .select({ total: count() })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          inArray(notes.folderId, allFolderIds),
          eq(notes.deleted, false),
          eq(notes.archived, false)
        )
      );

    const [folderStarredCount] = await db
      .select({ total: count() })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          inArray(notes.folderId, allFolderIds),
          eq(notes.starred, true),
          eq(notes.deleted, false),
          eq(notes.archived, false)
        )
      );

    const [folderArchivedCount] = await db
      .select({ total: count() })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          inArray(notes.folderId, allFolderIds),
          eq(notes.archived, true),
          eq(notes.deleted, false)
        )
      );

    const [folderTrashCount] = await db
      .select({ total: count() })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          inArray(notes.folderId, allFolderIds),
          eq(notes.deleted, true)
        )
      );

    folderCounts[rootFolder.id] = {
      all: folderAllCount.total,
      starred: folderStarredCount.total,
      archived: folderArchivedCount.total,
      trash: folderTrashCount.total,
    };
  }

  const counts = {
    all: allCount.total,
    starred: starredCount.total,
    archived: archivedCount.total,
    trash: trashCount.total,
    folders: folderCounts,
  };

  // Cache the results
  await setCache(cacheKey, counts, CacheTTL.notesCounts);

  return c.json(counts, 200);
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
        "Note counts retrieved successfully. Without folder_id: returns {all, starred, archived, trash, folders}. With folder_id: returns Record<folderId, {all, starred, archived, trash}>",
      content: {
        "application/json": {
          schema: z.any().openapi({
            example: {
              all: 42,
              starred: 5,
              archived: 12,
              trash: 3,
              folders: {
                "123e4567-e89b-12d3-a456-426614174000": {
                  all: 10,
                  starred: 2,
                  archived: 1,
                  trash: 0,
                },
              },
            },
          }),
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
