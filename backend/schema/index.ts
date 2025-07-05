// backend/schema/index.ts
import { pgTable, uuid, timestamp, varchar, text, date, integer, unique, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Define the post status enum
export const postStatusEnum = pgEnum('post_status', ['pending', 'approved', 'rejected']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  custom_prompt: text('custom_prompt'), // For user's custom AI prompt
  
  // Stripe & Subscription fields
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  stripe_subscription_id: varchar('stripe_subscription_id', { length: 255 }),
  subscription_status: varchar('subscription_status', { length: 50 }).default('trial'), // trial, active, cancelled, past_due
  plan_type: varchar('plan_type', { length: 50 }).default('trial'), // trial, premium
  
  // Usage tracking
  generations_used_this_month: integer('generations_used_this_month').default(0).notNull(),
  trial_generations_used: integer('trial_generations_used').default(0).notNull(),
  
  // Trial tracking
  trial_ends_at: timestamp('trial_ends_at').default(sql`NOW() + INTERVAL '7 days'`),
  has_had_trial: boolean('has_had_trial').default(true).notNull(), // Track if user has ever had a trial
  subscription_ends_at: timestamp('subscription_ends_at'),
  
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const emails = pgTable('emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  source: varchar('source', { length: 100 }).default('waitlist'),
  metadata: text('metadata'), // For storing additional info as JSON if needed
});

export const dailyLogs = pgTable('daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  log_date: date('log_date').notNull(),
  content: text('content'),
  user_id: uuid('user_id').references(() => users.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Ensure one log entry per user per date
  uniqueUserDate: unique().on(table.user_id, table.log_date),
}));

export const postGenerations = pgTable('post_generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  daily_log_id: uuid('daily_log_id').references(() => dailyLogs.id).notNull(),
  selected_text: text('selected_text').notNull(), // The original selected text
  selection_start: integer('selection_start').notNull(), // Character position start
  selection_end: integer('selection_end').notNull(), // Character position end  
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  daily_log_id: uuid('daily_log_id').references(() => dailyLogs.id),
  post_generation_id: uuid('post_generation_id').references(() => postGenerations.id),
  content: text('content').notNull(),
  used: boolean('used').default(false).notNull(),
  crossed_out: boolean('crossed_out').default(false).notNull(), // New field for crossed out posts
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
