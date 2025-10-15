import { Cluster, ClusterOptions } from "ioredis";
import { logger } from "./logger";

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

  const startTime = Date.now();
  try {
    const data = await cache.get(key);
    const duration = Date.now() - startTime;
    const hit = data !== null;

    // Log cache operation with metrics
    logger.cacheOperation("get", key, hit, duration);

    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.cacheError("get", key, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const cache = getCacheClient();
  if (!cache) return;

  const startTime = Date.now();
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await cache.setex(key, ttlSeconds, serialized);
    } else {
      await cache.set(key, serialized);
    }
    const duration = Date.now() - startTime;

    // Log cache operation with metrics
    logger.cacheOperation("set", key, undefined, duration, ttlSeconds);
  } catch (error) {
    logger.cacheError("set", key, error instanceof Error ? error : new Error(String(error)));
  }
}

export async function deleteCache(...keys: string[]): Promise<void> {
  const cache = getCacheClient();
  if (!cache || keys.length === 0) return;

  const startTime = Date.now();
  try {
    await cache.del(...keys);
    const duration = Date.now() - startTime;

    // Log cache operation with metrics (use first key as representative)
    logger.cacheOperation("delete", keys[0], undefined, duration, undefined, keys.length);
  } catch (error) {
    logger.cacheError(
      "delete",
      keys.join(", "),
      error instanceof Error ? error : new Error(String(error))
    );
  }
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
      // Delete in batches to avoid overwhelming the cluster
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await cache.del(...batch);
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
