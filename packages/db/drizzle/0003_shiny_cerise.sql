CREATE TABLE "bible_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"public_domain" boolean DEFAULT false NOT NULL,
	"copyright" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bible_verses" (
	"translation_id" text NOT NULL,
	"book" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "bible_verses_translation_id_book_chapter_verse_pk" PRIMARY KEY("translation_id","book","chapter","verse")
);
--> statement-breakpoint
ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_translation_id_bible_translations_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."bible_translations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bible_verses_passage_idx" ON "bible_verses" USING btree ("translation_id","book","chapter");