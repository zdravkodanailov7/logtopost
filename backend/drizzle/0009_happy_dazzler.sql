CREATE TABLE "post_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"selected_text" text NOT NULL,
	"selection_start" integer NOT NULL,
	"selection_end" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "post_generation_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "crossed_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "post_generations" ADD CONSTRAINT "post_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_generations" ADD CONSTRAINT "post_generations_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_post_generation_id_post_generations_id_fk" FOREIGN KEY ("post_generation_id") REFERENCES "public"."post_generations"("id") ON DELETE no action ON UPDATE no action;