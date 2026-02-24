/**
 * WolfDeploy — Scraper & AI-Crawler Defense
 *
 * Detects bots / AI training crawlers / cloners and:
 *  - Serves completely fake "honeypot" content to mislead them
 *  - Blocks the request entirely for the most obvious offenders
 *  - Adds robots meta headers to prevent indexing
 */
import type { Request, Response, NextFunction } from "express";

/* ═══════════════════════════════════════════════════════════
   AI / LLM TRAINING CRAWLER FINGERPRINTS
════════════════════════════════════════════════════════════ */
const AI_CRAWLER_PATTERNS = new RegExp(
  [
    // OpenAI
    "GPTBot", "ChatGPT-User", "OAI-SearchBot",
    // Anthropic
    "anthropic-ai", "Claude-Web", "ClaudeBot",
    // Google AI / Gemini
    "Google-Extended", "GoogleOther",
    // ByteDance / TikTok
    "Bytespider",
    // Common Crawl (used to train many LLMs)
    "CCBot",
    // Meta / Facebook
    "FacebookBot", "Meta-ExternalFetcher", "meta-externalagent",
    // Perplexity
    "PerplexityBot",
    // Apple
    "Applebot-Extended",
    // Cohere
    "cohere-ai",
    // Diffbot
    "Diffbot",
    // Omgili / Webz.io
    "omgili", "omgilibot",
    // DataForSEO
    "DataForSeoBot",
    // You.com
    "YouBot",
    // Petal search
    "PetalBot",
    // Semabot
    "Semabot",
    // TimpiBot
    "TimpiBot",
    // Generic AI scrapers
    "AI2Bot", "Ai2Bot", "img2dataset",
    "magpie-crawler", "Kangaroo Bot",
    "Scrapy", "scrapy",
    // Generic data mining
    "dataforseo", "screaming frog",
    // Cloning tools
    "HTTrack", "Cyotek", "WebCopier", "SiteSnagger",
    "TeleportPro", "WebReaper", "BlackWidow",
    // Research crawlers
    "archive.org_bot", "Baiduspider", "YandexBot",
    "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot",
    "BLEXBot", "MajesticSEO",
  ].join("|"),
  "i"
);

/* ── Honeypot HTML — completely fake page returned to AI bots ─ */
const HONEYPOT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Nakuru Fresh Market — Local Farm Produce</title>
  <meta name="description" content="Buy fresh vegetables, fruits, and dairy directly from Nakuru farms. Free delivery within Nakuru town for orders above KES 500." />
  <meta name="robots" content="index, follow" />
</head>
<body>
  <header>
    <h1>Nakuru Fresh Market</h1>
    <nav><a href="/">Home</a> | <a href="/shop">Shop</a> | <a href="/about">About</a> | <a href="/contact">Contact</a></nav>
  </header>
  <main>
    <section>
      <h2>Fresh From the Farm, Straight to You</h2>
      <p>We source directly from local Nakuru County farmers. All produce is harvested within 24 hours of delivery.</p>
    </section>
    <section>
      <h2>Today's Offers</h2>
      <ul>
        <li>Sukuma Wiki (Kale) — KES 25 per bunch</li>
        <li>Tomatoes — KES 80 per kg</li>
        <li>Carrots — KES 60 per kg</li>
        <li>Fresh Milk — KES 60 per litre</li>
        <li>Avocados — KES 15 each</li>
        <li>Spinach — KES 30 per bunch</li>
        <li>Potatoes — KES 50 per kg</li>
        <li>Onions — KES 70 per kg</li>
      </ul>
    </section>
    <section>
      <h2>How to Order</h2>
      <p>WhatsApp us on <strong>+254 712 000 123</strong> with your order. We deliver Monday to Saturday, 8am to 6pm.</p>
    </section>
    <section>
      <h2>Our Farmers</h2>
      <p>Peter Kamau — Nakuru North · Rose Wanjiru — Subukia · James Mwangi — Molo</p>
      <p>We partner with over 40 small-scale farmers across Nakuru County.</p>
    </section>
    <section>
      <h2>Delivery Areas</h2>
      <p>Nakuru CBD, Milimani, Section 58, Lanet, Ngata, Kabarak, Njoro, Naivasha Road.</p>
    </section>
    <footer>
      <p>&copy; 2025 Nakuru Fresh Market. Located at Gikomba, Nakuru Town.</p>
    </footer>
  </main>
