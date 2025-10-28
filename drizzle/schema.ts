import { pgTable, index, foreignKey, uuid, text, integer, timestamp, boolean, varchar } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const fileAttachments = pgTable("file_attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	noteId: uuid("note_id"),
	filename: text().notNull(),
	originalName: text("original_name").notNull(),
	mimeType: text("mime_type").notNull(),
	size: integer().notNull(),
	encryptedData: text("encrypted_data").notNull(),
	iv: text().notNull(),
	salt: text().notNull(),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	encryptedTitle: text("encrypted_title").default('encrypted_placeholder').notNull(),
}, (table) => [
	index("idx_file_attachments_note_id").using("btree", table.noteId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.noteId],
			foreignColumns: [notes.id],
			name: "file_attachments_note_id_fkey"
		}).onDelete("cascade"),
]);

export const folders = pgTable("folders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: text().notNull(),
	color: text().default('#6b7280'),
	parentId: uuid("parent_id"),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "folders_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "folders_parent_id_folders_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const notes = pgTable("notes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	folderId: uuid("folder_id"),
	title: text().notNull(),
	content: text().default('),
	starred: boolean().default(false),
	archived: boolean().default(false),
	deleted: boolean().default(false),
	tags: text().array().default([""]),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	encryptedTitle: text("encrypted_title"),
	encryptedContent: text("encrypted_content"),
	iv: text(),
	salt: varchar({ length: 255 }),
	hiddenAt: timestamp("hidden_at", { mode: 'string' }),
	hidden: boolean().default(false),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notes_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.folderId],
			foreignColumns: [folders.id],
			name: "notes_folder_id_folders_id_fk"
		}).onDelete("set null"),
]);
