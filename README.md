# bgIndia Portal — Guruvayur Estates Property Management

A Progressive Web App (PWA) for managing GVR villa operations, estate tracking, and rental income.

## Stack
- React 18 + Vite
- React Router v6
- Vite PWA Plugin (offline support, installable on Android)
- Google Apps Script backend
- Google Drive for file storage

## Setup

```bash
npm install
npm run dev       # local dev at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview production build
```

## Deploy (Cloudflare Pages)
1. Connect this GitHub repo to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add custom domain: `manage.luxuryvillasguruvayur.com`

Done. Every push to `main` auto-deploys.

## User PINs
Configure in `src/config.js` — never commit real PINs to a public repo.

## Adding a second villa
In `src/config.js`, add an entry to the `villas` array. The villa hub screen renders dynamically from this config.

## Adding a new estate
Add to the `estates` array in `src/config.js`.
