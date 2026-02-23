import { z } from "zod";
import { pgTable, varchar, integer } from "drizzle-orm/pg-core";

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
});

export type Bot = z.infer<typeof botSchema>;

export const deploymentStatusSchema = z.enum(["queued", "deploying", "running", "stopped", "failed"]);
export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;

export const deploymentSchema = z.object({
  id: z.string(),
  botId: z.string(),
  botName: z.string(),
  status: deploymentStatusSchema,
  envVars: z.record(z.string()),
  url: z.string().optional(),
  port: z.number().optional(),
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
