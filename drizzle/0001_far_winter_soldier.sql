ALTER TABLE "file_attachments" DROP CONSTRAINT "file_attachments_note_id_fkey";
--> statement-breakpoint
ALTER TABLE "folders" DROP CONSTRAINT "folders_parent_id_folders_id_fk";
--> statement-breakpoint
DROP INDEX "idx_file_attachments_note_id";--> statement-breakpoint
ALTER TABLE "file_attachments" ALTER COLUMN "note_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file_attachments" ALTER COLUMN "uploaded_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "salt" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "type" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_folders_user_id" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_folders_user_sort" ON "folders" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_notes_user_id" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notes_folder_id" ON "notes" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "idx_notes_user_updated" ON "notes" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notes_type" ON "notes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_file_attachments_note_id" ON "file_attachments" USING btree ("note_id");