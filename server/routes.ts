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
} from "@shared/schema";
import { deployRequestSchema } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

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

async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
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
      const balance = await getBalance(req.params.userId);
      res.json({ balance });
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

  /* ── Admin: promote self (first-run if no admins exist) ─── */
  app.post("/api/admin/promote", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(400).json({ error: "No user ID" });
    const existing = await db.select().from(adminUsers);
    if (existing.length > 0) {
      return res.status(403).json({ error: "Admins already exist. Contact an existing admin." });
    }
    await db.insert(adminUsers).values({ userId: uid }).onConflictDoNothing();
    res.json({ success: true, message: "You are now an admin." });
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

  return httpServer;
}
