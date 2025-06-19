import { relations } from "drizzle-orm/relations";
import { users, posts, dailyLogs } from "./schema";

export const postsRelations = relations(posts, ({one}) => ({
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	posts: many(posts),
	dailyLogs: many(dailyLogs),
}));

export const dailyLogsRelations = relations(dailyLogs, ({one}) => ({
	user: one(users, {
		fields: [dailyLogs.userId],
		references: [users.id]
	}),
}));