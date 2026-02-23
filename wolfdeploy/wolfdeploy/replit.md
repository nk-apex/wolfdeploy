# WolfDeploy - WhatsApp Bot Deployment Platform

## Overview
A Heroku-style platform for deploying WhatsApp bots. Users sign up/log in via Supabase Auth, select from a catalog of bot templates, configure environment variables, and deploy them with real-time logs.

## UI Style
Matches the WolfHost dark terminal aesthetic:
- Pure black background (#0D0D0D range)
- Neon green as primary accent (hsl 142 76% 42%)
- JetBrains Mono font throughout
- Uppercase tracking-widest labels
- Card-based layout with subtle borders
- StatusBadge component for deployment states

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
