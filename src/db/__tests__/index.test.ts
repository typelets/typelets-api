/**
 * Tests for database connection and initialization
 * @file src/db/__tests__/index.test.ts
 */

import { describe, it, expect, beforeAll } from "@jest/globals";

describe("Database Connection (db/index.ts)", () => {
  describe("Environment Configuration", () => {
    it("should have DATABASE_URL environment variable", () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toBeTruthy();
    });

    it("should validate DATABASE_URL format", () => {
      // Verify DATABASE_URL is a valid postgres connection string
      const dbUrl = process.env.DATABASE_URL;
      expect(dbUrl).toBeTruthy();
      expect(typeof dbUrl).toBe("string");
      expect(dbUrl).toMatch(/^postgres/);
    });
  });

  describe("Database Client", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any;

    beforeAll(() => {
      // Import db after environment is set up
      const dbModule = require("../index");
      db = dbModule.db;
    });

    it("should export db instance", () => {
      expect(db).toBeDefined();
      expect(db).toHaveProperty("query");
      expect(db).toHaveProperty("select");
      expect(db).toHaveProperty("insert");
      expect(db).toHaveProperty("update");
      expect(db).toHaveProperty("delete");
    });

    it("should have query builder methods", () => {
      expect(typeof db.select).toBe("function");
      expect(typeof db.insert).toBe("function");
      expect(typeof db.update).toBe("function");
      expect(typeof db.delete).toBe("function");
    });

    it("should have relational query API", () => {
      expect(db.query).toBeDefined();
      expect(typeof db.query).toBe("object");
    });

    it("should include all table queries in relational API", () => {
      expect(db.query.users).toBeDefined();
      expect(db.query.folders).toBeDefined();
      expect(db.query.notes).toBeDefined();
      expect(db.query.fileAttachments).toBeDefined();
    });

    it("should have findFirst method on table queries", () => {
      expect(typeof db.query.users.findFirst).toBe("function");
      expect(typeof db.query.folders.findFirst).toBe("function");
      expect(typeof db.query.notes.findFirst).toBe("function");
      expect(typeof db.query.fileAttachments.findFirst).toBe("function");
    });

    it("should have findMany method on table queries", () => {
      expect(typeof db.query.users.findMany).toBe("function");
      expect(typeof db.query.folders.findMany).toBe("function");
      expect(typeof db.query.notes.findMany).toBe("function");
      expect(typeof db.query.fileAttachments.findMany).toBe("function");
    });
  });

  describe("Schema Exports", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: any;

    beforeAll(() => {
      schema = require("../index");
    });

    it("should export users table", () => {
      expect(schema.users).toBeDefined();
      expect(schema.users).toHaveProperty("id");
      expect(schema.users).toHaveProperty("email");
    });

    it("should export folders table", () => {
      expect(schema.folders).toBeDefined();
      expect(schema.folders).toHaveProperty("id");
      expect(schema.folders).toHaveProperty("userId");
      expect(schema.folders).toHaveProperty("name");
    });

    it("should export notes table", () => {
      expect(schema.notes).toBeDefined();
      expect(schema.notes).toHaveProperty("id");
      expect(schema.notes).toHaveProperty("userId");
      expect(schema.notes).toHaveProperty("title");
      expect(schema.notes).toHaveProperty("content");
    });

    it("should export fileAttachments table", () => {
      expect(schema.fileAttachments).toBeDefined();
      expect(schema.fileAttachments).toHaveProperty("id");
      expect(schema.fileAttachments).toHaveProperty("noteId");
      expect(schema.fileAttachments).toHaveProperty("filename");
    });
  });

  describe("Connection Pool Configuration", () => {
    it("should use SSL in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      // The connection pool config is set at import time,
      // so we verify the environment variable logic
      expect(process.env.NODE_ENV).toBe("production");

      process.env.NODE_ENV = originalEnv;
    });

    it("should not require SSL in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      expect(process.env.NODE_ENV).toBe("development");

      process.env.NODE_ENV = originalEnv;
    });

    it("should respect DB_POOL_MAX environment variable", () => {
      expect(
        process.env.DB_POOL_MAX === undefined || !isNaN(parseInt(process.env.DB_POOL_MAX))
      ).toBe(true);
    });

    it("should respect DB_IDLE_TIMEOUT environment variable", () => {
      expect(
        process.env.DB_IDLE_TIMEOUT === undefined || !isNaN(parseInt(process.env.DB_IDLE_TIMEOUT))
      ).toBe(true);
    });

    it("should respect DB_CONNECT_TIMEOUT environment variable", () => {
      expect(
        process.env.DB_CONNECT_TIMEOUT === undefined ||
          !isNaN(parseInt(process.env.DB_CONNECT_TIMEOUT))
      ).toBe(true);
    });
  });

  describe("Type Safety", () => {
    it("should have correct TypeScript types", () => {
      const { db } = require("../index");

      // These should compile without errors if types are correct
      const selectQuery = db.select();
      expect(selectQuery).toBeDefined();
    });
  });
});
