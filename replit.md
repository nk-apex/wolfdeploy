# WolfDeploy - WhatsApp Bot Deployment Platform

## Overview
A Heroku-style platform for deploying WhatsApp bots. Users sign up/log in via Supabase Auth, select from a catalog of bot templates, configure environment variables, and deploy them with real-time logs.

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
- `/billing` — Billing (Paystack, 13 countries, local currency)
- `/settings` — Settings (Profile, Appearance/Theme, Notifications, Security)
- `/referrals` — Referral Program (tiers, share link)

## Architecture

### Frontend
- React + TypeScript + Tailwind CSS
- Wouter for routing
- TanStack Query for data fetching (refetch intervals for live data)
- Shadcn UI components
- Pages: Dashboard (`/`), Deploy (`/deploy`, `/deploy/:botId`), My Bots (`/bots`), Bot Logs (`/bots/:id/logs`)
- Components: AppSidebar, TopBar, StatusBadge

### Backend
- Express.js REST API
- In-memory storage (MemStorage)
- Simulated deployment pipeline with realistic log sequences and timing

### API Routes
- `GET /api/bots` - List all available bot templates
- `GET /api/bots/:id` - Get specific bot
- `GET /api/bots/:id/app.json` - Bot config file
- `GET /api/deployments` - List all deployments
- `GET /api/deployments/:id` - Get specific deployment
- `GET /api/deployments/:id/logs` - Get deployment logs
- `POST /api/deploy` - Create new deployment
- `POST /api/deployments/:id/stop` - Stop deployment
- `DELETE /api/deployments/:id` - Delete deployment

## Available Bot Templates
1. WhatsApp Assistant (Productivity)
2. Group Manager Bot (Management)
3. eCommerce Sales Bot (Business)
4. News & Alerts Bot (Notifications)
5. Crypto Price Tracker (Finance)
6. Customer Support Bot (Business)

## Deployment Simulation
Each deployment goes through: queued → deploying → running
With realistic log messages and ~8 second total deployment time.

## Key Design Decisions
- Dark mode forced by default (document.documentElement.classList.add("dark"))
- Monospace font everywhere for terminal feel
- Green neon glow effects via `terminal-glow` and `neon-text` CSS utilities
- In-memory storage since no DB integration was requested
