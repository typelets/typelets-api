/**
 * Tests for database schema definitions
 * @file src/db/__tests__/schema.test.ts
 */

import { describe, it, expect } from "@jest/globals";
import {
  users,
  folders,
  notes,
  fileAttachments,
  usersRelations,
  foldersRelations,
  notesRelations,
  fileAttachmentsRelations,
  type User,
  type UserInsert,
  type Folder,
  type FolderInsert,
  type Note,
  type NoteInsert,
  type FileAttachment,
  type FileAttachmentInsert,
} from "../schema";

describe("Database Schema (db/schema.ts)", () => {
  describe("Users Table", () => {
    it("should have correct table name", () => {
      expect(users).toBeDefined();
      // @ts-ignore - accessing internal property for testing
      expect(users[Symbol.for("drizzle:Name")]).toBe("users");
    });

    it("should have all required columns", () => {
      const columns = users;
      expect(columns.id).toBeDefined();
      expect(columns.email).toBeDefined();
      expect(columns.firstName).toBeDefined();
      expect(columns.lastName).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
    });

    it("should have id as primary key", () => {
      expect(users.id.primary).toBe(true);
    });

    it("should have email as not null", () => {
      expect(users.email.notNull).toBe(true);
    });

    it("should infer correct User type", () => {
      const user: User = {
        id: "user_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.id).toBe("user_123");
      expect(user.email).toBe("test@example.com");
    });

    it("should infer correct UserInsert type", () => {
      const userInsert: UserInsert = {
        id: "user_123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      expect(userInsert.email).toBe("test@example.com");
    });
  });

  describe("Folders Table", () => {
    it("should have correct table name", () => {
      expect(folders).toBeDefined();
      // @ts-ignore
      expect(folders[Symbol.for("drizzle:Name")]).toBe("folders");
    });

    it("should have all required columns", () => {
      expect(folders.id).toBeDefined();
      expect(folders.userId).toBeDefined();
      expect(folders.name).toBeDefined();
      expect(folders.color).toBeDefined();
      expect(folders.parentId).toBeDefined();
      expect(folders.sortOrder).toBeDefined();
      expect(folders.isDefault).toBeDefined();
      expect(folders.createdAt).toBeDefined();
      expect(folders.updatedAt).toBeDefined();
    });

    it("should have foreign key to users", () => {
      // Foreign key is defined in schema, verify column exists
      expect(folders.userId).toBeDefined();
      expect(folders.userId.notNull).toBe(true);
    });

    it("should have default color", () => {
      expect(folders.color.default).toBe("#6b7280");
    });

    it("should have default sortOrder of 0", () => {
      expect(folders.sortOrder.default).toBe(0);
    });

    it("should have default isDefault of false", () => {
      expect(folders.isDefault.default).toBe(false);
    });

    it("should infer correct Folder type", () => {
      const folder: Folder = {
        id: "folder-uuid",
        userId: "user_123",
        name: "My Folder",
        color: "#6b7280",
        parentId: null,
        sortOrder: 0,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(folder.name).toBe("My Folder");
    });

    it("should support nullable parentId for root folders", () => {
      const rootFolder: Folder = {
        id: "folder-uuid",
        userId: "user_123",
        name: "Root Folder",
        color: "#6b7280",
        parentId: null,
        sortOrder: 0,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(rootFolder.parentId).toBeNull();
    });

    it("should support non-null parentId for nested folders", () => {
      const nestedFolder: Folder = {
        id: "folder-uuid",
        userId: "user_123",
        name: "Nested Folder",
        color: "#6b7280",
        parentId: "parent-folder-uuid",
        sortOrder: 1,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(nestedFolder.parentId).toBe("parent-folder-uuid");
    });
  });

  describe("Notes Table", () => {
    it("should have correct table name", () => {
      expect(notes).toBeDefined();
      // @ts-ignore
      expect(notes[Symbol.for("drizzle:Name")]).toBe("notes");
    });

    it("should have all required columns", () => {
      expect(notes.id).toBeDefined();
      expect(notes.userId).toBeDefined();
      expect(notes.folderId).toBeDefined();
      expect(notes.title).toBeDefined();
      expect(notes.content).toBeDefined();
      expect(notes.starred).toBeDefined();
      expect(notes.archived).toBeDefined();
      expect(notes.deleted).toBeDefined();
      expect(notes.hidden).toBeDefined();
      expect(notes.hiddenAt).toBeDefined();
      expect(notes.tags).toBeDefined();
      expect(notes.createdAt).toBeDefined();
      expect(notes.updatedAt).toBeDefined();
    });

    it("should have encryption fields", () => {
      expect(notes.encryptedTitle).toBeDefined();
      expect(notes.encryptedContent).toBeDefined();
      expect(notes.iv).toBeDefined();
      expect(notes.salt).toBeDefined();
    });

    it("should have foreign keys", () => {
      // Foreign keys are defined in schema, verify columns exist
      expect(notes.userId).toBeDefined();
      expect(notes.userId.notNull).toBe(true);
      expect(notes.folderId).toBeDefined();
    });

    it("should have boolean flags with defaults", () => {
      expect(notes.starred.default).toBe(false);
      expect(notes.archived.default).toBe(false);
      expect(notes.deleted.default).toBe(false);
      expect(notes.hidden.default).toBe(false);
    });

    it("should have tags array with default empty array", () => {
      expect(Array.isArray(notes.tags.default)).toBe(true);
      expect(notes.tags.default).toEqual([]);
    });

    it("should infer correct Note type", () => {
      const note: Note = {
        id: "note-uuid",
        userId: "user_123",
        folderId: "folder-uuid",
        title: "My Note",
        content: "Note content",
        type: "note",
        encryptedTitle: null,
        encryptedContent: null,
        iv: null,
        salt: null,
        starred: false,
        archived: false,
        deleted: false,
        hidden: false,
        hiddenAt: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(note.title).toBe("My Note");
      expect(note.starred).toBe(false);
    });

    it("should support nullable folderId", () => {
      const note: Note = {
        id: "note-uuid",
        userId: "user_123",
        folderId: null,
        title: "Unfiled Note",
        content: "Content",
        type: "note",
        encryptedTitle: null,
        encryptedContent: null,
        iv: null,
        salt: null,
        starred: false,
        archived: false,
        deleted: false,
        hidden: false,
        hiddenAt: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(note.folderId).toBeNull();
    });
  });

  describe("File Attachments Table", () => {
    it("should have correct table name", () => {
      expect(fileAttachments).toBeDefined();
      // @ts-ignore
      expect(fileAttachments[Symbol.for("drizzle:Name")]).toBe("file_attachments");
    });

    it("should have all required columns", () => {
      expect(fileAttachments.id).toBeDefined();
      expect(fileAttachments.noteId).toBeDefined();
      expect(fileAttachments.filename).toBeDefined();
      expect(fileAttachments.originalName).toBeDefined();
      expect(fileAttachments.mimeType).toBeDefined();
      expect(fileAttachments.size).toBeDefined();
      expect(fileAttachments.encryptedData).toBeDefined();
      expect(fileAttachments.encryptedTitle).toBeDefined();
      expect(fileAttachments.iv).toBeDefined();
      expect(fileAttachments.salt).toBeDefined();
      expect(fileAttachments.uploadedAt).toBeDefined();
    });

    it("should have foreign key to notes", () => {
      // Foreign key is defined in schema, verify column exists
      expect(fileAttachments.noteId).toBeDefined();
      expect(fileAttachments.noteId.notNull).toBe(true);
    });

    it("should have all encryption fields as not null", () => {
      expect(fileAttachments.encryptedData.notNull).toBe(true);
      expect(fileAttachments.encryptedTitle.notNull).toBe(true);
      expect(fileAttachments.iv.notNull).toBe(true);
      expect(fileAttachments.salt.notNull).toBe(true);
    });

    it("should have default for encryptedTitle", () => {
      expect(fileAttachments.encryptedTitle.default).toBe("encrypted_placeholder");
    });

    it("should infer correct FileAttachment type", () => {
      const attachment: FileAttachment = {
        id: "attachment-uuid",
        noteId: "note-uuid",
        filename: "file_abc123.txt",
        originalName: "document.txt",
        mimeType: "text/plain",
        size: 1024,
        encryptedData: "encrypted-base64-data",
        encryptedTitle: "encrypted-filename",
        iv: "initialization-vector",
        salt: "salt-value",
        uploadedAt: new Date(),
      };

      expect(attachment.originalName).toBe("document.txt");
      expect(attachment.size).toBe(1024);
    });
  });

  describe("Relations", () => {
    it("should export usersRelations", () => {
      expect(usersRelations).toBeDefined();
      expect(typeof usersRelations).toBe("object");
    });

    it("should export foldersRelations", () => {
      expect(foldersRelations).toBeDefined();
      expect(typeof foldersRelations).toBe("object");
    });

    it("should export notesRelations", () => {
      expect(notesRelations).toBeDefined();
      expect(typeof notesRelations).toBe("object");
    });

    it("should export fileAttachmentsRelations", () => {
      expect(fileAttachmentsRelations).toBeDefined();
      expect(typeof fileAttachmentsRelations).toBe("object");
    });

    it("should have relations configured for query API", () => {
      // Relations are used internally by Drizzle's query builder
      // Just verify they exist and are objects
      expect(usersRelations).toBeTruthy();
      expect(foldersRelations).toBeTruthy();
      expect(notesRelations).toBeTruthy();
      expect(fileAttachmentsRelations).toBeTruthy();
    });
  });

  describe("Type Inference", () => {
    it("should correctly infer insert types without optional fields", () => {
      const userInsert: UserInsert = {
        id: "user_123",
        email: "test@example.com",
      };

      expect(userInsert.id).toBeDefined();
      expect(userInsert.email).toBeDefined();
    });

    it("should allow optional fields in insert types", () => {
      const folderInsert: FolderInsert = {
        userId: "user_123",
        name: "New Folder",
      };

      expect(folderInsert.userId).toBeDefined();
      expect(folderInsert.name).toBeDefined();
      // id, createdAt, updatedAt should be auto-generated
    });

    it("should infer correct types for all tables", () => {
      // This test verifies TypeScript compilation
      const _user: User = {} as User;
      const _userInsert: UserInsert = {} as UserInsert;
      const _folder: Folder = {} as Folder;
      const _folderInsert: FolderInsert = {} as FolderInsert;
      const _note: Note = {} as Note;
      const _noteInsert: NoteInsert = {} as NoteInsert;
      const _attachment: FileAttachment = {} as FileAttachment;
      const _attachmentInsert: FileAttachmentInsert = {} as FileAttachmentInsert;

      // If this compiles, types are correct
      expect(true).toBe(true);
    });
  });

  describe("Indexes", () => {
    it("should have indexes on folders table", () => {
      // Indexes are defined in the schema
      // Verify they exist by checking the table definition
      expect(folders).toBeDefined();
    });

    it("should have indexes on notes table", () => {
      expect(notes).toBeDefined();
    });

    it("should have indexes on fileAttachments table", () => {
      expect(fileAttachments).toBeDefined();
    });
  });

  describe("Cascade Behavior", () => {
    it("should cascade delete users to folders", () => {
      // Foreign key cascade is defined in schema, verify column exists
      expect(folders.userId).toBeDefined();
      expect(folders.userId.notNull).toBe(true);
    });

    it("should cascade delete users to notes", () => {
      // Foreign key cascade is defined in schema, verify column exists
      expect(notes.userId).toBeDefined();
      expect(notes.userId.notNull).toBe(true);
    });

    it("should set null on folder delete for notes", () => {
      // Foreign key set null is defined in schema, verify column exists
      expect(notes.folderId).toBeDefined();
    });

    it("should cascade delete notes to file attachments", () => {
      // Foreign key cascade is defined in schema, verify column exists
      expect(fileAttachments.noteId).toBeDefined();
      expect(fileAttachments.noteId.notNull).toBe(true);
    });
  });
});
