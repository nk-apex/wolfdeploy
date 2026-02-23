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
- PostgreSQL via Drizzle ORM (Supabase instance)
- In-memory deployment storage (MemStorage) for active processes
- Bot catalog stored in `platform_bots` DB table (auto-seeded on first API call)

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

## Bot Catalog (auto-seeded)
1. **WolfBot** — Professional multi-feature WhatsApp bot (id: wolfbot)
2. **JUNE-X** — Friendly WhatsApp assistant (id: junex)
3. **DAVE-X** — Dave Tech multipurpose bot (id: davex)
4. **TRUTH-MD** — Multi-device WhatsApp bot (id: truthmd)

## Admin Dashboard (/wolf) Tabs
- **Overview**: Platform stats (users, coins, deployments, revenue, bots)
- **Users**: All users with coin balances; adjust coins, grant/revoke admin, delete user
- **Bot Catalog**: Add, toggle visibility, delete bots from catalog
- **Deployments**: All deployments across all users; stop/delete
- **Payments**: All Paystack transaction records
- **Notifications**: Create/toggle/delete platform notifications

## API Routes

### Public / User Routes
- `GET /api/config` — Supabase public config
- `GET /api/bots` — Bot catalog (from DB, auto-seeded)
- `GET /api/bots/:id` — Single bot
- `GET /api/deployments` — User deployments (in memory)
- `POST /api/deploy` — Create deployment (deducts 10 coins)
- `POST /api/deployments/:id/stop` — Stop deployment
- `DELETE /api/deployments/:id` — Delete deployment
- `GET /api/coins/:userId` — Coin balance
- `POST /api/coins/credit` — Credit coins
- `POST /api/payments/initialize` — Paystack checkout
- `POST /api/payments/verify` — Verify + credit coins (persists to DB)
- `POST /api/payments/mobile-charge` — Direct mobile money STK push
- `GET /api/payments/check/:reference` — Poll Paystack status
- `GET /api/notifications` — Active public notifications

### Admin Routes (require `x-user-id` header + admin_users entry or ADMIN_USER_IDS env var)
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
- `POST /api/admin/deployments/:id/stop` — Admin force-stop
- `DELETE /api/admin/deployments/:id` — Admin force-delete
- `GET/POST /api/admin/notifications` — List/create notifications
- `PUT/DELETE /api/admin/notifications/:id` — Update/delete notification

## Paystack Payment
- Initialize: card, bank transfer, USSD, mobile money
- Direct Charge API (STK push): Ghana (MTN/Vodafone/AirtelTigo), Rwanda (MTN), Uganda (MTN/Airtel)
- Kenya M-PESA: uses Initialize API with pre-filled phone
- Phone format: international with + prefix (e.g. +254712345678)
- Transactions persisted to `payment_transactions` table on verify

## Pterodactyl Integration
Server: `server/pterodactyl.ts`
Required env vars (to activate Pterodactyl mode):
- `PTERODACTYL_URL` — Panel URL (e.g. https://panel.example.com)
- `PTERODACTYL_API_KEY` — Application API key (ptla_...) — stored as Replit secret
Optional env vars (all have defaults):
- `PTERODACTYL_OWNER_ID` — Pterodactyl user ID that owns servers (default: 1)
- `PTERODACTYL_EGG_ID` — Egg ID for bot deployment (default: 15)
- `PTERODACTYL_NEST_ID` — Nest ID containing the egg (default: 1)
- `PTERODACTYL_LOCATION_ID` — Deployment location (default: 1)
- `PTERODACTYL_RAM` — RAM per server in MB (default: 512)
- `PTERODACTYL_DISK` — Disk per server in MB (default: 2048)
- `PTERODACTYL_CPU` — CPU % per server (default: 100)
- `PTERODACTYL_DOCKER_IMAGE` — Docker image (default: ghcr.io/pterodactyl/yolks:nodejs_18)
- `PTERODACTYL_STARTUP` — Startup command (default: npm install --legacy-peer-deps && node index.js)

## Key Design Decisions
- Dark mode forced by default (`document.documentElement.classList.add("dark")`)
- Monospace font everywhere for terminal feel
- Green neon glow effects via `terminal-glow` and `neon-text` CSS utilities
- Bot catalog in PostgreSQL (seeded on first deploy) for admin manageability
- Admin auth via `x-user-id` header (set automatically by queryClient from Supabase session)
- Admin IDs can be set via `ADMIN_USER_IDS` env var (comma-separated, for VPS deployments)
- Pterodactyl mode activates automatically when `PTERODACTYL_URL` env var is present
