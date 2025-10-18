import { Cluster, ClusterOptions } from "ioredis";
import { logger } from "./logger";
import { db, folders } from "../db";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/node";

let client: Cluster | null = null;

export function getCacheClient(): Cluster | null {
  if (!process.env.VALKEY_HOST) {
    logger.warn("VALKEY_HOST not configured, caching disabled");
    return null;
  }

  if (!client) {
    try {
      const clusterOptions: ClusterOptions = {
        dnsLookup: (address, callback) => callback(null, address),
        redisOptions: {
          tls: process.env.NODE_ENV === "production" ? {} : undefined,
          connectTimeout: 5000,
        },
        clusterRetryStrategy: (times) => {
          if (times > 3) {
            logger.error("Valkey connection failed after 3 retries");
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      };

      client = new Cluster(
        [
          {
            host: process.env.VALKEY_HOST,
            port: parseInt(process.env.VALKEY_PORT || "6379"),
          },
        ],
        clusterOptions
      );

      client.on("error", (err) => {
        logger.error("Valkey client error", { error: err.message }, err);
      });

      client.on("connect", () => {
        logger.info("Connected to Valkey cluster");
      });
    } catch (error) {
      logger.error(
        "Failed to initialize Valkey client",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : undefined
      );
      client = null;
    }
  }

  return client;
}

export async function closeCache(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
    logger.info("Valkey connection closed");
  }
}

// Cache utilities
export async function getCache<T>(key: string): Promise<T | null> {
  const cache = getCacheClient();
  if (!cache) return null;

  return await Sentry.startSpan(
    {
      op: "cache.get",
      name: "cache.get",
      attributes: {
        "cache.key": key,
      },
    },
    async (span) => {
      const startTime = Date.now();
      try {
        const data = await cache.get(key);
        const duration = Date.now() - startTime;
        const hit = data !== null;

        // Set Sentry span attributes
        span.setAttribute("cache.hit", hit);
        if (data) {
          span.setAttribute("cache.item_size", data.length);
        }

        // Log cache operation with metrics
        logger.cacheOperation("get", key, hit, duration);

        return data ? JSON.parse(data) : null;
      } catch (error) {
        span.setStatus({ code: 2, message: "error" }); // SPAN_STATUS_ERROR
        logger.cacheError("get", key, error instanceof Error ? error : new Error(String(error)));
        return null;
      }
    }
  );
}

export async function setCache(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const cache = getCacheClient();
  if (!cache) return;

  await Sentry.startSpan(
    {
      op: "cache.put",
      name: "cache.put",
      attributes: {
        "cache.key": key,
      },
    },
    async (span) => {
      const startTime = Date.now();
      try {
        const serialized = JSON.stringify(value);

        // Set Sentry span attributes
        span.setAttribute("cache.item_size", serialized.length);
        if (ttlSeconds) {
          span.setAttribute("cache.ttl", ttlSeconds);
        }

        if (ttlSeconds) {
          await cache.setex(key, ttlSeconds, serialized);
        } else {
          await cache.set(key, serialized);
        }
        const duration = Date.now() - startTime;

        // Log cache operation with metrics
        logger.cacheOperation("set", key, undefined, duration, ttlSeconds);
      } catch (error) {
        span.setStatus({ code: 2, message: "error" }); // SPAN_STATUS_ERROR
        logger.cacheError("set", key, error instanceof Error ? error : new Error(String(error)));
      }
    }
  );
}

export async function deleteCache(...keys: string[]): Promise<void> {
  const cache = getCacheClient();
  if (!cache || keys.length === 0) return;

  await Sentry.startSpan(
    {
      op: "cache.remove",
      name: "cache.remove",
      attributes: {
        "cache.key": keys[0], // Use first key as representative
        "cache.key_count": keys.length,
      },
    },
    async (span) => {
      const startTime = Date.now();
      try {
        // In cluster mode, keys may hash to different slots
        // Use pipeline to delete individually (more efficient than separate awaits)
        if (keys.length === 1) {
          await cache.del(keys[0]);
        } else {
          const pipeline = cache.pipeline();
          for (const key of keys) {
            pipeline.del(key);
          }
          await pipeline.exec();
        }
        const duration = Date.now() - startTime;

        // Log cache operation with metrics (use first key as representative)
        logger.cacheOperation("delete", keys[0], undefined, duration, undefined, keys.length);
      } catch (error) {
        span.setStatus({ code: 2, message: "error" }); // SPAN_STATUS_ERROR
        logger.cacheError(
          "delete",
          keys.join(", "),
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  );
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const cache = getCacheClient();
  if (!cache) return;

  try {
    const keys: string[] = [];

    // In cluster mode, we need to scan all master nodes
    const nodes = cache.nodes("master");

    for (const node of nodes) {
      let cursor = "0";
      do {
        // Scan each master node individually
        const result = await node.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== "0");
    }

    if (keys.length > 0) {
      // Delete in batches using pipeline (cluster mode compatible)
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const pipeline = cache.pipeline();
        for (const key of batch) {
          pipeline.del(key);
        }
        await pipeline.exec();
      }

      logger.info(`Deleted cache keys matching pattern`, {
        pattern,
        keyCount: keys.length,
        nodeCount: nodes.length,
      });
    }
  } catch (error) {
    logger.cacheError(
      "pattern delete",
      pattern,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Recursively get all ancestor folder IDs for a given folder
 * @param folderId - The folder ID to start from
 * @returns Array of ancestor folder IDs (from immediate parent to root)
 */
async function getAncestorFolderIds(folderId: string): Promise<string[]> {
  const ancestorIds: string[] = [];
  let currentFolderId: string | null = folderId;

  // Traverse up the hierarchy until we reach a root folder (parentId is null)
  while (currentFolderId) {
    const folder: { parentId: string | null } | undefined = await db.query.folders.findFirst({
      where: eq(folders.id, currentFolderId),
      columns: {
        parentId: true,
      },
    });

    if (!folder || !folder.parentId) {
      break;
    }

    ancestorIds.push(folder.parentId);
    currentFolderId = folder.parentId;
  }

  return ancestorIds;
}

/**
 * Invalidate note counts cache for a user and all ancestor folders
 * This should be called whenever notes are created, updated, deleted, or their properties change
 * @param userId - The user ID
 * @param folderId - The folder ID where the note resides (null for root level notes)
 */
export async function invalidateNoteCounts(userId: string, folderId: string | null): Promise<void> {
  const cache = getCacheClient();
  if (!cache) return;

  try {
    const cacheKeys: string[] = [];

    // Always invalidate user's global counts (matches CacheKeys.notesCounts pattern)
    cacheKeys.push(`notes:${userId}:counts`);

    // If note is in a folder, invalidate that folder and all ancestors
    if (folderId) {
      // Invalidate the immediate folder (matches counts.ts line 89 pattern)
      cacheKeys.push(`notes:${userId}:folder:${folderId}:counts`);

      // Get and invalidate all ancestor folders
      const ancestorIds = await getAncestorFolderIds(folderId);
      for (const ancestorId of ancestorIds) {
        cacheKeys.push(`notes:${userId}:folder:${ancestorId}:counts`);
      }
    }

    // Delete all cache keys using pipeline for cluster compatibility
    if (cacheKeys.length > 0) {
      await deleteCache(...cacheKeys);
      logger.debug("Invalidated note counts cache", {
        userId,
        folderId: folderId || "root",
        keysInvalidated: cacheKeys.length,
      });
    }
  } catch (error) {
    logger.error(
      "Failed to invalidate note counts cache",
      {
        userId,
        folderId: folderId || "root",
      },
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Invalidate note counts cache when a note moves between folders
 * Invalidates both old and new folder hierarchies
 * @param userId - The user ID
 * @param oldFolderId - The previous folder ID (null for root)
 * @param newFolderId - The new folder ID (null for root)
 */
export async function invalidateNoteCountsForMove(
  userId: string,
  oldFolderId: string | null,
  newFolderId: string | null
): Promise<void> {
  // Invalidate old folder hierarchy
  await invalidateNoteCounts(userId, oldFolderId);

  // Invalidate new folder hierarchy (if different from old)
  if (oldFolderId !== newFolderId) {
    await invalidateNoteCounts(userId, newFolderId);
  }
}
