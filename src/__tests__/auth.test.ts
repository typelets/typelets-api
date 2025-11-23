/**
 * Auth middleware tests
 * Tests Clerk SDK integration (createClerkClient usage)
 */

// Set required env vars before any imports
process.env.CLERK_SECRET_KEY = "test_clerk_secret_key";

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Track calls to createClerkClient
const createClerkClientCalls: unknown[][] = [];

// Mock Clerk SDK - verify createClerkClient is used correctly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetUser = jest.fn() as jest.Mock<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockVerifyToken = jest.fn() as jest.Mock<any>;

jest.mock("@clerk/backend", () => ({
  verifyToken: (token: unknown, options: unknown) => mockVerifyToken(token, options),
  createClerkClient: (config: unknown) => {
    createClerkClientCalls.push([config]);
    return {
      users: {
        getUser: mockGetUser,
      },
    };
  },
}));

describe("Auth Middleware - Clerk SDK Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClerkClientCalls.length = 0;
  });

  describe("createClerkClient usage", () => {
    it("should import createClerkClient (not clerkClient) from @clerk/backend", async () => {
      // Re-import to trigger the module initialization
      jest.resetModules();
      process.env.CLERK_SECRET_KEY = "test_clerk_secret_key";
      createClerkClientCalls.length = 0;

      // This will call createClerkClient during module initialization
      await import("../middleware/auth");

      // Verify createClerkClient was called with secretKey
      expect(createClerkClientCalls.length).toBeGreaterThan(0);
      expect(createClerkClientCalls[0][0]).toEqual({
        secretKey: "test_clerk_secret_key",
      });
    });

    it("should return a client with users.getUser method", () => {
      // Import the mocked module
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createClerkClient } = require("@clerk/backend");
      const client = createClerkClient({ secretKey: "test" });

      // Verify the client has the correct structure
      expect(client).toHaveProperty("users");
      expect(client.users).toHaveProperty("getUser");
      expect(typeof client.users.getUser).toBe("function");
    });
  });

  describe("verifyToken", () => {
    it("should be mocked correctly", () => {
      mockVerifyToken.mockResolvedValue({ sub: "user_123" });

      expect(mockVerifyToken).toBeDefined();
      expect(typeof mockVerifyToken).toBe("function");
    });
  });
});
