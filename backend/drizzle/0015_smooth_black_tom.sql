ALTER TABLE "post_generations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "post_generations" CASCADE;--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_post_generation_id_post_generations_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "selected_text" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "selection_start" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "selection_end" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "emails" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "post_generation_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "plan_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_generations_used";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_ends_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "has_had_trial";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "subscription_ends_at";--> statement-breakpoint
DROP TYPE "public"."post_status";