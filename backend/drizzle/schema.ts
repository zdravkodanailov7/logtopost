import { pgTable, foreignKey, uuid, text, integer, timestamp, unique, date, boolean, varchar, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const postStatus = pgEnum("post_status", ['pending', 'approved', 'rejected'])


export const postGenerations = pgTable("post_generations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	dailyLogId: uuid("daily_log_id").notNull(),
	selectedText: text("selected_text").notNull(),
	selectionStart: integer("selection_start").notNull(),
	selectionEnd: integer("selection_end").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.dailyLogId],
			foreignColumns: [dailyLogs.id],
			name: "post_generations_daily_log_id_daily_logs_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "post_generations_user_id_users_id_fk"
		}),
]);

export const dailyLogs = pgTable("daily_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	logDate: date("log_date").notNull(),
	content: text(),
	userId: uuid("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "daily_logs_user_id_users_id_fk"
		}),
	unique("daily_logs_user_id_log_date_unique").on(table.logDate, table.userId),
]);

export const posts = pgTable("posts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	content: text().notNull(),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	dailyLogId: uuid("daily_log_id"),
	used: boolean().default(false).notNull(),
	postGenerationId: uuid("post_generation_id"),
	crossedOut: boolean("crossed_out").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.dailyLogId],
			foreignColumns: [dailyLogs.id],
			name: "posts_daily_log_id_daily_logs_id_fk"
		}),
	foreignKey({
			columns: [table.postGenerationId],
			foreignColumns: [postGenerations.id],
			name: "posts_post_generation_id_post_generations_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "posts_user_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	customPrompt: text("custom_prompt"),
	stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
	stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
	subscriptionStatus: varchar("subscription_status", { length: 50 }).default('trial'),
	planType: varchar("plan_type", { length: 50 }).default('trial'),
	generationsUsedThisMonth: integer("generations_used_this_month").default(0).notNull(),
	trialGenerationsUsed: integer("trial_generations_used").default(0).notNull(),
	trialEndsAt: timestamp("trial_ends_at", { mode: 'string' }).default(sql`(now() + '7 days'::interval)`),
	subscriptionEndsAt: timestamp("subscription_ends_at", { mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const emails = pgTable("emails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	source: varchar({ length: 100 }).default('waitlist'),
	metadata: text(),
});
