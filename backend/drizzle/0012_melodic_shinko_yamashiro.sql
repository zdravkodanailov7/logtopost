ALTER TABLE "users" ADD COLUMN "has_had_trial" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "intended_plan_type";