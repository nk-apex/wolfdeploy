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
- `/admin` — Admin Dashboard (admin-only, manage bots/users/payments/notifications/deployments)

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
- Bot catalog stored in `platform_bots` DB table

### Authentication
- Supabase Auth (email/password)
- Admin access controlled via `admin_users` table
- First-run admin claim: `POST /api/admin/promote` (only works if no admins exist)

## Database Tables
- `user_coins` — userId → coin balance
- `admin_users` — userId → admin grant records
- `platform_bots` — bot catalog (id, name, description, repository, env, etc.)
- `notifications` — platform-wide announcements (title, message, type, active)
- `payment_transactions` — Paystack transaction history (userId, amount, currency, coins, status, reference)

## Bot Catalog
1. **WolfBot** — Professional multi-feature WhatsApp bot (id: wolfbot)
2. **JUNE-X** — Friendly WhatsApp assistant (id: junex)
3. **DAVE-X** — Dave Tech multipurpose bot (id: davex)
4. **TRUTH-MD** — Multi-device WhatsApp bot (id: truthmd)

## Admin Dashboard Tabs
- **Overview**: Platform stats (users, coins, deployments, revenue, bots)
- **Users**: All users with coin balances; adjust coins, grant/revoke admin, delete user
- **Bot Catalog**: Add, toggle visibility, delete bots from catalog
- **Deployments**: All deployments across all users; stop/delete
- **Payments**: All Paystack transaction records
- **Notifications**: Create/toggle/delete platform notifications

## API Routes

### Public / User Routes
- `GET /api/config` — Supabase public config
- `GET /api/bots` — Bot catalog (from DB)
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

### Admin Routes (require `x-user-id` header + admin_users entry)
- `GET /api/admin/check` — Is current user admin?
- `POST /api/admin/promote` — Self-promote (only if no admins exist)
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

## Key Design Decisions
- Dark mode forced by default (`document.documentElement.classList.add("dark")`)
- Monospace font everywhere for terminal feel
- Green neon glow effects via `terminal-glow` and `neon-text` CSS utilities
- Bot catalog in PostgreSQL (seeded on first deploy) for admin manageability
- Admin auth via `x-user-id` header (set automatically by queryClient from Supabase session)
