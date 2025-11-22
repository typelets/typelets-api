CREATE TABLE "public_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'note' NOT NULL,
	"author_name" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_notes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "public_notes" ADD CONSTRAINT "public_notes_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_notes" ADD CONSTRAINT "public_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_public_notes_slug" ON "public_notes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_public_notes_note_id" ON "public_notes" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "idx_public_notes_user_id" ON "public_notes" USING btree ("user_id");