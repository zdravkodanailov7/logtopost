ALTER TABLE "posts" DROP CONSTRAINT "posts_daily_log_id_daily_logs_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "platform";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "daily_log_id";