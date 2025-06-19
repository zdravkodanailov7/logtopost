-- First, update any 'draft' status values to 'pending' to ensure compatibility with the new ENUM
UPDATE "posts" SET "status" = 'pending' WHERE "status" = 'draft';--> statement-breakpoint

-- Update any other non-standard status values to 'pending' as well
UPDATE "posts" SET "status" = 'pending' WHERE "status" NOT IN ('pending', 'approved', 'rejected');--> statement-breakpoint

-- Create the ENUM type
CREATE TYPE "public"."post_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint

-- Set the default value for the column
ALTER TABLE "posts" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."post_status";--> statement-breakpoint

-- Convert the column to use the ENUM type
ALTER TABLE "posts" ALTER COLUMN "status" SET DATA TYPE "public"."post_status" USING "status"::"public"."post_status";--> statement-breakpoint

-- Drop the source_text column that we removed from the schema
ALTER TABLE "posts" DROP COLUMN IF EXISTS "source_text";