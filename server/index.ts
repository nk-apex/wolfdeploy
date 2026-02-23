import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { adminUsers } from "@shared/schema";
import { storage } from "./storage";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/* ── Security headers ────────────────────────────────────── */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.paystack.co"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.paystack.co", "https://*.supabase.co", "wss://*.supabase.co"],
        frameSrc: ["'self'", "https://js.paystack.co", "https://checkout.paystack.com"],
        fontSrc: ["'self'", "data:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

/* ── Block obvious scrapers / bots ───────────────────────── */
const BLOCKED_AGENTS = /scrapy|python-requests|go-http|masscan|nmap|libwww|zgrab|curl\/7\.[0-4]/i;
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (BLOCKED_AGENTS.test(ua) && !req.path.startsWith("/api/config")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

/* ── Global rate limit — 200 req / 15 min per IP ────────── */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => req.path === "/api/config",
});
app.use(globalLimiter);

/* ── Slow-down: progressively delay after 80 req / 15 min ── */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 80,
  delayMs: (used) => (used - 80) * 100,
});
app.use("/api", speedLimiter);

/* ── Auth endpoints: stricter rate limit ─────────────────── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many auth attempts, please try again later." },
});
app.use("/api/auth", authLimiter);

/* ── Payment endpoints: strict rate limit ────────────────── */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: "Too many payment requests. Try again in an hour." },
});
app.use("/api/payments", paymentLimiter);

/* ── Deploy endpoints: rate limit ────────────────────────── */
const deployLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many deployment requests. Try again in an hour." },
});
app.use("/api/deploy", deployLimiter);

/* ── Body parsing (with size limits) ────────────────────── */
app.use(
  express.json({
    limit: "256kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "256kb" }));

/* ── Request logging ─────────────────────────────────────── */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

/* ── Honeypot endpoints to catch scanners ────────────────── */
const honeypotPaths = ["/admin", "/wp-admin", "/phpmyadmin", "/administrator", "/.env", "/config.php"];
honeypotPaths.forEach((p) => {
  app.get(p, (_req, res) => res.status(404).end());
});

(async () => {
  const adminIds = process.env.ADMIN_USER_IDS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
  for (const userId of adminIds) {
    await db.insert(adminUsers).values({ userId }).onConflictDoNothing();
  }
  if (adminIds.length > 0) {
    console.log(`[admin] Seeded ${adminIds.length} admin user(s) from ADMIN_USER_IDS`);
  }

  await storage.initialize();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
