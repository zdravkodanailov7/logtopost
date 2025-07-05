import { relations } from "drizzle-orm/relations";
import { dailyLogs, postGenerations, users, posts } from "./schema";

export const postGenerationsRelations = relations(postGenerations, ({one, many}) => ({
	dailyLog: one(dailyLogs, {
		fields: [postGenerations.dailyLogId],
		references: [dailyLogs.id]
	}),
	user: one(users, {
		fields: [postGenerations.userId],
		references: [users.id]
	}),
	posts: many(posts),
}));

export const dailyLogsRelations = relations(dailyLogs, ({one, many}) => ({
	postGenerations: many(postGenerations),
	user: one(users, {
		fields: [dailyLogs.userId],
		references: [users.id]
	}),
	posts: many(posts),
}));

export const usersRelations = relations(users, ({many}) => ({
	postGenerations: many(postGenerations),
	dailyLogs: many(dailyLogs),
	posts: many(posts),
}));

export const postsRelations = relations(posts, ({one}) => ({
	dailyLog: one(dailyLogs, {
		fields: [posts.dailyLogId],
		references: [dailyLogs.id]
	}),
	postGeneration: one(postGenerations, {
		fields: [posts.postGenerationId],
		references: [postGenerations.id]
	}),
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
}));