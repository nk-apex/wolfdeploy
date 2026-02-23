# WolfDeploy - WhatsApp Bot Deployment Platform

## Overview
A Heroku-style platform for deploying WhatsApp bots. Users sign up/log in via Supabase Auth, select from a catalog of bot templates, configure environment variables, and deploy them with real-time logs. Coin-based billing via Paystack (10 coins = 1 deployment).

## UI Style & Theming
Multi-theme system stored in localStorage, toggled via Settings → Appearance:
- **Cyberpunk** (default): pure black bg, neon green accent
- **Glassmorphism**: navy gradient bg, frosted glass panels, cyan accent + floating blobs
- **Neon Purple**: dark bg, violet/purple accent
- **Matrix**: pitch black, pale green retro terminal
Theme context: `client/src/lib/theme.tsx` → `ThemeProvider`, `useTheme()`, `getThemeTokens()`

## Pages
- `/` — Dashboard (Command Center)
- `/deploy` — Deploy Bot
- `/bots` — My Bots
- `/bots/:id/logs` — Bot Logs
- `/register-bot` — Developer Bot Registration (submit bot to catalog, earn 5-coin reward)
- `/community` — Public Chat + Private Feedback (admin-toggleable chat)
- `/billing` — Billing (Paystack, 13+ countries, local currency + mobile money)
- `/settings` — Settings (Profile, Appearance/Theme, Notifications, Security)
- `/referrals` — Referral Program (tiers, share link)
- `/wolf` — Admin Dashboard (admin-only, security through obscurity)
- `/verify` — Email verification handler (Supabase email link target)

## Architecture

### Frontend
- React + TypeScript + Tailwind CSS
- Wouter for routing
- TanStack Query for data fetching (refetch intervals for live data)
- Shadcn UI components
- `x-user-id` header sent automatically via `setCurrentUserId()` in queryClient

### Backend
- Express.js REST API
- PostgreSQL via Drizzle ORM
- In-memory deployment storage (MemStorage) for active processes
- Bot catalog stored in `platform_bots` DB table
- Security: Helmet.js, express-rate-limit, express-slow-down, bot/scraper filtering, honeypot endpoints

### Deployment Backends
Two deployment modes — automatically selected based on env config:
1. **Pterodactyl** (preferred): When `PTERODACTYL_URL` + `PTERODACTYL_API_KEY` set → creates managed game-server VPS via Pterodactyl Application API
2. **Local process** (fallback): Clones GitHub repo, runs npm install + node index.js locally

### Authentication
- Supabase Auth (email/password + email confirmation)
- Admin access: `admin_users` DB table OR `ADMIN_USER_IDS` env var (comma-separated UUIDs)
- Admin route at `/wolf` (not `/admin`) for security through obscurity

## Database Tables
- `user_coins` — userId → coin balance
- `admin_users` — userId → admin grant records
- `platform_bots` — bot catalog (id, name, description, repository, env, etc.)
- `notifications` — platform-wide announcements (title, message, type, active)
- `payment_transactions` — Paystack transaction history (userId, amount, currency, coins, status, reference)
- `deployments` — persisted deployment records (survive server restarts)
- `bot_registrations` — developer-submitted bots (pending/approved/rejected, 10-coin fee, 5-coin reward)
- `user_comments` — private user feedback (admin-only visible)
- `chat_messages` — public chat messages (admin-toggleable)
- `platform_settings` — key-value admin settings (e.g. chat_enabled)

## Bot Registration Feature
- Route: `/register-bot`
- Cost: 10 coins per submission (listing fee)
- Reward: 5 coins credited when admin approves the bot (expires 7 days after approval)
- Flow: Submit form → Admin reviews in Wolf Panel → Approved → Developer claims 5-coin reward
- Approved bots are automatically added to `platform_bots` catalog

## Community Feature
- Route: `/community`
- **Public Chat**: Real-time polling (4-second intervals), 500-char limit, admin can toggle on/off and delete messages
- **Private Feedback**: User comments visible only to admin (subject + message, up to 2000 chars)
- Admin controls chat via `/wolf` → Chat tab (enable/disable, clear all, delete individual messages)

## Security Features
- **Helmet.js**: Security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting**: Global (200 req/15min), auth (30/15min), payments (20/hr), deploy (10/hr), chat (15/min), bot registration (5/day)
- **Slow-down**: Progressive delay after 80 req/15min on all `/api` routes
- **Bot/scraper blocking**: Blocks known scraper user-agents (Scrapy, Python-requests, masscan, etc.)
- **Honeypot endpoints**: /admin, /wp-admin, /phpmyadmin etc. return 404 silently
- **Request size limits**: 256KB max body size
- **Input sanitization**: Sliced/trimmed strings, URL validation, length limits on all inputs

## Admin Dashboard (/wolf) Tabs
- **Overview**: Platform stats (users, coins, deployments, revenue, bots)
- **Users**: All users with coin balances; adjust coins, grant/revoke admin, delete user
- **Bot Catalog**: Add, toggle visibility, delete bots from catalog
- **Bot Registrations**: Review developer submissions — approve/reject with notes (auto-adds to catalog on approval)
- **Deployments**: All deployments across all users; stop/delete
- **Payments**: All Paystack transaction records
- **Feedback**: Private user comments/feedback (read + delete)
- **Chat**: Moderate public chat — toggle on/off, delete messages, clear all
- **Notifications**: Create/toggle/delete platform notifications

