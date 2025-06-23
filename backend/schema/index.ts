// backend/schema/index.ts
import { pgTable, uuid, timestamp, varchar, text, date, integer, unique, pgEnum, boolean } from 'drizzle-orm/pg-core';

// Define the post status enum
export const postStatusEnum = pgEnum('post_status', ['pending', 'approved', 'rejected']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  custom_prompt: text('custom_prompt'), // For user's custom AI prompt
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

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  daily_log_id: uuid('daily_log_id').references(() => dailyLogs.id),
  content: text('content').notNull(),
  used: boolean('used').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
