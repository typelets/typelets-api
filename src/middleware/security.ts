import { Context, Next } from "hono";

export const securityHeaders = async (c: Context, next: Next): Promise<void> => {
  await next();

  // Relax CSP for /docs endpoint (Swagger UI)
  const isDocsEndpoint = c.req.path === "/docs";

  // Content Security Policy
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      (isDocsEndpoint
        ? "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        : "script-src 'self'; " + "style-src 'self' 'unsafe-inline'; ") +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "media-src 'self'; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'; " +
      "frame-ancestors 'none'; " +
      "upgrade-insecure-requests"
  );

  // Security headers
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Remove server identification
  c.res.headers.delete("Server");
  c.res.headers.delete("X-Powered-By");
};
