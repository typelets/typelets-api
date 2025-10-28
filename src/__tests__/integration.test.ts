/**
 * Integration tests - demonstrates test infrastructure usage
 * These tests use real database operations with Drizzle migrations
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "../db";
import { users, folders, notes } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  createTestUser,
  createTestFolder,
  createTestNote,
  createTestSetup,
} from "./helpers/factories";
import { cleanupDatabase, tableExists, countRows } from "./helpers/testDb";

describe("Test Infrastructure Integration", () => {
  beforeEach(async () => {
    // Clean database before each test for isolation
    await cleanupDatabase();
  });

  describe("Database Schema", () => {
    it("should have all tables created by migrations", async () => {
      expect(await tableExists("users")).toBe(true);
      expect(await tableExists("folders")).toBe(true);
      expect(await tableExists("notes")).toBe(true);
      expect(await tableExists("file_attachments")).toBe(true);
    });
  });

  describe("Test Factories", () => {
    it("should create a test user", async () => {
      const user = await createTestUser();

      expect(user).toBeDefined();
      expect(user.id).toContain("user_");
      expect(user.email).toContain("@example.com");
      expect(user.firstName).toBe("Test");
      expect(user.lastName).toBe("User");
    });

    it("should create a test user with overrides", async () => {
      const user = await createTestUser({
        email: "custom@test.com",
        firstName: "Custom",
      });

      expect(user.email).toBe("custom@test.com");
      expect(user.firstName).toBe("Custom");
    });

    it("should create a test folder for a user", async () => {
      const user = await createTestUser();
      const folder = await createTestFolder(user.id);

      expect(folder).toBeDefined();
      expect(folder.userId).toBe(user.id);
      expect(folder.name).toContain("Test Folder");
      expect(folder.color).toBe("#6b7280");
    });

    it("should create a test note", async () => {
      const user = await createTestUser();
      const folder = await createTestFolder(user.id);
      const note = await createTestNote(user.id, folder.id);

      expect(note).toBeDefined();
      expect(note.userId).toBe(user.id);
      expect(note.folderId).toBe(folder.id);
      expect(note.title).toContain("Test Note");
    });

    it("should create complete test setup", async () => {
      const { user, folder, note } = await createTestSetup();

      expect(user).toBeDefined();
      expect(folder.userId).toBe(user.id);
      expect(note.userId).toBe(user.id);
      expect(note.folderId).toBe(folder.id);
    });
  });

  describe("Database Operations", () => {
    it("should insert and query a user", async () => {
      const user = await createTestUser({ email: "query@test.com" });

      const queriedUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });

      expect(queriedUser).toBeDefined();
      expect(queriedUser?.email).toBe("query@test.com");
    });

    it("should query user with folders relation", async () => {
      const user = await createTestUser();
      await createTestFolder(user.id, { name: "Folder 1" });
      await createTestFolder(user.id, { name: "Folder 2" });

      const userWithFolders = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        with: { folders: true },
      });

      expect(userWithFolders?.folders).toHaveLength(2);
      expect(userWithFolders?.folders[0].name).toContain("Folder");
    });

    it("should query folder with notes relation", async () => {
      const user = await createTestUser();
      const folder = await createTestFolder(user.id);
      await createTestNote(user.id, folder.id, { title: "Note 1" });
      await createTestNote(user.id, folder.id, { title: "Note 2" });

      const folderWithNotes = await db.query.folders.findFirst({
        where: eq(folders.id, folder.id),
        with: { notes: true },
      });

      expect(folderWithNotes?.notes).toHaveLength(2);
    });

    it("should cascade delete folders when user is deleted", async () => {
      const user = await createTestUser();
      await createTestFolder(user.id);
      await createTestFolder(user.id);

      // Verify folders exist
      expect(await countRows("folders")).toBe(2);

      // Delete user (should cascade to folders)
      await db.delete(users).where(eq(users.id, user.id));

      // Verify folders were deleted
      expect(await countRows("folders")).toBe(0);
    });

    it("should set folderId to null when folder is deleted", async () => {
      const user = await createTestUser();
      const folder = await createTestFolder(user.id);
      const note = await createTestNote(user.id, folder.id);

      // Delete folder
      await db.delete(folders).where(eq(folders.id, folder.id));

      // Verify note still exists but folderId is null
      const updatedNote = await db.query.notes.findFirst({
        where: eq(notes.id, note.id),
      });

      expect(updatedNote).toBeDefined();
      expect(updatedNote?.folderId).toBeNull();
    });
  });

  describe("Database Cleanup", () => {
    it("should clean all data between tests", async () => {
      // Create data
      await createTestSetup();
      expect(await countRows("users")).toBeGreaterThan(0);

      // Clean
      await cleanupDatabase();

      // Verify clean
      expect(await countRows("users")).toBe(0);
      expect(await countRows("folders")).toBe(0);
      expect(await countRows("notes")).toBe(0);
    });
  });
});
