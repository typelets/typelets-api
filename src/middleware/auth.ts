import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "@clerk/backend";
import { db, users, folders, type User } from "../db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import type { ClerkUserData, ClerkJWTPayload, UserUpdateData, DatabaseError } from "../types";

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
  const startTime = Date.now();
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    const verifyStart = Date.now();
    const payload = (await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })) as unknown as ClerkJWTPayload;
    console.log(`[AUTH PERF] verifyToken took: ${Date.now() - verifyStart}ms`);

    // Security is maintained by JWT verification above
    // User metadata comes from our DB (updated via webhooks or on login)
    // No need to call Clerk API on every request - saves 150-200ms
    console.log(`[AUTH PERF] Total extractAndVerify took: ${Date.now() - startTime}ms`);
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
  const middlewareStart = Date.now();
  const userData = await extractAndVerifyClerkToken(c);

  if (!userData) {
    throw new HTTPException(401, {
      message: "Authentication required",
    });
  }

  const dbQueryStart = Date.now();
  let existingUser = await db.query.users.findFirst({
    where: eq(users.id, userData.id),
  });
  console.log(`[AUTH PERF] DB user lookup took: ${Date.now() - dbQueryStart}ms`);

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
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          id: userData.id,
          email: userData.email || "",
          firstName: userData.firstName,
          lastName: userData.lastName,
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

      existingUser = newUser;
    } catch (error: unknown) {
      const dbError = error as DatabaseError;
      if (
        dbError.code === "23505" &&
        (dbError.constraint_name === "users_pkey" || dbError.detail?.includes("already exists"))
      ) {
        existingUser = await db.query.users.findFirst({
          where: eq(users.id, userData.id),
        });

        if (!existingUser) {
          throw new HTTPException(500, {
            message: "Failed to create or find user profile",
          });
        }
      } else {
        logger.error(
          "[DB] Error creating user",
          {
            userId: userData.id,
            error: error instanceof Error ? error.message : String(error),
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

  console.log(`[AUTH PERF] Total auth middleware took: ${Date.now() - middlewareStart}ms`);

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
