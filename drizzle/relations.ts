import { relations } from "drizzle-orm/relations";
import { notes, fileAttachments, users, folders } from "./schema";

export const fileAttachmentsRelations = relations(fileAttachments, ({one}) => ({
	note: one(notes, {
		fields: [fileAttachments.noteId],
		references: [notes.id]
	}),
}));

export const notesRelations = relations(notes, ({one, many}) => ({
	fileAttachments: many(fileAttachments),
	user: one(users, {
		fields: [notes.userId],
		references: [users.id]
	}),
	folder: one(folders, {
		fields: [notes.folderId],
		references: [folders.id]
	}),
}));

export const foldersRelations = relations(folders, ({one, many}) => ({
	user: one(users, {
		fields: [folders.userId],
		references: [users.id]
	}),
	folder: one(folders, {
		fields: [folders.parentId],
		references: [folders.id],
		relationName: "folders_parentId_folders_id"
	}),
	folders: many(folders, {
		relationName: "folders_parentId_folders_id"
	}),
	notes: many(notes),
}));

export const usersRelations = relations(users, ({many}) => ({
	folders: many(folders),
	notes: many(notes),
}));