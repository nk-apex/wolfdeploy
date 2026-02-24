import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  userCoins,
  adminUsers,
  platformBots,
  notifications,
  paymentTransactions,
  botRegistrations,
  userComments,
  chatMessages,
  platformSettings,
  ipRegistrations,
  userTrials,
} from "@shared/schema";
import { deployRequestSchema } from "@shared/schema";
import { eq, desc, sql, and, gt } from "drizzle-orm";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";

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

const ENV_ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)
);

async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (ENV_ADMIN_IDS.has(userId)) return true;
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.userId, userId));
  return rows.length > 0;
}

function getUserId(req: any): string {
  return (req.headers["x-user-id"] as string) || "";
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const uid = getUserId(req);
  if (!uid || !(await isAdmin(uid))) {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return false;
  }
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  /* ── Public config ──────────────────────────────────────── */
  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    });
  });

  /* ── Bots (from DB) ─────────────────────────────────────── */
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

  /* ── Deployments ────────────────────────────────────────── */
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

  /* ── Paystack payment endpoints ─────────────────────────── */
  app.post("/api/payments/initialize", async (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Payment not configured on server" });

    const { email, amount, currency, channels, phone, reference, userId, coins } = req.body;
    if (!email || !amount || !currency || !reference) {
      return res.status(400).json({ error: "Missing required payment fields" });
    }

    try {
      const body: Record<string, unknown> = {
        email,
        amount: Math.round(amount),
        currency,
        channels,
        reference,
        metadata: { userId, coins, phone },
      };
      if (phone) body.phone = phone;

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await paystackRes.json() as { status: boolean; message: string; data?: { authorization_url: string; access_code: string; reference: string } };
      if (!data.status || !data.data) {
        return res.status(400).json({ error: data.message || "Failed to initialize payment" });
      }

      // Save pending transaction
      if (userId && coins) {
        try {
          await db.insert(paymentTransactions).values({
            id: reference,
            userId,
            amount: Math.round(amount),
            currency,
            coins: Number(coins),
            status: "pending",
            reference,
            provider: channels?.[0] ?? "card",
          });
        } catch (_) {}
      }

      res.json({
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to reach payment gateway" });
    }
  });

  app.post("/api/payments/verify", async (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Payment not configured on server" });

    const { reference, userId, coins, currency, amount, provider } = req.body;
    if (!reference || !userId || typeof coins !== "number") {
      return res.status(400).json({ error: "Missing required verification fields" });
    }

    try {
      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });

      const data = await paystackRes.json() as { status: boolean; data?: { status: string; amount: number; currency: string; channel: string } };
      if (!data.status || !data.data) {
        return res.status(400).json({ error: "Could not verify transaction" });
      }

      if (data.data.status !== "success") {
        return res.status(402).json({ error: `Payment not completed. Status: ${data.data.status}` });
      }

      // Guard against double-credit: check if already processed
      const existing = await db.select().from(paymentTransactions)
        .where(eq(paymentTransactions.reference, reference));
      if (existing.length > 0 && existing[0].status === "success") {
        const balance = await getBalance(userId);
        return res.json({ success: true, balance, alreadyCredited: true });
      }

      const balance = await creditCoins(userId, coins);

      // Upsert payment transaction as success
      const txAmount = data.data.amount ?? Math.round(amount ?? 0);
      const txCurrency = data.data.currency ?? currency ?? "USD";
      const txProvider = data.data.channel ?? provider ?? "card";

      await db.insert(paymentTransactions).values({
        id: reference,
        userId,
        amount: txAmount,
        currency: txCurrency,
        coins,
        status: "success",
        reference,
        provider: txProvider,
      }).onConflictDoUpdate({
        target: paymentTransactions.id,
        set: { status: "success", provider: txProvider },
      });

      res.json({ success: true, balance });
    } catch (err) {
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  /* ── Direct mobile money STK push via Paystack Charge API ── */
  app.post("/api/payments/mobile-charge", async (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Payment not configured on server" });

    const { email, amount, currency, phone, provider, userId, coins, reference } = req.body;
    if (!email || !amount || !currency || !phone || !provider) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const chargeBody = { email, amount, currency, mobile_money: { phone, provider } };
      console.log("[mobile-charge] Sending to Paystack:", JSON.stringify(chargeBody));

      const paystackRes = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chargeBody),
      });

      const data = await paystackRes.json() as {
        status: boolean;
        message: string;
        data?: { reference: string; status: string; display_text?: string };
      };

      console.log("[mobile-charge] Paystack response:", JSON.stringify(data));
      if (!data.status || !data.data) {
        return res.status(400).json({ error: data.message || "Failed to initiate charge" });
      }

      // Save pending transaction
      if (userId && coins) {
        try {
          const txRef = data.data.reference;
          await db.insert(paymentTransactions).values({
            id: txRef,
            userId,
            amount: Math.round(amount),
            currency,
            coins: Number(coins),
            status: "pending",
            reference: txRef,
            provider,
          }).onConflictDoNothing();
        } catch (_) {}
      }

      res.json({
        reference: data.data.reference,
        status: data.data.status,
        displayText: data.data.display_text || "Enter your mobile money PIN on your phone",
      });
    } catch {
      res.status(500).json({ error: "Could not reach payment gateway. Try again." });
    }
  });

  app.get("/api/payments/check/:reference", async (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.json({ status: "error" });
    try {
      const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(req.params.reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await r.json() as { status: boolean; data?: { status: string; amount: number; currency: string; channel: string } };
      const txStatus = data.data?.status ?? "pending";

      // If success, update our DB record
      if (txStatus === "success" && req.query.userId && req.query.coins) {
        try {
          await db.update(paymentTransactions)
            .set({ status: "success", provider: data.data?.channel })
            .where(eq(paymentTransactions.reference, req.params.reference));
        } catch (_) {}
      }

      res.json({ status: txStatus });
    } catch {
      res.json({ status: "pending" });
    }
  });

  /* ── Coin endpoints ─────────────────────────────────────── */
  app.get("/api/coins/:userId", async (req, res) => {
    try {
      const uid = req.params.userId;

      // Check trial state and possibly expire it
      const trialRows = await db.select().from(userTrials).where(eq(userTrials.userId, uid));
      const trial = trialRows[0];

      if (trial && !trial.expired && trial.expiresAt && new Date() > trial.expiresAt) {
        // Trial has expired — mark it, delete their bots, notify admin
        await db.update(userTrials).set({ expired: true }).where(eq(userTrials.userId, uid));

        const allDeps = await storage.getAllDeployments();
        const userDeps = allDeps.filter(d => d.userId === uid);
        for (const dep of userDeps) {
          try { await storage.deleteDeployment(dep.id); } catch (_) {}
        }

        // Create a user-facing notification about trial expiry
        await db.insert(notifications).values({
          id: randomUUID(),
          title: "Trial Expired — Top Up to Continue",
          message: "Your 2-day free trial has ended and your bot deployments have been paused. Add coins in the Billing section to deploy again.",
          type: "warning",
          active: true,
        }).onConflictDoNothing();

        // Alert admin
        await db.insert(notifications).values({
          id: randomUUID(),
          title: `[ADMIN] Trial Expired for User ${uid.slice(0, 8)}`,
          message: `User ${uid} trial expired. ${userDeps.length} deployment(s) removed. Bot deployments were automatically cleaned up.`,
          type: "error",
          active: false,
        }).onConflictDoNothing();
      }

      // Auto-grant 5 trial coins to first-time users
      const existingCoins = await db.select().from(userCoins).where(eq(userCoins.userId, uid));
      const existingTrial = await db.select().from(userTrials).where(eq(userTrials.userId, uid));

      if (existingCoins.length === 0 && existingTrial.length === 0) {
        const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await db.insert(userCoins).values({ userId: uid, balance: 5 });
        await db.insert(userTrials).values({ userId: uid, coinsGranted: 5, expiresAt });
      }

      const balance = await getBalance(uid);
      const newTrial = await db.select().from(userTrials).where(eq(userTrials.userId, uid));
      res.json({ balance, trial: newTrial[0] || null });
    } catch {
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
    } catch {
      res.status(500).json({ error: "Failed to credit coins" });
    }
  });

  /* ── Deploy — requires coins ──────────────────────────────── */
  app.post("/api/deploy", async (req, res) => {
    const result = deployRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });

    const { botId, envVars, userId } = result.data as typeof result.data & { userId?: string };

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

    const deployment = await storage.createDeployment(botId, bot.name, bot.repository, envVars, userId);
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

  /* ═══════════════════════════════════════════════════════════
     ADMIN ENDPOINTS
  ════════════════════════════════════════════════════════════ */

  /* ── Check admin status ─────────────────────────────────── */
  app.get("/api/admin/check", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.json({ isAdmin: false });
    const admin = await isAdmin(uid);
    res.json({ isAdmin: admin });
  });

  /* ── Admin: Stats overview ──────────────────────────────── */
  app.get("/api/admin/stats", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const [userRows, coinRows, botRows, txRows, notifRows] = await Promise.all([
        db.select().from(userCoins),
        db.select({ total: sql<number>`SUM(balance)` }).from(userCoins),
        db.select().from(platformBots),
        db.select().from(paymentTransactions),
        db.select().from(notifications),
      ]);

      const allDeployments = await storage.getAllDeployments();
      const successTxs = txRows.filter(t => t.status === "success");
      const totalRevenue = successTxs.reduce((sum, t) => sum + t.amount, 0);

      res.json({
        totalUsers: userRows.length,
        totalCoinsInCirculation: Number(coinRows[0]?.total ?? 0),
        totalBots: botRows.length,
        activeBots: botRows.filter(b => b.active).length,
        totalDeployments: allDeployments.length,
        runningDeployments: allDeployments.filter(d => d.status === "running").length,
        failedDeployments: allDeployments.filter(d => d.status === "failed").length,
        totalTransactions: txRows.length,
        successTransactions: successTxs.length,
        totalRevenue,
        totalNotifications: notifRows.length,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  /* ── Admin: Users ───────────────────────────────────────── */
  app.get("/api/admin/users", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      const users = await db.select().from(userCoins).orderBy(desc(userCoins.balance));
      const allDeployments = await storage.getAllDeployments();
      const adminList = await db.select().from(adminUsers);
      const adminIds = new Set(adminList.map(a => a.userId));

      const usersWithMeta = users.map(u => ({
        userId: u.userId,
        balance: u.balance,
        isAdmin: adminIds.has(u.userId),
        deploymentCount: allDeployments.filter(d => d.userId === u.userId).length,
        runningBots: allDeployments.filter(d => d.userId === u.userId && d.status === "running").length,
      }));

      res.json(usersWithMeta);
    } catch {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:userId", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { userId } = req.params;
    try {
      // Stop all their deployments
      const allDeployments = await storage.getAllDeployments();
      const userDeployments = allDeployments.filter(d => d.userId === userId);
      for (const dep of userDeployments) {
        await storage.deleteDeployment(dep.id);
      }
      // Remove coin balance
      await db.delete(userCoins).where(eq(userCoins.userId, userId));
      // Remove from admin if they were admin
      await db.delete(adminUsers).where(eq(adminUsers.userId, userId));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/:userId/grant-admin", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { userId } = req.params;
    await db.insert(adminUsers).values({ userId }).onConflictDoNothing();
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:userId/revoke-admin", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const requesterId = getUserId(req);
    if (requesterId === req.params.userId) {
      return res.status(400).json({ error: "Cannot revoke your own admin role" });
    }
    await db.delete(adminUsers).where(eq(adminUsers.userId, req.params.userId));
    res.json({ success: true });
  });

  app.post("/api/admin/users/:userId/adjust-coins", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { userId } = req.params;
    const { amount } = req.body;
    if (typeof amount !== "number") return res.status(400).json({ error: "Invalid amount" });
    const balance = amount >= 0 ? await creditCoins(userId, amount) : (await deductCoins(userId, Math.abs(amount))).balance;
    res.json({ success: true, balance });
  });

  /* ── Admin: Bots ────────────────────────────────────────── */
  app.get("/api/admin/bots", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const bots = await db.select().from(platformBots).orderBy(platformBots.createdAt);
    res.json(bots);
  });

  app.post("/api/admin/bots", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { name, description, repository, logo, keywords, category, stars, env } = req.body;
    if (!name || !description || !repository) {
      return res.status(400).json({ error: "name, description, and repository are required" });
    }
    const id = randomUUID();
    const [bot] = await db.insert(platformBots).values({
      id,
      name,
      description,
      repository,
      logo: logo || null,
      keywords: keywords || [],
      category: category || "WhatsApp Bot",
      stars: stars || 0,
      env: env || {},
      active: true,
    }).returning();
    res.status(201).json(bot);
  });

  app.put("/api/admin/bots/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { name, description, repository, logo, keywords, category, stars, env, active } = req.body;
    const [bot] = await db.update(platformBots)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(repository !== undefined && { repository }),
        ...(logo !== undefined && { logo }),
        ...(keywords !== undefined && { keywords }),
        ...(category !== undefined && { category }),
        ...(stars !== undefined && { stars }),
        ...(env !== undefined && { env }),
        ...(active !== undefined && { active }),
      })
      .where(eq(platformBots.id, req.params.id))
      .returning();
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json(bot);
  });

  app.delete("/api/admin/bots/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await db.delete(platformBots).where(eq(platformBots.id, req.params.id));
    res.json({ success: true });
  });

  /* ── Admin: Payments ────────────────────────────────────── */
  app.get("/api/admin/payments", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const txs = await db.select().from(paymentTransactions).orderBy(desc(paymentTransactions.createdAt));
    res.json(txs);
  });

  /* ── Admin: Deployments (all users) ────────────────────── */
  app.get("/api/admin/deployments", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const deployments = await storage.getAllDeployments();
    res.json(deployments);
  });

  app.post("/api/admin/deployments/:id/stop", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const dep = await storage.stopDeployment(req.params.id);
    if (!dep) return res.status(404).json({ error: "Deployment not found" });
    res.json(dep);
  });

  app.delete("/api/admin/deployments/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const ok = await storage.deleteDeployment(req.params.id);
    if (!ok) return res.status(404).json({ error: "Deployment not found" });
    res.json({ success: true });
  });

  /* ── Admin: Notifications ───────────────────────────────── */
  app.get("/api/admin/notifications", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const notifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
    res.json(notifs);
  });

  app.get("/api/notifications", async (_req, res) => {
    const notifs = await db.select().from(notifications)
      .where(eq(notifications.active, true))
      .orderBy(desc(notifications.createdAt));
    res.json(notifs);
  });

  app.post("/api/admin/notifications", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { title, message, type } = req.body;
    if (!title || !message) return res.status(400).json({ error: "title and message are required" });
    const id = randomUUID();
    const [notif] = await db.insert(notifications).values({
      id,
      title,
      message,
      type: type || "info",
      active: true,
    }).returning();
    res.status(201).json(notif);
  });

  app.put("/api/admin/notifications/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { title, message, type, active } = req.body;
    const [notif] = await db.update(notifications)
      .set({
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(type !== undefined && { type }),
        ...(active !== undefined && { active }),
      })
      .where(eq(notifications.id, req.params.id))
      .returning();
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json(notif);
  });

  app.delete("/api/admin/notifications/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await db.delete(notifications).where(eq(notifications.id, req.params.id));
    res.json({ success: true });
  });

  /* ═══════════════════════════════════════════════════════════
     BOT REGISTRATION
  ════════════════════════════════════════════════════════════ */

  const botRegLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 5, message: { error: "Bot registration limit reached for today." } });

  /* Fetch app.json config from a GitHub repo */
  app.get("/api/bot-registrations/fetch-config", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });

    const { repo } = req.query as { repo?: string };
    if (!repo) return res.status(400).json({ error: "repo query parameter is required" });

    try {
      // Extract owner/repo from GitHub URL
      const match = repo.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/);
      if (!match) return res.status(400).json({ error: "Invalid GitHub repository URL" });

      const repoPath = match[1];
      let appJson: Record<string, any> | null = null;

      // Try main branch first, then master
      for (const branch of ["main", "master"]) {
        try {
          const r = await fetch(`https://raw.githubusercontent.com/${repoPath}/${branch}/app.json`);
          if (r.ok) {
            appJson = await r.json();
            break;
          }
        } catch (_) {}
      }

      if (!appJson) {
        return res.json({ found: false, message: "No app.json found. Fill in details manually." });
      }

      res.json({
        found: true,
        name: appJson.name || "",
        description: appJson.description || "",
        keywords: Array.isArray(appJson.keywords) ? appJson.keywords.slice(0, 10) : [],
        env: appJson.env || {},
        logo: appJson.image || null,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch repository configuration" });
    }
  });

  /* Submit a bot registration — costs 10 coins, grants 5-coin reward expiring in 7 days */
  app.post("/api/bot-registrations", botRegLimiter, async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });

    const { name, description, repository, logo, keywords, category, env, developerName, pairSiteUrl } = req.body;
    if (!name || !description || !repository) {
      return res.status(400).json({ error: "name, description, and repository are required" });
    }
    if (!/^https?:\/\/.+/.test(repository)) {
      return res.status(400).json({ error: "repository must be a valid URL" });
    }

    const deductResult = await deductCoins(uid, 10);
    if (!deductResult.ok) {
      return res.status(402).json({ error: "Insufficient coins. You need 10 coins to register a bot.", balance: deductResult.balance, required: 10 });
    }

    const rewardExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [reg] = await db.insert(botRegistrations).values({
      userId: uid,
      developerName: developerName?.trim().slice(0, 100) || null,
      pairSiteUrl: pairSiteUrl?.trim().slice(0, 500) || null,
      name: name.trim().slice(0, 100),
      description: description.trim().slice(0, 1000),
      repository: repository.trim().slice(0, 500),
      logo: logo?.trim().slice(0, 500) || null,
      keywords: Array.isArray(keywords) ? keywords.slice(0, 10).map((k: string) => String(k).slice(0, 50)) : [],
      category: category || "WhatsApp Bot",
      env: env || {},
      status: "pending",
      rewardClaimed: false,
      rewardExpiresAt,
    }).returning();

    // Notify admin about new registration
    await db.insert(notifications).values({
      id: randomUUID(),
      title: `[ADMIN] New Bot Registration: ${name.trim().slice(0, 50)}`,
      message: `Developer ${developerName || uid.slice(0, 8)} submitted "${name.trim()}" for review. Check the Wolf Panel > Bot Registrations tab.`,
      type: "info",
      active: false,
    }).onConflictDoNothing();

    res.status(201).json(reg);
  });

  /* Get current user's bot registrations */
  app.get("/api/bot-registrations", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    const regs = await db.select().from(botRegistrations)
      .where(eq(botRegistrations.userId, uid))
      .orderBy(desc(botRegistrations.createdAt));
    res.json(regs);
  });

  /* Redeem the 5-coin reward for an approved registration */
  app.post("/api/bot-registrations/:id/redeem", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });

    const [reg] = await db.select().from(botRegistrations)
      .where(and(eq(botRegistrations.id, req.params.id), eq(botRegistrations.userId, uid)));

    if (!reg) return res.status(404).json({ error: "Registration not found" });
    if (reg.status !== "approved") return res.status(400).json({ error: "Bot must be approved before claiming reward" });
    if (reg.rewardClaimed) return res.status(400).json({ error: "Reward already claimed" });
    if (reg.rewardExpiresAt && new Date() > reg.rewardExpiresAt) {
      return res.status(410).json({ error: "Reward has expired" });
    }

    const balance = await creditCoins(uid, 5);
    await db.update(botRegistrations).set({ rewardClaimed: true }).where(eq(botRegistrations.id, reg.id));

    res.json({ success: true, coinsEarned: 5, balance });
  });

  /* ── Admin: Bot Registrations ────────────────────────────── */
  app.get("/api/admin/bot-registrations", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const regs = await db.select().from(botRegistrations).orderBy(desc(botRegistrations.createdAt));
    res.json(regs);
  });

  app.put("/api/admin/bot-registrations/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { status, reviewNotes } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [reg] = await db.update(botRegistrations)
      .set({ status, reviewNotes: reviewNotes || null, reviewedAt: new Date() })
      .where(eq(botRegistrations.id, req.params.id))
      .returning();

    if (!reg) return res.status(404).json({ error: "Registration not found" });

    if (status === "approved") {
      const exists = await db.select().from(platformBots).where(eq(platformBots.id, reg.id));
      if (exists.length === 0) {
        await db.insert(platformBots).values({
          id: reg.id,
          name: reg.name,
          description: reg.description,
          repository: reg.repository,
          logo: reg.logo || null,
          keywords: reg.keywords,
          category: reg.category || "WhatsApp Bot",
          stars: 0,
          env: (reg.env as any) || {},
          active: true,
        }).onConflictDoNothing();
      }
    }

    res.json(reg);
  });

  app.delete("/api/admin/bot-registrations/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await db.delete(botRegistrations).where(eq(botRegistrations.id, req.params.id));
    res.json({ success: true });
  });

  /* ═══════════════════════════════════════════════════════════
     USER COMMENTS (private — admin-only visible)
  ════════════════════════════════════════════════════════════ */

  const commentLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: "Comment limit reached. Try again in an hour." } });

  app.post("/api/comments", commentLimiter, async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });

    const { subject, message } = req.body;
    if (!message || String(message).trim().length < 5) {
      return res.status(400).json({ error: "Message must be at least 5 characters" });
    }

    const [comment] = await db.insert(userComments).values({
      userId: uid,
      subject: subject ? String(subject).trim().slice(0, 200) : null,
      message: String(message).trim().slice(0, 2000),
    }).returning();

    res.status(201).json(comment);
  });

  app.get("/api/admin/comments", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const comments = await db.select().from(userComments).orderBy(desc(userComments.createdAt));
    res.json(comments);
  });

  app.delete("/api/admin/comments/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await db.delete(userComments).where(eq(userComments.id, req.params.id));
    res.json({ success: true });
  });

  /* ═══════════════════════════════════════════════════════════
     PUBLIC CHAT (toggleable by admin)
  ════════════════════════════════════════════════════════════ */

  async function isChatEnabled(): Promise<boolean> {
    const rows = await db.select().from(platformSettings).where(eq(platformSettings.key, "chat_enabled"));
    return rows[0]?.value !== "false";
  }

  const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: { error: "Sending messages too fast. Please slow down." } });

  app.get("/api/chat/status", async (_req, res) => {
    res.json({ enabled: await isChatEnabled() });
  });

  app.get("/api/chat/messages", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    if (!(await isChatEnabled())) return res.json({ messages: [], enabled: false });

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const since = req.query.since ? new Date(String(req.query.since)) : null;

    const rows = since
      ? await db.select().from(chatMessages)
          .where(gt(chatMessages.createdAt, since))
          .orderBy(desc(chatMessages.createdAt))
          .limit(limit)
      : await db.select().from(chatMessages)
          .orderBy(desc(chatMessages.createdAt))
          .limit(limit);

    res.json({ messages: rows.reverse(), enabled: true });
  });

  app.post("/api/chat/messages", chatLimiter, async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    if (!(await isChatEnabled())) return res.status(403).json({ error: "Public chat is currently disabled" });

    const { message, username } = req.body;
    if (!message || String(message).trim().length < 1) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }
    if (String(message).trim().length > 500) {
      return res.status(400).json({ error: "Message too long (max 500 chars)" });
    }

    const [msg] = await db.insert(chatMessages).values({
      userId: uid,
      username: String(username || "Anonymous").trim().slice(0, 50),
      message: String(message).trim(),
    }).returning();

    res.status(201).json(msg);
  });

  app.delete("/api/admin/chat/messages/:id", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await db.delete(chatMessages).where(eq(chatMessages.id, req.params.id));
    res.json({ success: true });
  });

  app.post("/api/admin/chat/clear", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await db.delete(chatMessages);
    res.json({ success: true });
  });

  /* ═══════════════════════════════════════════════════════════
     IP REGISTRATION — one email per IP enforcement
  ════════════════════════════════════════════════════════════ */
  app.post("/api/auth/register-ip", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });

      const ip = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
      const existing = await db.select().from(ipRegistrations).where(eq(ipRegistrations.ipAddress, ip));

      if (existing.length > 0 && existing[0].userId !== userId) {
        // Another account already registered from this IP
        return res.status(409).json({
          error: "An account is already registered from this location. Only one account per IP is allowed.",
          blocked: true,
        });
      }

      if (existing.length === 0) {
        await db.insert(ipRegistrations).values({ ipAddress: ip, userId }).onConflictDoNothing();
      }

      res.json({ ok: true, ip });
    } catch {
      res.status(500).json({ error: "IP registration failed" });
    }
  });

  /* ── Platform settings ───────────────────────────────────── */
  app.get("/api/admin/settings", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const settings = await db.select().from(platformSettings);
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json(map);
  });

  app.put("/api/admin/settings/:key", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value is required" });

    await db.insert(platformSettings)
      .values({ key: req.params.key, value: String(value) })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: String(value), updatedAt: new Date() } });

    res.json({ key: req.params.key, value: String(value) });
  });

  return httpServer;
}
