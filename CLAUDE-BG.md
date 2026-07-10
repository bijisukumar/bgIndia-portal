# BG India Portal — Project Context

## Project Overview
A multi-tenant React portal (v2.1.0) managing villa rentals, estate operations, and revenue tracking across multiple business units. Each business unit is a separate deployable app.

## GitHub
https://github.com/bijisukumar/bgIndia-portal

## Deployment
- Hosted on **Cloudflare Pages / Workers**
- Auto-deploys on push to `main`
- Multiple Wrangler configs for different apps (see below)
- Backend API via Cloudflare Workers: `functions/api/[[route]].js`
- Database: Cloudflare D1 (SQLite) — schemas in `schema.sql` and `schema-estates.sql`

## Local Dev
```bash
cd C:\Projects\bgIndia-portal
npm run dev
```
Runs Vite dev server with hot-reload. Default app loads from `src/main.jsx`.

## Tech Stack
- **React 18** with React Router v6
- **Vite 6** as build tool
- **PWA** enabled via `vite-plugin-pwa` (service worker, icons in `public/icons/`)
- No CSS framework — custom styles in `src/index.css`
- Cloudflare D1 for database, Workers for API

## Multi-App Architecture
This repo builds **4 separate apps**, each with its own Vite config and entry point:

| App | Source | Wrangler Config | Build Command |
|-----|--------|-----------------|---------------|
| **manage** (main portal) | `src/` | `wrangler.toml` | `npm run build:manage` |
| **StayVibe** (villa bookings) | `src/apps/stayvibe/` | `wrangler.stayvibe.toml` | `npm run build:stayvibe` |
| **Rev360** (revenue tracking) | `src/apps/rev360/` | `wrangler.rev360.toml` | `npm run build:rev360` |
| **Estate360** (estate ops) | `src/apps/estate360/` | `wrangler.estate360.toml` | `npm run build:estate360` |

Build all apps at once:
```bash
npm run build:all
```

## Source Structure
```
src/
  App.jsx              # Root app (manage portal)
  config.js            # Global config (API URLs, env vars)
  main.jsx / index.css # Entry point & global styles
  api/index.js         # API client (calls Cloudflare Worker)
  apps/                # Sub-apps (stayvibe, rev360, estate360, manage)
  components/TopBar.jsx
  hooks/useAuth.jsx    # Auth hook (shared across apps)
  screens/             # All screen components
    ├── villa/         # Villa management (bookings, check-in, kitchen, inventory)
    ├── estates/       # Estate ops (coconut, mango, rubber, irrigation, Pollachi)
    ├── rental/        # Rental properties & agreements
    └── infra/         # Dev tools (D1Explorer, DebugPanel, TestRunner)
  utils/logger.js
```

## Key Screens
- `Login.jsx` — shared login
- `VillaDashboard.jsx` / `VillaHub.jsx` — main villa management
- `RDashboard.jsx` / `Rev360Home.jsx` — revenue dashboard
- `EstateManagerHome.jsx` — estate manager view
- `OwnerHome.jsx` / `RamanHome.jsx` — owner-specific dashboards
- `CoconutDashboard.jsx`, `MangoHarvest.jsx`, `RubberTracker.jsx` — estate crop tracking
- `IrrigationDashboard.jsx` / `IrrigationLog.jsx` — irrigation management

## Key Notes
- Always run `npm run dev` for local development (not `npm start`)
- Environment variables live in `.env.local` — never commit this file
- DB migration scripts are in `scripts/` — run against Cloudflare D1, not locally
- `docs/onboarding-config.md` has tenant onboarding setup details
- `PROJECT_CONTEXT.md` in root has additional business context — read it for domain knowledge
- When editing a specific app, check its `vite.*.config.js` for any app-specific settings
