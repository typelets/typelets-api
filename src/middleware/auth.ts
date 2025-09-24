import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "@clerk/backend";
import { db, users, folders, type User } from "../db";
import { eq } from "drizzle-orm";
import type {
  ClerkUserData,
  ClerkJWTPayload,
  UserUpdateData,
  ClerkApiUser,
  DatabaseError,
} from "../types";

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error(
    "Missing Clerk Secret Key - Please add CLERK_SECRET_KEY to your environment variables",
  );
}

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    user: User;
    clerkUser: ClerkUserData;
  }
}

const extractAndVerifyClerkToken = async (
  c: Context,
): Promise<ClerkUserData | null> => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = (await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })) as unknown as ClerkJWTPayload;

    try {
      const userResponse = await fetch(
        `https://api.clerk.com/v1/users/${payload.sub}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (userResponse.ok) {
        const clerkUser: ClerkApiUser = await userResponse.json();
        const userData: ClerkUserData = {
          id: clerkUser.id,
          email: clerkUser.email_addresses?.[0]?.email_address || "",
          firstName: clerkUser.first_name || null,
          lastName: clerkUser.last_name || null,
        };
        return userData;
      } else {
        return {
          id: payload.sub,
          email: "",
          firstName: null,
          lastName: null,
        };
      }
    } catch {
      return {
        id: payload.sub,
        email: "",
        firstName: null,
        lastName: null,
      };
    }
  } catch {
    return null;
  }
};

export const authMiddleware = async (c: Context, next: Next) => {
  const userData = await extractAndVerifyClerkToken(c);

  if (!userData) {
    throw new HTTPException(401, {
      message: "Authentication required",
    });
  }

  let existingUser = await db.query.users.findFirst({
    where: eq(users.id, userData.id),
  });

  if (existingUser) {
    try {
      const updateData: UserUpdateData = {};
      if (userData.email) updateData.email = userData.email;
      if (userData.firstName !== undefined)
        updateData.firstName = userData.firstName;
      if (userData.lastName !== undefined)
        updateData.lastName = userData.lastName;

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
        })),
      );

      existingUser = newUser;
    } catch (error: unknown) {
      const dbError = error as DatabaseError;
      if (
        dbError.code === "23505" &&
        (dbError.constraint_name === "users_pkey" ||
          dbError.detail?.includes("already exists"))
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
        console.error("Database error creating user:", error);
        throw new HTTPException(500, {
          message: "Failed to create user profile",
        });
      }
    }
  }

  c.set("userId", userData.id);
  c.set("user", existingUser);
  c.set("clerkUser", userData);

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
