/**
 * Test data factories
 * Helper functions to create test data with sensible defaults
 */

import { db } from "../../db";
import { users, folders, notes, fileAttachments } from "../../db/schema";
import type { UserInsert, FolderInsert, NoteInsert, FileAttachmentInsert } from "../../db/schema";

/**
 * Creates a test user with optional overrides
 * @example
 * const user = await createTestUser({ email: "custom@test.com" });
 */
export const createTestUser = async (overrides?: Partial<UserInsert>) => {
  const timestamp = Date.now();
  const [user] = await db
    .insert(users)
    .values({
      id: `user_${timestamp}`,
      email: `test_${timestamp}@example.com`,
      firstName: "Test",
      lastName: "User",
      ...overrides,
    })
    .returning();
  return user;
};

/**
 * Creates a test folder for a user with optional overrides
 * @example
 * const folder = await createTestFolder(userId, { name: "Custom Folder" });
 */
export const createTestFolder = async (userId: string, overrides?: Partial<FolderInsert>) => {
  const timestamp = Date.now();
  const [folder] = await db
    .insert(folders)
    .values({
      userId,
      name: `Test Folder ${timestamp}`,
      color: "#6b7280",
      sortOrder: 0,
      isDefault: false,
      ...overrides,
    })
    .returning();
  return folder;
};

/**
 * Creates a test note with optional overrides
 * @example
 * const note = await createTestNote(userId, folderId, { title: "My Note" });
 */
export const createTestNote = async (
  userId: string,
  folderId: string | null,
  overrides?: Partial<NoteInsert>
) => {
  const timestamp = Date.now();
  const [note] = await db
    .insert(notes)
    .values({
      userId,
      folderId,
      title: `Test Note ${timestamp}`,
      content: "Test content",
      starred: false,
      archived: false,
      deleted: false,
      hidden: false,
      tags: [],
      ...overrides,
    })
    .returning();
  return note;
};

/**
 * Creates a test file attachment for a note with optional overrides
 * @example
 * const file = await createTestFileAttachment(noteId, { originalName: "test.pdf" });
 */
export const createTestFileAttachment = async (
  noteId: string,
  overrides?: Partial<FileAttachmentInsert>
) => {
  const timestamp = Date.now();
  const [attachment] = await db
    .insert(fileAttachments)
    .values({
      noteId,
      filename: `file_${timestamp}.txt`,
      originalName: `test_${timestamp}.txt`,
      mimeType: "text/plain",
      size: 1024,
      encryptedData: "encrypted_test_data",
      encryptedTitle: "encrypted_test_title",
      iv: "test_iv",
      salt: "test_salt",
      ...overrides,
    })
    .returning();
  return attachment;
};

/**
 * Creates a complete test setup with user, folder, and note
 * Useful for tests that need a full data structure
 * @example
 * const { user, folder, note } = await createTestSetup();
 */
export const createTestSetup = async () => {
  const user = await createTestUser();
  const folder = await createTestFolder(user.id);
  const note = await createTestNote(user.id, folder.id);

  return { user, folder, note };
};
