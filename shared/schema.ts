import { z } from "zod";
import { pgTable, varchar, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const botSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  repository: z.string(),
  logo: z.string().optional(),
  keywords: z.array(z.string()),
  env: z.record(z.object({
    description: z.string(),
    required: z.boolean(),
    placeholder: z.string().optional(),
  })),
  stars: z.number().optional(),
  category: z.string().optional(),
  active: z.boolean().optional(),
});

export type Bot = z.infer<typeof botSchema>;

export const deploymentStatusSchema = z.enum(["queued", "deploying", "running", "stopped", "failed"]);
export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;

export const deploymentSchema = z.object({
  id: z.string(),
  botId: z.string(),
  botName: z.string(),
  userId: z.string().optional(),
  status: deploymentStatusSchema,
  envVars: z.record(z.string()),
  url: z.string().optional(),
  port: z.number().optional(),
  pterodactylId: z.number().optional(),
  pterodactylIdentifier: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  logs: z.array(z.object({
    timestamp: z.string(),
    level: z.enum(["info", "warn", "error", "success"]),
    message: z.string(),
  })),
  metrics: z.object({
    cpu: z.number(),
    memory: z.number(),
    uptime: z.number(),
    requests: z.number(),
  }).optional(),
});

export type Deployment = z.infer<typeof deploymentSchema>;

export const deployRequestSchema = z.object({
  botId: z.string(),
  envVars: z.record(z.string()),
});

export type DeployRequest = z.infer<typeof deployRequestSchema>;

export const users = {} as any;
export type User = { id: string; username: string; password: string };
export type InsertUser = Omit<User, "id">;
export const insertUserSchema = z.object({ username: z.string(), password: z.string() });

export const userCoins = pgTable("user_coins", {
  userId: varchar("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
});

export type UserCoins = typeof userCoins.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  userId: varchar("user_id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;

export const platformBots = pgTable("platform_bots", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  repository: varchar("repository").notNull(),
  logo: varchar("logo"),
  keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
  category: varchar("category").default("WhatsApp Bot"),
  stars: integer("stars").default(0),
  env: jsonb("env").notNull().default(sql`'{}'::jsonb`),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PlatformBot = typeof platformBots.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type").notNull().default("info"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;

export const deployments = pgTable("deployments", {
  id: varchar("id").primaryKey(),
  botId: varchar("bot_id").notNull(),
  botName: varchar("bot_name").notNull(),
  userId: varchar("user_id"),
  status: varchar("status").notNull().default("queued"),
  envVars: jsonb("env_vars").notNull().default(sql`'{}'::jsonb`),
  url: varchar("url"),
  pterodactylId: integer("pterodactyl_id"),
  pterodactylIdentifier: varchar("pterodactyl_identifier"),
  logs: jsonb("logs").notNull().default(sql`'[]'::jsonb`),
  metrics: jsonb("metrics").notNull().default(sql`'{"cpu":0,"memory":0,"uptime":0,"requests":0}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DeploymentRow = typeof deployments.$inferSelect;

export const paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").notNull(),
  coins: integer("coins").notNull(),
  status: varchar("status").notNull(),
  reference: varchar("reference").notNull(),
  provider: varchar("provider"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

export const botRegistrations = pgTable("bot_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  repository: varchar("repository").notNull(),
  logo: varchar("logo"),
  keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
  category: varchar("category").default("WhatsApp Bot"),
  env: jsonb("env").notNull().default(sql`'{}'::jsonb`),
  status: varchar("status").notNull().default("pending"),
  rewardClaimed: boolean("reward_claimed").default(false),
  rewardExpiresAt: timestamp("reward_expires_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export type BotRegistration = typeof botRegistrations.$inferSelect;

export const userComments = pgTable("user_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  subject: varchar("subject"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserComment = typeof userComments.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  username: varchar("username").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
