/**
 * Cloudflare CDN Cache Utilities
 * Handles cache purging for public content via Cloudflare API
 */

import { logger } from "./logger";

interface CloudflarePurgeResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: { id: string } | null;
}

/**
 * Check if Cloudflare cache purging is configured
 */
function isCloudflareConfigured(): boolean {
  return !!(
    process.env.CLOUDFLARE_ZONE_ID &&
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.API_URL
  );
}

/**
 * Purge specific URLs from Cloudflare CDN cache
 * @param urls - Array of full URLs to purge
 * @returns true if purge was successful (or Cloudflare not configured)
 */
export async function purgeCloudflareCache(urls: string[]): Promise<boolean> {
  if (!isCloudflareConfigured()) {
    logger.debug("[CLOUDFLARE] Cache purge skipped - not configured", {
      urlCount: urls.length,
    });
    return true; // Not an error, just not configured
  }

  if (urls.length === 0) {
    return true;
  }

  const zoneId = process.env.CLOUDFLARE_ZONE_ID!;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN!;

  try {
    const startTime = Date.now();

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    const duration = Date.now() - startTime;
    const data: CloudflarePurgeResponse = await response.json();

    if (data.success) {
      logger.info("[CLOUDFLARE] Cache purged successfully", {
        type: "cloudflare_cache_event",
        event_type: "cache_purged",
        urls: urls.join(", "),
        urlCount: urls.length,
        duration,
      });
      return true;
    } else {
      logger.error("[CLOUDFLARE] Cache purge failed", {
        type: "cloudflare_cache_event",
        event_type: "cache_purge_failed",
        urls: urls.join(", "),
        errors: JSON.stringify(data.errors),
        duration,
      });
      return false;
    }
  } catch (error) {
    logger.error(
      "[CLOUDFLARE] Cache purge request failed",
      {
        type: "cloudflare_cache_event",
        event_type: "cache_purge_error",
        urls: urls.join(", "),
      },
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}

/**
 * Purge a public note from Cloudflare CDN cache
 * @param slug - The public note slug
 */
export async function purgePublicNoteCache(slug: string): Promise<boolean> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    logger.debug("[CLOUDFLARE] API_URL not configured, skipping cache purge");
    return true;
  }

  // Purge both the API endpoint and any potential frontend route
  const urls = [
    `${apiUrl}/api/public-notes/${slug}`,
    `${apiUrl}/p/${slug}`, // Frontend route if exists
  ];

  return purgeCloudflareCache(urls);
}

/**
 * Get Cache-Control header value for public notes
 * Uses stale-while-revalidate for better UX
 */
export function getPublicNoteCacheHeaders(): Record<string, string> {
  // Cache for 24 hours, allow stale content for 1 hour while revalidating
  // Long TTL is fine since we purge cache on update/unpublish
  return {
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    // Vary on Accept-Encoding for proper compression handling
    Vary: "Accept-Encoding",
  };
}
