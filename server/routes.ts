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
  userProfiles,
} from "@shared/schema";
import { deployRequestSchema } from "@shared/schema";
import { eq, desc, sql, and, gt } from "drizzle-orm";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";

/* ── Input helpers ──────────────────────────────────────── */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}

/** Strip HTML/script tags and null bytes from a string */
function sanitize(s: unknown, maxLen = 1000): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\x00/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, maxLen);
}

/* Plans: trial = 5 coins / 7 days | monthly = 100 coins / 30 days */
const PLAN_COST = { trial: 5, monthly: 100 };
const PLAN_DAYS = { trial: 7, monthly: 30 };
const MIN_COINS_TO_DEPLOY = 5;

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

/* ── Supabase Admin API helpers ────────────────────────────
   Use the service role key to hit the Supabase Auth Admin API
   This avoids the broken direct-DB pg connection issue.
══════════════════════════════════════════════════════════ */
type SupabaseAuthUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
};

async function fetchSupabaseUsers(): Promise<SupabaseAuthUser[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return [];

  const allUsers: SupabaseAuthUser[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    try {
      const r = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?per_page=${perPage}&page=${page}`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
      );
      if (!r.ok) {
        console.warn("[supabase] Admin API error:", r.status, await r.text());
        break;
      }
      const data = await r.json() as { users?: SupabaseAuthUser[]; total?: number };
      if (!data.users || data.users.length === 0) break;
      allUsers.push(...data.users);
      if (data.users.length < perPage) break;
      page++;
    } catch (e) {
      console.warn("[supabase] fetchSupabaseUsers error:", e);
      break;
    }
  }
  return allUsers;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  /* ── Auto-register all users ─────────────────────────────
     Any authenticated API request ensures a user_coins row AND a users
     row exists so all users appear in the admin panel automatically. */
  const seenUsers = new Set<string>();
  app.use(async (req, _res, next) => {
    const uid = getUserId(req);
    if (uid && isValidUUID(uid) && !seenUsers.has(uid)) {
      seenUsers.add(uid);
      Promise.all([
        db.insert(userCoins).values({ userId: uid, balance: 0 }).onConflictDoNothing(),
        db.insert(userProfiles).values({ userId: uid }).onConflictDoNothing(),
      ]).catch(() => {});
    }
    next();
  });

  /* ── Public config ──────────────────────────────────────── */
  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    });
  });

  /* ── Signup via admin API — no confirmation email, no rate limit ── */
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name, country } = req.body ?? {};
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Auth service not configured." });
    }

    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          email_confirm: true,
          user_metadata: {
            full_name: typeof name === "string" ? name.trim() : "",
            country: typeof country === "string" ? country : "NG",
          },
        }),
      });

      const data = await r.json() as any;

      if (!r.ok) {
        const msg: string = data?.msg || data?.message || data?.error_description || "Signup failed.";
        if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
          return res.status(409).json({ error: "An account with this email already exists." });
        }
        return res.status(400).json({ error: msg });
      }

      return res.json({ success: true, userId: data.id });
    } catch (e: any) {
      return res.status(500).json({ error: "Could not create account. Try again later." });
    }
  });

  /* ── Bots (from DB) ─────────────────────────────────────── */
  app.get("/api/bots", async (req, res) => {
    const bots = await storage.getBots();
    const uid = getUserId(req);
    // Authenticated users get the full payload; unauthenticated get a redacted version
    if (uid) {
      return res.json(bots);
    }
    // Strip GitHub repo URLs and detailed env var info from public response
    const redacted = bots.map(({ repository: _r, env: _e, ...pub }) => pub);
    return res.json(redacted);
  });

  app.get("/api/bots/:id", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });
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
  app.get("/api/deployments", async (req, res) => {
    const uid = getUserId(req);
    // Only return deployments belonging to the requesting user
    const deployments = await storage.getDeployments(uid || undefined);
    res.json(deployments);
  });

  app.get("/api/deployments/:id", async (req, res) => {
    const uid = getUserId(req);
    const deployment = await storage.getDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    // Users can only see their own deployments (admins bypass this via /api/admin/deployments)
    if (uid && deployment.userId && deployment.userId !== uid) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(deployment);
  });

  app.get("/api/deployments/:id/logs", async (req, res) => {
    const uid = getUserId(req);
    const deployment = await storage.getDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    if (uid && deployment.userId && deployment.userId !== uid) {
      return res.status(403).json({ error: "Access denied" });
    }
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
      if (!isValidUUID(uid)) return res.status(400).json({ error: "Invalid user ID" });
      const balance = await getBalance(uid);
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

  /* ── Deploy — trial (5 coins/7 days) or monthly (100 coins/30 days) ── */
  app.post("/api/deploy", async (req, res) => {
    const result = deployRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });

    const { botId, envVars, plan } = result.data;
    const userId = getUserId(req) || undefined;
    const adminUser = userId ? await isAdmin(userId) : false;

    const cost = PLAN_COST[plan];
    const days = PLAN_DAYS[plan];

    /* Admins bypass all coin checks and deductions */
    if (!adminUser && userId) {
      const balance = await getBalance(userId);
      if (balance < cost) {
        return res.status(402).json({
          error: "Insufficient coins",
          balance,
          required: cost,
          plan,
        });
      }
    }

    const bot = await storage.getBot(botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    /* Admins get no expiry; regular users get plan-based expiry */
    const expiresAt = adminUser
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year for admins
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const deployment = await storage.createDeployment(botId, bot.name, bot.repository, envVars, userId, plan, expiresAt);

    if (!adminUser && userId) {
      await deductCoins(userId, cost);
    }

    console.log(`[deploy] ${adminUser ? "ADMIN" : "user"} ${userId} deployed ${bot.name} — ${adminUser ? "no coins deducted" : `${cost} coins deducted`}`);
    res.status(201).json(deployment);
  });

  app.post("/api/deployments/:id/stop", async (req, res) => {
    const uid = getUserId(req);
    const dep = await storage.getDeployment(req.params.id);
    if (!dep) return res.status(404).json({ error: "Deployment not found" });
    if (uid && dep.userId && dep.userId !== uid && !(await isAdmin(uid))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const balanceBefore = uid ? await getBalance(uid) : null;
    console.log(`[stop] user=${uid} dep=${req.params.id} balanceBefore=${balanceBefore} — NO coin deduction on stop`);
    const deployment = await storage.stopDeployment(req.params.id);
    res.json(deployment);
  });

  app.delete("/api/deployments/:id", async (req, res) => {
    const uid = getUserId(req);
    const dep = await storage.getDeployment(req.params.id);
    if (!dep) return res.status(404).json({ error: "Deployment not found" });
    if (uid && dep.userId && dep.userId !== uid && !(await isAdmin(uid))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const ok = await storage.deleteDeployment(req.params.id);
    if (!ok) return res.status(404).json({ error: "Deployment not found" });
    /* Deduct 5 coins from the owner for early deletion */
    if (uid) await deductCoins(uid, 5);
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
      const [[coinRows], botRows, txRows, notifRows, supabaseUsers] = await Promise.all([
        db.select({ total: sql<number>`SUM(balance)` }).from(userCoins),
        db.select().from(platformBots),
        db.select().from(paymentTransactions),
        db.select().from(notifications),
        fetchSupabaseUsers(),
      ]);

      const allDeployments = await storage.getAllDeployments();
      const successTxs = txRows.filter(t => t.status === "success");
      const totalRevenue = successTxs.reduce((sum, t) => sum + t.amount, 0);

      // Sync new users into local DB so coin balances exist
      for (const u of supabaseUsers) {
        await db.insert(userCoins).values({ userId: u.id, balance: 0 }).onConflictDoNothing();
        await db.insert(userProfiles).values({ userId: u.id, email: u.email }).onConflictDoNothing();
      }

      // Re-fetch coin total after sync
      const [freshCoin] = await db.select({ total: sql<number>`SUM(balance)` }).from(userCoins);

      res.json({
        totalUsers: supabaseUsers.length,
        totalCoinsInCirculation: Number(freshCoin?.total ?? 0),
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
      console.error("[admin/stats] error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  /* ── Admin: Users ───────────────────────────────────────── */
  app.get("/api/admin/users", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      // Supabase is the source of truth for users
      const supabaseUsers = await fetchSupabaseUsers();

      // Fetch local DB tables with individual fallbacks so a missing table never blocks the response
      const adminList = await db.select().from(adminUsers).catch(() => []);
      const coinRows = await db.select().from(userCoins).catch(() => []);
      const profileRows = await db.select().from(userProfiles).catch(() => []);

      // Sync every Supabase auth user into local DB
      for (const u of supabaseUsers) {
        await db.insert(userCoins).values({ userId: u.id, balance: 0 }).onConflictDoNothing().catch(() => {});
        await db.insert(userProfiles).values({ userId: u.id, email: u.email }).onConflictDoNothing().catch(() => {});
      }

      // Re-fetch after seeding
      const freshCoinRows = await db.select().from(userCoins).catch(() => coinRows);
      const freshUserRows = await db.select().from(userProfiles).catch(() => profileRows);

      const allDeployments = await storage.getAllDeployments();
      const adminIds = new Set(adminList.map((a: { userId: string }) => a.userId));
      const coinMap = new Map(freshCoinRows.map((c: { userId: string; balance: number }) => [c.userId, c.balance]));
      const userMap = new Map(freshUserRows.map((u: { userId: string }) => [u.userId, u]));
      const supabaseAuthMap = new Map(supabaseUsers.map(u => [u.id, u]));

      // Supabase users are always included; local-only records merged in
      const allUserIds = new Set([
        ...supabaseUsers.map(u => u.id),
        ...freshCoinRows.map((c: { userId: string }) => c.userId),
        ...freshUserRows.map((u: { userId: string }) => u.userId),
      ]);

      const usersWithMeta = Array.from(allUserIds).map(userId => {
        const meta = userMap.get(userId) as { displayName?: string | null; email?: string | null; country?: string | null; createdAt?: Date | null } | undefined;
        const authMeta = supabaseAuthMap.get(userId);
        return {
          userId,
          email: authMeta?.email ?? meta?.email ?? null,
          displayName: meta?.displayName ?? null,
          country: meta?.country ?? null,
          balance: coinMap.get(userId) ?? 0,
          isAdmin: adminIds.has(userId),
          deploymentCount: allDeployments.filter(d => d.userId === userId).length,
          runningBots: allDeployments.filter(d => d.userId === userId && d.status === "running").length,
          joinedAt: authMeta?.created_at ? new Date(authMeta.created_at) : meta?.createdAt ?? null,
          lastSignIn: authMeta?.last_sign_in_at ?? null,
        };
      }).sort((a, b) => b.balance - a.balance);

      res.json(usersWithMeta);
    } catch (e) {
      console.error("[admin/users] error:", e);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:userId", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { userId } = req.params;
    if (!isValidUUID(userId)) return res.status(400).json({ error: "Invalid user ID" });
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

  /* Fetch app.json config from a GitHub or GitLab repo */
  app.get("/api/bot-registrations/fetch-config", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });

    const { repo } = req.query as { repo?: string };
    if (!repo) return res.status(400).json({ error: "repo query parameter is required" });

    try {
      let appJson: Record<string, any> | null = null;

      const ghMatch = repo.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/);
      const glMatch = repo.match(/gitlab\.com\/([^/]+(?:\/[^/]+)+?)(?:\.git)?(?:\/.*)?$/);

      if (ghMatch) {
        const repoPath = ghMatch[1];
        for (const branch of ["main", "master"]) {
          try {
            const r = await fetch(`https://raw.githubusercontent.com/${repoPath}/${branch}/app.json`);
            if (r.ok) { appJson = await r.json(); break; }
          } catch (_) {}
        }
      } else if (glMatch) {
        const repoPath = glMatch[1];
        const encoded = encodeURIComponent(repoPath);
        for (const branch of ["main", "master"]) {
          try {
            const r = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/repository/files/app.json/raw?ref=${branch}`);
            if (r.ok) { appJson = await r.json(); break; }
          } catch (_) {}
        }
      } else {
        return res.status(400).json({ error: "Invalid repository URL. Supported: GitHub and GitLab." });
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
        logo: appJson.logo || appJson.image || null,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch repository configuration" });
    }
  });

  /* Submit a bot registration — trial: 5 coins/7 days | monthly: 100 coins/30 days */
  app.post("/api/bot-registrations", botRegLimiter, async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });

    const { name, description, repository, logo, keywords, category, env, developerName, pairSiteUrl, plan } = req.body;
    if (!name || !description || !repository) {
      return res.status(400).json({ error: "name, description, and repository are required" });
    }
    if (!/^https?:\/\/.+/.test(repository)) {
      return res.status(400).json({ error: "repository must be a valid URL" });
    }

    const selectedPlan = plan === "trial" ? "trial" : "monthly";
    const cost = selectedPlan === "trial" ? 5 : 100;
    const listingDays = selectedPlan === "trial" ? 7 : 30;

    /* ── Check balance first without deducting ── */
    const currentBalance = await getBalance(uid);
    if (currentBalance < cost) {
      return res.status(402).json({
        error: `Insufficient coins. You need ${cost} coins for the ${selectedPlan} plan.`,
        balance: currentBalance,
        required: cost,
      });
    }

    /* ── Insert registration first — deduct coins only after success ── */
    let reg: any;
    try {
      const rewardExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const listingExpiresAt = new Date(Date.now() + listingDays * 24 * 60 * 60 * 1000);

      [reg] = await db.insert(botRegistrations).values({
        userId: uid,
        developerName: sanitize(developerName, 100) || null,
        pairSiteUrl: sanitize(pairSiteUrl, 500) || null,
        name: sanitize(name, 100),
        description: sanitize(description, 1000),
        repository: sanitize(repository, 500),
        logo: sanitize(logo, 500) || null,
        keywords: Array.isArray(keywords) ? keywords.slice(0, 10).map((k: string) => sanitize(k, 50)) : [],
        category: sanitize(category, 50) || "WhatsApp Bot",
        env: env || {},
        status: "pending",
        plan: selectedPlan,
        listingExpiresAt,
        rewardClaimed: false,
        rewardExpiresAt,
      }).returning();
    } catch (err: any) {
      console.error("[bot-registrations] DB insert failed — no coins deducted:", err?.message);
      return res.status(500).json({ error: "Failed to save registration. No coins were deducted. Please try again." });
    }

    /* ── Deduct coins now that the insert succeeded ── */
    const deductResult = await deductCoins(uid, cost);
    if (!deductResult.ok) {
      /* Extremely unlikely (race condition) — roll back the registration */
      await db.delete(botRegistrations).where(eq(botRegistrations.id, reg.id)).catch(() => {});
      return res.status(402).json({
        error: `Insufficient coins. You need ${cost} coins for the ${selectedPlan} plan.`,
        balance: deductResult.balance,
        required: cost,
      });
    }

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

  /* Redeem the 100-coin reward for an approved registration */
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

    const balance = await creditCoins(uid, 100);
    await db.update(botRegistrations).set({ rewardClaimed: true }).where(eq(botRegistrations.id, reg.id));

    res.json({ success: true, coinsEarned: 100, balance });
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
      await db.insert(platformBots).values({
        id: reg.id,
        name: reg.name,
        description: reg.description,
        repository: reg.repository,
        logo: reg.logo || null,
        pairSiteUrl: reg.pairSiteUrl || null,
        keywords: reg.keywords,
        category: reg.category || "WhatsApp Bot",
        stars: 0,
        env: (reg.env as any) || {},
        active: true,
      }).onConflictDoUpdate({
        target: platformBots.id,
        set: { name: reg.name, description: reg.description, pairSiteUrl: reg.pairSiteUrl || null, active: true },
      });
    }

    res.json(reg);
  });

  /* ── Admin: update pair site URL on a registration ─────────── */
  app.patch("/api/admin/bot-registrations/:id/pair-site", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { pairSiteUrl } = req.body;
    const url = sanitize(pairSiteUrl || "", 500) || null;
    const [reg] = await db.update(botRegistrations)
      .set({ pairSiteUrl: url })
      .where(eq(botRegistrations.id, req.params.id))
      .returning();
    if (!reg) return res.status(404).json({ error: "Registration not found" });
    // Sync to platformBots if it exists there
    await db.update(platformBots).set({ pairSiteUrl: url }).where(eq(platformBots.id, reg.id));
    res.json(reg);
  });

  /* ── User: update their own pair site URL ───────────────────── */
  app.patch("/api/bot-registrations/:id/pair-site", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.status(401).json({ error: "Authentication required" });
    const { pairSiteUrl } = req.body;
    const url = sanitize(pairSiteUrl || "", 500) || null;
    const [reg] = await db.update(botRegistrations)
      .set({ pairSiteUrl: url })
      .where(and(eq(botRegistrations.id, req.params.id), eq(botRegistrations.userId, uid)))
      .returning();
    if (!reg) return res.status(404).json({ error: "Registration not found or not yours" });
    // Sync to platformBots if approved
    await db.update(platformBots).set({ pairSiteUrl: url }).where(eq(platformBots.id, reg.id));
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
      subject: subject ? sanitize(subject, 200) : null,
      message: sanitize(message, 2000),
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
      username: sanitize(username || "Anonymous", 50),
      message: sanitize(message, 500),
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

      const { email, displayName, country } = req.body;

      // Always ensure the user has a userCoins row and a users row
      await Promise.all([
        db.insert(userCoins).values({ userId, balance: 0 }).onConflictDoNothing(),
        db.insert(userProfiles).values({
          userId,
          email: email ? sanitize(email, 255) : undefined,
          displayName: displayName ? sanitize(displayName, 100) : undefined,
          country: country ? sanitize(country, 10) : undefined,
        }).onConflictDoNothing(),
      ]);

      // Update existing user record with latest info if provided
      if (email || displayName || country) {
        const updateData: Record<string, string> = {};
        if (email) updateData.email = sanitize(email, 255);
        if (displayName) updateData.displayName = sanitize(displayName, 100);
        if (country) updateData.country = sanitize(country, 10);
        await db.update(userProfiles).set(updateData).where(eq(userProfiles.userId, userId));
      }

      const ip = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
      const existing = await db.select().from(ipRegistrations).where(eq(ipRegistrations.ipAddress, ip));

      if (existing.length > 0 && existing[0].userId !== userId) {
        return res.json({ ok: true, ip, multiAccount: true });
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

  /* ═══════════════════════════════════════════════════════════
     PLAN EXPIRY CLEANUP JOB
     Checks every 30 minutes for expired deployments.
     Trial (5 coins): expires after 7 days → bot stopped + deleted
     Monthly (100 coins): expires after 30 days → bot stopped
  ════════════════════════════════════════════════════════════ */
  const EXPIRY_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  setInterval(async () => {
    try {
      const allDeployments = await storage.getAllDeployments();
      const now = Date.now();

      for (const dep of allDeployments) {
        if (dep.status !== "running" && dep.status !== "deploying") continue;
        if (!dep.expiresAt) continue;

        const expiredMs = new Date(dep.expiresAt).getTime();
        if (now < expiredMs) continue; // not expired yet

        const plan = dep.plan ?? "trial";
        await storage.addDeploymentLog(dep.id, "warn",
          `Plan expired (${plan}). Bot has been stopped automatically.`
        );
        await storage.stopDeployment(dep.id);

        if (plan === "trial") {
          // Trial bots are deleted after expiry
          await storage.deleteDeployment(dep.id);
        }

        // Notify user via platform notification
        await db.insert(notifications).values({
          id: randomUUID(),
          title: plan === "trial" ? "Trial Expired — Bot Deleted" : "Monthly Plan Expired — Bot Stopped",
          message: plan === "trial"
            ? `Your trial bot "${dep.botName}" has been deleted after 7 days. Buy 100 coins (50 KSH) to deploy for a full month.`
            : `Your monthly bot "${dep.botName}" has been stopped after 30 days. Top up to redeploy.`,
          type: "warning",
          active: true,
        }).onConflictDoNothing();

        console.log(`[expiry-job] ${plan} deployment ${dep.id} expired — ${plan === "trial" ? "deleted" : "stopped"}.`);
      }
    } catch (err) {
      console.error("[expiry-job] Error during expiry check:", err);
    }
  }, EXPIRY_CHECK_INTERVAL_MS);

  return httpServer;
}
