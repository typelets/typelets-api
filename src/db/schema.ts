import { pgTable, text, timestamp, boolean, uuid, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  color: text("color").default("#6b7280"),
  parentId: uuid("parent_id"),
  sortOrder: integer("sort_order").default(0).notNull(), // Add this field for user-defined ordering
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  folderId: uuid("folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),

  title: text("title").notNull(),
  content: text("content").default(""),

  encryptedTitle: text("encrypted_title"),
  encryptedContent: text("encrypted_content"),
  iv: text("iv"), // Initialization vector for AES-GCM encryption
  salt: text("salt"), // Salt for key derivation

  starred: boolean("starred").default(false),
  archived: boolean("archived").default(false),
  deleted: boolean("deleted").default(false),
  hidden: boolean("hidden").default(false),
  hiddenAt: timestamp("hidden_at"),
  tags: text("tags").array().default([]),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fileAttachments = pgTable(
  "file_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .references(() => notes.id, { onDelete: "cascade" })
      .notNull(),
    filename: text("filename").notNull(), // Generated unique filename for storage
    originalName: text("original_name").notNull(), // User's original filename
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    encryptedData: text("encrypted_data").notNull(), // Base64 encrypted content
    encryptedTitle: text("encrypted_title").default("encrypted_placeholder").notNull(), // Encrypted filename with default placeholder
    iv: text("iv").notNull(), // Initialization vector for decryption
    salt: text("salt").notNull(), // Salt used in encryption
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    noteIdIdx: index("idx_file_attachments_note_id").on(table.noteId),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  folders: many(folders),
  notes: many(notes),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, {
    fields: [folders.userId],
    references: [users.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "folder_parent",
  }),
  children: many(folders, {
    relationName: "folder_parent",
  }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  folder: one(folders, {
    fields: [notes.folderId],
    references: [folders.id],
  }),
  attachments: many(fileAttachments),
}));

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  note: one(notes, {
    fields: [fileAttachments.noteId],
    references: [notes.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NoteInsert = typeof notes.$inferInsert;
export type Folder = typeof folders.$inferSelect; // Now includes sortOrder: number
export type FolderInsert = typeof folders.$inferInsert;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type FileAttachmentInsert = typeof fileAttachments.$inferInsert;
