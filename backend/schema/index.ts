// backend/schema/index.ts
import { pgTable, uuid, timestamp, varchar, text, date, integer, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
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