## API Routes

### Public / User Routes
- `GET /api/config` — Supabase public config
- `GET /api/bots` — Bot catalog (from DB)
- `GET /api/bots/:id` — Single bot
- `GET /api/deployments` — User deployments
- `POST /api/deploy` — Create deployment (deducts 10 coins)
- `POST /api/deployments/:id/stop` — Stop deployment
- `DELETE /api/deployments/:id` — Delete deployment
- `GET /api/coins/:userId` — Coin balance
- `POST /api/coins/credit` — Credit coins
- `POST /api/payments/initialize` — Paystack checkout
- `POST /api/payments/verify` — Verify + credit coins
- `POST /api/payments/mobile-charge` — Direct mobile money STK push
- `GET /api/payments/check/:reference` — Poll Paystack status
- `GET /api/notifications` — Active public notifications
- `GET/POST /api/bot-registrations` — List own registrations / submit new
- `POST /api/bot-registrations/:id/redeem` — Claim 5-coin approval reward
- `POST /api/comments` — Submit private feedback (admin-only visible)
- `GET /api/chat/status` — Is public chat enabled?
- `GET /api/chat/messages` — Get recent chat messages
- `POST /api/chat/messages` — Send chat message

### Admin Routes (require x-user-id header + admin privileges)
- `GET /api/admin/check` — Is current user admin?
- `GET /api/admin/stats` — Platform overview stats
- `GET /api/admin/users` — All users with metadata
- `DELETE /api/admin/users/:id` — Delete user + their deployments
- `POST /api/admin/users/:id/grant-admin` — Grant admin role
- `DELETE /api/admin/users/:id/revoke-admin` — Revoke admin role
- `POST /api/admin/users/:id/adjust-coins` — Adjust user coin balance
- `GET/POST /api/admin/bots` — List/create bots
- `PUT/DELETE /api/admin/bots/:id` — Update/delete bot
- `GET /api/admin/payments` — All payment transactions
- `GET /api/admin/deployments` — All deployments (all users)
- `POST/DELETE /api/admin/deployments/:id/stop` — Admin force-stop/delete
- `GET/POST/PUT/DELETE /api/admin/notifications` — Manage notifications
- `GET /api/admin/bot-registrations` — All bot registration submissions
- `PUT /api/admin/bot-registrations/:id` — Review (approve/reject) registration
- `DELETE /api/admin/bot-registrations/:id` — Delete registration
- `GET /api/admin/comments` — All private user feedback
- `DELETE /api/admin/comments/:id` — Delete a comment
- `DELETE /api/admin/chat/messages/:id` — Delete a chat message
- `POST /api/admin/chat/clear` — Clear all chat messages
- `GET /api/admin/settings` — All platform settings (key-value)
- `PUT /api/admin/settings/:key` — Update a platform setting

## Supabase Tables SQL (for VPS deployment)
Run this in the Supabase SQL Editor after initial setup:
```sql
CREATE TABLE IF NOT EXISTS "bot_registrations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "name" varchar NOT NULL,
  "description" text NOT NULL,
  "repository" varchar NOT NULL,
  "logo" varchar,
  "keywords" text[] NOT NULL DEFAULT '{}',
  "category" varchar DEFAULT 'WhatsApp Bot',
  "env" jsonb NOT NULL DEFAULT '{}',
  "status" varchar NOT NULL DEFAULT 'pending',
  "reward_claimed" boolean DEFAULT false,
  "reward_expires_at" timestamp,
  "review_notes" text,
  "created_at" timestamp DEFAULT now(),
  "reviewed_at" timestamp
);
CREATE TABLE IF NOT EXISTS "user_comments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "subject" varchar,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "username" varchar NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" varchar PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now()
);
```

## Paystack Payment
- Initialize: card, bank transfer, USSD, mobile money
- Direct Charge API (STK push): Ghana (MTN/Vodafone/AirtelTigo), Rwanda (MTN), Uganda (MTN/Airtel)
- Kenya M-PESA: uses Initialize API with pre-filled phone
- Phone format: international with + prefix (e.g. +254712345678)
- Transactions persisted to `payment_transactions` table on verify

## Pterodactyl Integration
Server: `server/pterodactyl.ts`
Required env vars:
- `PTERODACTYL_URL` — Panel URL (e.g. https://panel.xwolf.space)
- `PTERODACTYL_API_KEY` — Application API key (ptla_...) stored as secret
Optional env vars (all have defaults):
- `PTERODACTYL_OWNER_ID`, `PTERODACTYL_EGG_ID`, `PTERODACTYL_NEST_ID`, `PTERODACTYL_LOCATION_ID`
- `PTERODACTYL_RAM` (512), `PTERODACTYL_DISK` (2048), `PTERODACTYL_CPU` (100)

## Key Design Decisions
- Dark mode forced by default
- Monospace font everywhere for terminal feel
- Green neon glow effects via `terminal-glow` and `neon-text` CSS utilities
- Bot catalog in PostgreSQL for admin manageability
- Admin auth via `x-user-id` header (set automatically by queryClient from Supabase session)
- Admin IDs can be set via `ADMIN_USER_IDS` env var (comma-separated, for VPS deployments)
- Pterodactyl mode activates automatically when `PTERODACTYL_URL` env var is present
- Chat is enabled by default (no setting row = enabled), disabled by setting `chat_enabled=false`
