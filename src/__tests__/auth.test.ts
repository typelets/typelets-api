/**
 * Auth middleware tests
 * Tests Clerk integration and user creation flow
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { cleanupDatabase } from "./helpers/testDb";

// Mock Clerk SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetUser = jest.fn<any, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockVerifyToken = jest.fn<any, any>();

jest.mock("@clerk/backend", () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  createClerkClient: () => ({
    users: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

// Import after mocking
import { authMiddleware } from "../middleware/auth";
import { Hono } from "hono";

describe("Auth Middleware", () => {
  beforeEach(async () => {
    await cleanupDatabase();
    jest.clearAllMocks();
  });

  describe("clerkClient usage", () => {
    it("should call clerkClient.users.getUser (not clerkClient().users.getUser) for new users", async () => {
      const testUserId = "user_test_clerk_client";
      const testEmail = "newuser@example.com";

      // Mock successful token verification
      mockVerifyToken.mockResolvedValue({
        sub: testUserId,
      });

      // Mock Clerk API response for new user
      mockGetUser.mockResolvedValue({
        id: testUserId,
        emailAddresses: [
          {
            id: "email_1",
            emailAddress: testEmail,
          },
        ],
        primaryEmailAddressId: "email_1",
        firstName: "New",
        lastName: "User",
      });

      // Create test app with auth middleware
      const app = new Hono();
      app.use("*", authMiddleware);
      app.get("/test", (c) => c.json({ userId: c.get("userId") }));

      // Make request (user doesn't exist in DB yet)
      const response = await app.request("/test", {
        headers: {
          Authorization: "Bearer test-token",
        },
      });

      // Should succeed
      expect(response.status).toBe(200);

      // Verify clerkClient.users.getUser was called (not clerkClient().users.getUser)
      expect(mockGetUser).toHaveBeenCalledWith(testUserId);
      expect(mockGetUser).toHaveBeenCalledTimes(1);

      // Verify user was created in DB
      const createdUser = await db.query.users.findFirst({
        where: eq(users.id, testUserId),
      });

      expect(createdUser).toBeDefined();
      expect(createdUser?.email).toBe(testEmail);
      expect(createdUser?.firstName).toBe("New");
      expect(createdUser?.lastName).toBe("User");
    });

    it("should create default folders for new users", async () => {
      const testUserId = "user_test_folders";

      mockVerifyToken.mockResolvedValue({ sub: testUserId });
      mockGetUser.mockResolvedValue({
        id: testUserId,
        emailAddresses: [{ id: "email_1", emailAddress: "folders@example.com" }],
        primaryEmailAddressId: "email_1",
        firstName: "Test",
        lastName: "User",
      });

      const app = new Hono();
      app.use("*", authMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));

      await app.request("/test", {
        headers: { Authorization: "Bearer test-token" },
      });

      // Check default folders were created
      const userFolders = await db.query.folders.findMany({
        where: eq(users.id, testUserId),
      });

      // Should have 3 default folders: Personal, Work, Projects
      expect(userFolders.length).toBeGreaterThanOrEqual(3);
    });

    it("should not call clerkClient for existing users", async () => {
      const testUserId = "user_existing";

      // Create user in DB first
      await db.insert(users).values({
        id: testUserId,
        email: "existing@example.com",
        firstName: "Existing",
        lastName: "User",
      });

      mockVerifyToken.mockResolvedValue({ sub: testUserId });

      const app = new Hono();
      app.use("*", authMiddleware);
      app.get("/test", (c) => c.json({ userId: c.get("userId") }));

      const response = await app.request("/test", {
        headers: { Authorization: "Bearer test-token" },
      });

      expect(response.status).toBe(200);

      // Should NOT call Clerk API for existing users
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("should return 401 for invalid token", async () => {
      mockVerifyToken.mockRejectedValue(new Error("Invalid token"));

      const app = new Hono();
      app.use("*", authMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));

      const response = await app.request("/test", {
        headers: { Authorization: "Bearer invalid-token" },
      });

      expect(response.status).toBe(401);
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("should return 401 for missing token", async () => {
      const app = new Hono();
      app.use("*", authMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));

      const response = await app.request("/test");

      expect(response.status).toBe(401);
      expect(mockVerifyToken).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });
});
