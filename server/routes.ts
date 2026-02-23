import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { userCoins } from "@shared/schema";
import { deployRequestSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

const COINS_PER_BOT = 10;

async function getBalance(userId: string): Promise<number> {
  const rows = await db.select().from(userCoins).where(eq(userCoins.userId, userId));
  return rows[0]?.balance ?? 0;
}

async function creditCoins(userId: string, amount: number): Promise<number> {
  const existing = await db.select().from(userCoins).where(eq(userCoins.userId, userId));
  if (existing.length === 0) {
    await db.insert(userCoins).values({ userId, balance: amount });
    return amount;
  }
  const newBal = existing[0].balance + amount;
  await db.update(userCoins).set({ balance: newBal }).where(eq(userCoins.userId, userId));
  return newBal;
}

async function deductCoins(userId: string, amount: number): Promise<{ ok: boolean; balance: number }> {
  const existing = await db.select().from(userCoins).where(eq(userCoins.userId, userId));
  const current = existing[0]?.balance ?? 0;
  if (current < amount) return { ok: false, balance: current };
  const newBal = current - amount;
  if (existing.length === 0) {
    await db.insert(userCoins).values({ userId, balance: newBal });
  } else {
    await db.update(userCoins).set({ balance: newBal }).where(eq(userCoins.userId, userId));
  }
  return { ok: true, balance: newBal };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Public config endpoint — exposes safe public keys to the frontend
  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    });
  });

  app.get("/api/bots", async (_req, res) => {
    const bots = await storage.getBots();
    res.json(bots);
  });

  app.get("/api/bots/:id", async (req, res) => {
    const bot = await storage.getBot(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json(bot);
  });

  app.get("/api/bots/:id/app.json", async (req, res) => {
    const bot = await storage.getBot(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json({ name: bot.name, description: bot.description, repository: bot.repository, keywords: bot.keywords, env: bot.env });
  });

  app.get("/api/deployments", async (_req, res) => {
    const deployments = await storage.getDeployments();
    res.json(deployments);
  });

  app.get("/api/deployments/:id", async (req, res) => {
    const deployment = await storage.getDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    res.json(deployment);
  });

  app.get("/api/deployments/:id/logs", async (req, res) => {
    const deployment = await storage.getDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    res.json(deployment.logs);
  });

  /* ── Coin endpoints ─────────────────────────────────────── */
  app.get("/api/coins/:userId", async (req, res) => {
    try {
      const balance = await getBalance(req.params.userId);
      res.json({ balance });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  app.post("/api/coins/credit", async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid userId or amount" });
    }
    try {
      const balance = await creditCoins(userId, amount);
      res.json({ balance });
    } catch (err) {
      res.status(500).json({ error: "Failed to credit coins" });
    }
  });

  /* ── Deploy — requires coins ──────────────────────────────── */
  app.post("/api/deploy", async (req, res) => {
    const result = deployRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });

    const { botId, envVars, userId } = result.data as typeof result.data & { userId?: string };

    // Check and deduct coins if userId provided
    if (userId) {
      const deductResult = await deductCoins(userId, COINS_PER_BOT);
      if (!deductResult.ok) {
        return res.status(402).json({
          error: "Insufficient coins",
          balance: deductResult.balance,
          required: COINS_PER_BOT,
        });
      }
    }

    const bot = await storage.getBot(botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    const deployment = await storage.createDeployment(botId, bot.name, bot.repository, envVars);
    res.status(201).json(deployment);
  });

  app.post("/api/deployments/:id/stop", async (req, res) => {
    const deployment = await storage.stopDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    res.json(deployment);
  });

  app.delete("/api/deployments/:id", async (req, res) => {
    const ok = await storage.deleteDeployment(req.params.id);
    if (!ok) return res.status(404).json({ error: "Deployment not found" });
    res.json({ success: true });
  });

  return httpServer;
}
