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

// Trust proxy — required for rate limiting + IP detection behind Replit/nginx proxy
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/* ═══════════════════════════════════════════════════════════
   SECURITY HEADERS (Helmet hardened)
════════════════════════════════════════════════════════════ */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.paystack.co"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://api.paystack.co",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "https://raw.githubusercontent.com",
        ],
        frameSrc: ["'self'", "https://js.paystack.co", "https://checkout.paystack.com"],
        frameAncestors: ["'none'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        mediaSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HTTP Strict Transport Security: force HTTPS for 1 year
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Prevent clickjacking
    frameguard: { action: "deny" },
    // Remove X-Powered-By: Express
    hidePoweredBy: true,
    // XSS filter for legacy browsers
    xssFilter: true,
    // Control cross-domain policy
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    // Referrer policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    dnsPrefetchControl: { allow: false },
  })
);

// Additional security headers not covered by helmet
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // Prevent caching of sensitive API responses
  if (_req.path.startsWith("/api") && _req.path !== "/api/config") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

/* ═══════════════════════════════════════════════════════════
   CORS — API only accepts same-origin by default
════════════════════════════════════════════════════════════ */
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;

  // In production, reject cross-origin API requests that aren't from the same host
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return res.status(403).json({ error: "Cross-origin API access not allowed" });
      }
    } catch (_) {
      return res.status(403).json({ error: "Invalid origin" });
    }
  }
  next();
});

/* ═══════════════════════════════════════════════════════════
   BOT / SCRAPER BLOCKING — broad UA pattern list
════════════════════════════════════════════════════════════ */
const BLOCKED_AGENTS = new RegExp(
  [
    // Scrapers & crawlers
    "scrapy", "python-requests", "python-urllib", "python-httpx",
    "go-http", "go http", "go/", "ruby", "perl",
    "php/", "java/", "jakarta",
    // Security scanners
    "masscan", "nmap", "nikto", "sqlmap", "havij",
    "zgrab", "zmap", "masscan", "nuclei", "dirbuster",
    "gobuster", "wfuzz", "ffuf", "feroxbuster",
    "burpsuite", "burp suite", "acunetix", "nessus",
    "openvas", "w3af", "skipfish",
    // Generic bots
    "libwww", "lwp-", "httpclient",
    "apachebench", "ab/", "siege/",
    "wget/", "httrack", "webcopier",
    "curl/7\\.[0-4]",
    // Headless browsers when used for scraping
    "headlesschrome", "phantomjs", "selenium", "webdriver",
    "playwright", "puppeteer",
    // Empty UA
  ].join("|"),
  "i"
);

app.use((req, res, next) => {
  const ua = (req.headers["user-agent"] || "").trim();

  // Block empty user agents on API routes
  if (!ua && req.path.startsWith("/api") && req.path !== "/api/config") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (ua && BLOCKED_AGENTS.test(ua)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
});

/* ═══════════════════════════════════════════════════════════
   MALICIOUS PAYLOAD DETECTION
   Blocks obvious path traversal, SQLi, XSS in URL/query
════════════════════════════════════════════════════════════ */
const MALICIOUS_PATTERNS = [
  // Path traversal
  /\.\.[/\\]/,
  /%2e%2e[/\\%]/i,
  // Null byte injection
  /\x00|%00/,
  // SQL injection patterns in URLs
  /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b|\bdrop\b.*\btable\b|\binsert\b.*\binto\b)/i,
  // Common XSS patterns in query strings
  /<script[\s>]/i,
  /javascript:/i,
  /vbscript:/i,
  // Server-Side Template Injection
  /\{\{.*\}\}/,
  /\{%.*%\}/,
  // SSRF / open redirect attempts
  /127\.0\.0\.1|localhost|0\.0\.0\.0|169\.254\.|::1/i,
];

app.use((req, res, next) => {
  const toCheck = decodeURIComponent(req.url);
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(toCheck)) {
      return res.status(400).json({ error: "Invalid request" });
    }
  }
  next();
});

/* ═══════════════════════════════════════════════════════════
   CONTENT-TYPE ENFORCEMENT for mutating API endpoints
════════════════════════════════════════════════════════════ */
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const ct = req.headers["content-type"] || "";
    if (!ct.includes("application/json") && !ct.includes("multipart/form-data") && !ct.includes("application/x-www-form-urlencoded")) {
      return res.status(415).json({ error: "Unsupported Media Type. Use application/json." });
    }
  }
  next();
});

/* ═══════════════════════════════════════════════════════════
   RATE LIMITING
════════════════════════════════════════════════════════════ */

// Global: 150 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  skip: (req) => req.path === "/api/config",
});
app.use(globalLimiter);

// Progressive slowdown: starts delaying after 60 req / 15 min
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 60,
  delayMs: (used) => (used - 60) * 150,
});
app.use("/api", speedLimiter);

// Auth: 15 attempts / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many auth attempts. Try again later." },
  skipSuccessfulRequests: false,
});
app.use("/api/auth", authLimiter);

// Payments: 10 req / hour
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many payment requests. Try again in an hour." },
});
app.use("/api/payments", paymentLimiter);

// Deploy: 5 req / hour (was 10, tightened)
const deployLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many deployment requests. Try again in an hour." },
});
app.use("/api/deploy", deployLimiter);

// Admin: 100 req / 15 min (admins make many requests but still need limits)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Admin request limit reached." },
});
app.use("/api/admin", adminLimiter);

/* ═══════════════════════════════════════════════════════════
   BODY PARSING (strict size limits)
════════════════════════════════════════════════════════════ */
app.use(
  express.json({
    limit: "128kb",
    strict: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

/* ═══════════════════════════════════════════════════════════
   REQUEST LOGGING
════════════════════════════════════════════════════════════ */
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
      // Don't log sensitive response bodies
      const isSensitivePath = path.includes("/auth") || path.includes("/payments") || path.includes("/coins");
      if (capturedJsonResponse && !isSensitivePath) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

/* ═══════════════════════════════════════════════════════════
   HONEYPOT ENDPOINTS — silence common scanner paths
════════════════════════════════════════════════════════════ */
const honeypotPaths = [
  "/admin", "/wp-admin", "/wp-login.php", "/wp-config.php",
  "/phpmyadmin", "/administrator", "/manager",
  "/.env", "/.env.local", "/.env.production", "/.git/config",
  "/config.php", "/configuration.php", "/settings.php",
  "/backup.sql", "/db.sql", "/database.sql",
  "/shell.php", "/cmd.php", "/webshell.php",
  "/cgi-bin/bash", "/cgi-bin/sh",
  "/actuator", "/actuator/env", "/actuator/health",
  "/api/v1/debug", "/api/debug", "/debug",
  "/.DS_Store", "/thumbs.db",
];
honeypotPaths.forEach((p) => {
  app.all(p, (_req, res) => res.status(404).end());
});

/* ═══════════════════════════════════════════════════════════
   APP BOOTSTRAP
════════════════════════════════════════════════════════════ */
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
    // Never expose internal error details to clients
    const message = status < 500 ? (err.message || "Bad Request") : "Internal Server Error";
    if (status >= 500) console.error("Internal Server Error:", err);
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
