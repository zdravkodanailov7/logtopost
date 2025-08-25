import { pgTable, uuid, timestamp, varchar, text, date, integer, unique, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  is_admin: boolean('is_admin').default(false).notNull(),
  custom_prompt: text('custom_prompt'),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  subscription_status: varchar('subscription_status', { length: 50 }).default('trial'), // trial, active, cancelled
  generations_used_this_month: integer('generations_used_this_month').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});



export const dailyLogs = pgTable('daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  log_date: date('log_date').notNull(),
  content: text('content'),
  user_id: uuid('user_id').references(() => users.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserDate: unique().on(table.user_id, table.log_date),
}));

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  daily_log_id: uuid('daily_log_id').references(() => dailyLogs.id),
  content: text('content').notNull(),
  selected_text: text('selected_text'), // optional if shown to user
  selection_start: integer('selection_start'),
  selection_end: integer('selection_end'),
  status: varchar('status', { length: 50 }).default('pending'), // pending, approved, rejected
  used: boolean('used').default(false).notNull(),
  crossed_out: boolean('crossed_out').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
