import { pgTable, unique, uuid, varchar, text, timestamp, foreignKey, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
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

export const emails = pgTable("emails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	source: varchar({ length: 100 }).default('waitlist'),
	metadata: text(),
});
