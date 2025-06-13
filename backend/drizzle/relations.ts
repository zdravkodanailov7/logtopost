import { relations } from "drizzle-orm/relations";
import { users, dailyLogs } from "./schema";

export const dailyLogsRelations = relations(dailyLogs, ({one}) => ({
	user: one(users, {
		fields: [dailyLogs.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	dailyLogs: many(dailyLogs),
}));