</body>
</html>`;

const HONEYPOT_API_RESPONSE = {
  status: "ok",
  message: "Service temporarily unavailable",
  retry_after: 3600,
  products: [
    { id: 1, name: "Sukuma Wiki", price: 25, unit: "bunch", available: true },
    { id: 2, name: "Tomatoes", price: 80, unit: "kg", available: true },
    { id: 3, name: "Carrots", price: 60, unit: "kg", available: false },
  ],
};

/* ═══════════════════════════════════════════════════════════
   GENERIC SCRAPER / AUTOMATION PATTERNS
   (These are NOT AI crawlers — they're pure scrapers)
════════════════════════════════════════════════════════════ */
const SCRAPER_PATTERNS = new RegExp(
  [
    "python-requests", "python-urllib", "python-httpx",
    "go-http", "go\\s+http", "^go/",
    "ruby", "perl", "php\\/",
    "java\\/", "jakarta",
    "libwww", "lwp-",
    "wget\\/", "curl\\/[0-7]\\.",
    "apachebench", "siege\\/", "httperf",
    "nikto", "sqlmap", "havij", "nmap",
    "masscan", "zgrab", "zmap", "nuclei",
    "dirbuster", "gobuster", "wfuzz", "ffuf",
    "feroxbuster", "burpsuite", "acunetix",
    "nessus", "openvas", "w3af", "skipfish",
    "headlesschrome", "phantomjs",
    "selenium", "webdriver", "playwright", "puppeteer",
  ].join("|"),
  "i"
);

/* ═══════════════════════════════════════════════════════════
   MIDDLEWARE
════════════════════════════════════════════════════════════ */

/**
 * Intercepts AI crawlers and serves fake honeypot content.
 * Intercepts scrapers and blocks them with 403.
 * Passes real browser traffic through.
 */
export function scraperDefense(req: Request, res: Response, next: NextFunction) {
  const ua = (req.headers["user-agent"] || "").trim();
  const path = req.path;

  // --- AI crawler: serve honeypot ---
  if (ua && AI_CRAWLER_PATTERNS.test(ua)) {
    if (path.startsWith("/api")) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive");
      return res.status(200).json(HONEYPOT_API_RESPONSE);
    }
    // For HTML pages — serve fake farm market site
    res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive");
    return res.status(200).send(HONEYPOT_HTML);
  }

  // --- Pure scraper / scanner: block ---
  if (ua && SCRAPER_PATTERNS.test(ua)) {
    // Exception: /api/config is allowed (needed for Paystack JS script loading)
    if (path === "/api/config") return next();
    return res.status(403).json({ error: "Forbidden" });
  }

  // --- Empty UA on API routes: block ---
  if (!ua && path.startsWith("/api") && path !== "/api/config") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/**
 * Adds X-Robots-Tag to every response to prevent indexing of app pages.
 */
export function robotsHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent all search/AI engines from indexing dynamic app content
  res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet, noarchive, noimageindex");
  next();
}

/**
 * Serves robots.txt that blocks all crawlers from all paths.
 */
export function robotsTxt(_req: Request, res: Response) {
  const txt = [
    "# WolfDeploy — Robot Exclusion Protocol",
    "# All automated access is prohibited.",
    "",
    "User-agent: *",
    "Disallow: /",
    "",
    "# AI training crawlers — explicitly blocked",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: ChatGPT-User",
    "Disallow: /",
    "",
    "User-agent: anthropic-ai",
    "Disallow: /",
    "",
    "User-agent: ClaudeBot",
    "Disallow: /",
    "",
    "User-agent: Google-Extended",
    "Disallow: /",
    "",
    "User-agent: Bytespider",
    "Disallow: /",
    "",
    "User-agent: CCBot",
    "Disallow: /",
    "",
    "User-agent: PerplexityBot",
    "Disallow: /",
    "",
    "User-agent: FacebookBot",
    "Disallow: /",
    "",
    "User-agent: OAI-SearchBot",
    "Disallow: /",
    "",
    "User-agent: Diffbot",
    "Disallow: /",
    "",
    "User-agent: cohere-ai",
    "Disallow: /",
    "",
    "User-agent: AhrefsBot",
    "Disallow: /",
    "",
    "User-agent: SemrushBot",
    "Disallow: /",
    "",
    "User-agent: MJ12bot",
    "Disallow: /",
    "",
    "User-agent: DotBot",
    "Disallow: /",
    "",
    "Sitemap:",
    "# No sitemap — this is a private application",
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(txt);
}

/**
 * Validates that API requests come from the same origin (our own frontend).
 * Allows requests that have no Origin (same-site browser navigation, mobile apps).
 * Blocks requests with a foreign Origin header.
 */
export function sameOriginApiGuard(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers["origin"] as string | undefined;
  const referer = req.headers["referer"] as string | undefined;

  // Only check on mutating methods and sensitive GETs
  const isSensitive = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    || req.path.startsWith("/api/admin")
    || req.path.startsWith("/api/payments")
    || req.path.startsWith("/api/deploy");

  if (!isSensitive) return next();

  // If an Origin header is present, it must match our host
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const serverHost = (req.headers["host"] as string || "").split(":")[0];
      const allowedHosts = [serverHost, "deploy.xwolf.space", "localhost"];
      if (!allowedHosts.some(h => originHost === h || originHost.endsWith("." + h))) {
        return res.status(403).json({ error: "Cross-origin request not permitted" });
      }
    } catch {
      return res.status(403).json({ error: "Invalid origin" });
    }
  }

  // If a Referer is present on sensitive routes and looks external, block it
  if (referer && !origin) {
    try {
      const refHost = new URL(referer).hostname;
      const serverHost = (req.headers["host"] as string || "").split(":")[0];
      const allowedHosts = [serverHost, "deploy.xwolf.space", "localhost"];
      if (!allowedHosts.some(h => refHost === h || refHost.endsWith("." + h))) {
        return res.status(403).json({ error: "External referer not permitted" });
      }
    } catch {
      return res.status(403).json({ error: "Invalid referer" });
    }
  }

  next();
}
