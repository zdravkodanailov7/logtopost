ALTER TABLE "posts" ADD COLUMN "used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "rejection_reason";