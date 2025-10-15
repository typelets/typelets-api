import type {
  User,
  UserInsert,
  Folder,
  FolderInsert,
  Note,
  NoteInsert,
  FileAttachment,
  FileAttachmentInsert,
} from "../db";

export interface ClerkUserData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ClerkJWTPayload {
  sub: string; // user ID
  email?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  iat: number;
  exp: number;
  iss: string;
}

export interface ClerkApiUser {
  id: string;
  email_addresses?: Array<{ email_address: string }>;
  first_name?: string | null;
  last_name?: string | null;
}

export interface DatabaseError {
  code?: string;
  constraint_name?: string;
  detail?: string;
}

export interface UserUpdateData {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
}

// Note with attachment count for list responses
export type NoteWithAttachmentCount = Omit<Note, "attachments"> & {
  attachmentCount: number;
  folder?: Folder | null;
};

export type {
  User,
  UserInsert,
  Folder,
  FolderInsert,
  Note,
  NoteInsert,
  FileAttachment,
  FileAttachmentInsert,
};
