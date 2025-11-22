import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyToken, clerkClient } from "@clerk/backend";
import { db, users, folders, type User } from "../db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { ClerkUserData, ClerkJWTPayload, UserUpdateData, DatabaseError } from "../types";

/**
 * Extract client IP from request headers (supports proxies like Cloudflare, ALB)
 */
const getClientIp = (c: Context): string => {
  // Check headers in order of priority
  const xForwardedFor = c.req.header("x-forwarded-for");
  if (xForwardedFor) {
    // First IP in the list is the original client
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = c.req.header("x-real-ip");
  if (xRealIp) return xRealIp;

  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  // Fallback to socket remote address
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socket = (c.req.raw as any).socket;
  return socket?.remoteAddress || "unknown";
};

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error(
    "Missing Clerk Secret Key - Please add CLERK_SECRET_KEY to your environment variables"
  );
}

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    user: User;
    clerkUser: ClerkUserData;
  }
}

const extractAndVerifyClerkToken = async (c: Context): Promise<ClerkUserData | null> => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = (await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })) as unknown as ClerkJWTPayload;

    // Security is maintained by JWT verification above
    // User metadata comes from our DB (updated via webhooks or on login)
    // No need to call Clerk API on every request - saves 150-200ms
    return {
      id: payload.sub,
      email: "", // Will be populated from DB
      firstName: null, // Will be populated from DB
      lastName: null, // Will be populated from DB
    };
  } catch {
    return null;
  }
};

export const authMiddleware = async (c: Context, next: Next) => {
  const clientIp = getClientIp(c);
  const userData = await extractAndVerifyClerkToken(c);

  if (!userData) {
    logger.warn("[AUTH] Authentication failed", {
      type: "auth_event",
      event_type: "auth_failure",
      reason: "Invalid or missing token",
      path: new URL(c.req.url).pathname,
      "http.client_ip": clientIp,
    });
    throw new HTTPException(401, {
      message: "Authentication required",
    });
  }

  // Look up user in database with proper error handling
  let existingUser: User | undefined;
  try {
    existingUser = await db.query.users.findFirst({
      where: eq(users.id, userData.id),
    });
  } catch (error) {
    logger.error(
      "[AUTH] Database error during user lookup",
      {
        userId: userData.id,
        error: error instanceof Error ? error.message : String(error),
        type: "database_error",
        event_type: "database_error",
        "http.client_ip": clientIp,
      },
      error instanceof Error ? error : undefined
    );
    throw new HTTPException(503, {
      message: "Database temporarily unavailable. Please try again.",
    });
  }

  if (existingUser) {
    try {
      const updateData: UserUpdateData = {};
      if (userData.email) updateData.email = userData.email;
      if (userData.firstName !== undefined) updateData.firstName = userData.firstName;
      if (userData.lastName !== undefined) updateData.lastName = userData.lastName;

      if (Object.keys(updateData).length > 0) {
        const [updatedUser] = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userData.id))
          .returning();

        existingUser = updatedUser;
      }
    } catch {
      // Silently ignore update errors - user will still be authenticated with existing data
    }
  } else {
    // User doesn't exist, fetch details from Clerk and create
    try {
      logger.info("[AUTH] New user - fetching details from Clerk", {
        userId: userData.id,
        type: "auth_event",
        "http.client_ip": clientIp,
      });

      // Fetch user details from Clerk API
      const clerkUser = await clerkClient().users.getUser(userData.id);

      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        "";

      // Email is required - if we don't have it, we can't create the user
      if (!email) {
        logger.error("[AUTH] Cannot create user - no email found in Clerk", {
          userId: userData.id,
          type: "auth_error",
          "http.client_ip": clientIp,
        });
        throw new HTTPException(500, {
          message: "User profile incomplete - email required",
        });
      }

      const [newUser] = await db
        .insert(users)
        .values({
          id: userData.id,
          email: email,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
        })
        .returning();

      const defaultFolders = [
        { name: "Personal", color: "#3b82f6", isDefault: true },
        { name: "Work", color: "#10b981", isDefault: false },
        { name: "Projects", color: "#f59e0b", isDefault: false },
      ];

      await db.insert(folders).values(
        defaultFolders.map((folder) => ({
          ...folder,
          userId: newUser.id,
        }))
      );

      logger.info("[AUTH] New user created successfully", {
        userId: newUser.id,
        email: newUser.email,
        type: "auth_event",
        event_type: "user_created",
        "http.client_ip": clientIp,
      });

      existingUser = newUser;
    } catch (error: unknown) {
      // Check if this is a Clerk API error
      if (error instanceof Error && error.message.includes("Resource not found")) {
        logger.error("[AUTH] User not found in Clerk", {
          userId: userData.id,
          type: "auth_error",
          "http.client_ip": clientIp,
        });
        throw new HTTPException(401, {
          message: "User account not found",
        });
      }

      const dbError = error as DatabaseError;
      if (
        dbError.code === "23505" &&
        (dbError.constraint_name === "users_pkey" || dbError.detail?.includes("already exists"))
      ) {
        // Race condition: another request created this user. Try to fetch again.
        try {
          existingUser = await db.query.users.findFirst({
            where: eq(users.id, userData.id),
          });

          if (!existingUser) {
            logger.error("[AUTH] User not found after race condition", {
              userId: userData.id,
              type: "database_error",
              "http.client_ip": clientIp,
            });
            throw new HTTPException(500, {
              message: "Failed to create or find user profile",
            });
          }
        } catch (lookupError) {
          logger.error(
            "[AUTH] Database error during user lookup after race condition",
            {
              userId: userData.id,
              error: lookupError instanceof Error ? lookupError.message : String(lookupError),
              type: "database_error",
              "http.client_ip": clientIp,
            },
            lookupError instanceof Error ? lookupError : undefined
          );
          throw new HTTPException(503, {
            message: "Database temporarily unavailable. Please try again.",
          });
        }
      } else {
        logger.error(
          "[AUTH] Error creating user",
          {
            userId: userData.id,
            error: error instanceof Error ? error.message : String(error),
            "http.client_ip": clientIp,
          },
          error instanceof Error ? error : undefined
        );
        throw new HTTPException(500, {
          message: "Failed to create user profile",
        });
      }
    }
  }

  c.set("userId", userData.id);
  c.set("user", existingUser);
  c.set("clerkUser", userData);

  // Log successful authentication for security monitoring
  logger.info("[AUTH] Authentication successful", {
    type: "auth_event",
    event_type: "auth_success",
    "user.id": userData.id,
    "user.email": existingUser.email,
    "http.client_ip": clientIp,
  });

  // User context available in Hono context

  await next();
};

export const getCurrentUser = (c: Context): User => {
  const user = c.get("user");
  if (!user) {
    throw new HTTPException(401, { message: "No user in context" });
  }
  return user;
};
