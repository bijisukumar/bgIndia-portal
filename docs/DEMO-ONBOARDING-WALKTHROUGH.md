# DEMO ONBOARDING WALKTHROUGH — standing up the sales-demo tenant

This is the exact sequence run to provision `demovilla` as a **persistent**
sales-demo tenant, captured live while doing it for the first time
(2026-07). It's a worked instance of `docs/ONBOARDING.md` section B — read
that doc first for the *why* behind each step; this doc is the *literal
commands*, so it can be re-run for a second demo tenant, handed to an
employee, or turned into a training video later.

Unlike a real host, this tenant never talks to Google (no Gmail poller, no
Apps Script, no Drive) — it only needs to serve the owner dashboards a
prospect looks at. Steps involving Google integration are skipped entirely.

## 1. Config (already existed)
`hosts/demovilla/config.js` was already built in an earlier onboarding dry
run. Only change needed for a real deploy: point the villa's `logoUrl` at
a real asset instead of `null`.

```js
logoUrl: '/icons/StayVibe360Logo.png',
```

## 2. Create the D1 database and apply schema
```
npx wrangler d1 create demovilla-db
```
Note the `database_id` it prints — goes into `wrangler.demovilla.toml`
below.

```
npx wrangler d1 execute demovilla-db --file=schema.sql --remote
```
(No `schema-estates.sql` — this host has no estates.)

Verify:
```
npx wrangler d1 execute demovilla-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'platform_%'"
```

## 3. Seed the platform tables (tenant, property, login PINs)
Copy `scripts/onboard-new-host-seed-template.sql` →
`scripts/onboard-demovilla-seed.sql`, fill in every `<PLACEHOLDER>`. Hash
each chosen PIN first:
```
node -e "console.log(require('crypto').createHash('sha256').update('<PIN>').digest('hex'))"
```
Then run the filled-in file:
```
npx wrangler d1 execute demovilla-db --file=scripts/onboard-demovilla-seed.sql --remote
```

## 4. Vite config + build script
New `vite.demovilla.config.js`, copied from `vite.stayvibe.config.js` with:
- `build.outDir` → `../../../dist/demovilla`
- `host` default → `'demovilla'` instead of `'dwarka'`

New npm script in `package.json`:
```json
"build:demovilla": "vite build --config vite.demovilla.config.js"
```
Also added to `build:all` — **this host shares the same worker
(`functions/api/[[route]].js`) as the other 4 apps**, so it needs
rebuilding/redeploying whenever the worker changes, same as
stayvibe/rev360/estate360/manage.

```
npm run build:demovilla
```

## 5. Create the Pages project
```
npx wrangler pages project create demovilla-portal --production-branch=main
```

Set secrets (own `JWT_SECRET`/`PIN_MASTER_OWNER` — Pages projects don't
share secrets with each other):
```
echo <MASTER_PIN> | npx wrangler pages secret put PIN_MASTER_OWNER --project-name=demovilla-portal
echo <RANDOM_HEX>  | npx wrangler pages secret put JWT_SECRET       --project-name=demovilla-portal
```
`RESEND_API_KEY` skipped — this tenant never sends real email.

### The binding gotcha
`wrangler pages deploy <dir> --project-name=X` does **not** read
`[[d1_databases]]`/`[ai]` bindings from a `wrangler.<host>.toml` file —
Pages doesn't support `--config` for a custom-named file
(`Pages does not support custom paths for the Wrangler configuration
file`). For a **brand-new** Pages project (no bindings ever configured via
dashboard), the first deploy needs those bindings applied some other way.
Workaround used here — temporarily swap in the host's config as the literal
`wrangler.toml`, deploy once, then restore the real one immediately:

```
cp wrangler.toml wrangler.toml.manage-bak
cp wrangler.demovilla.toml wrangler.toml
npx wrangler pages deploy dist/demovilla --project-name=demovilla-portal --commit-dirty=true
cp wrangler.toml.manage-bak wrangler.toml
rm wrangler.toml.manage-bak
```
Once a Pages project has bindings applied this way, every *later* deploy
of that project (even without `--config`, e.g. after seeding new demo
data or a worker code change) keeps using them — this dance is only
needed the first time a given Pages project is created. Ordinary
"rebuild after touching the shared worker" deploys for demovilla-portal
just need:
```
npm run build:demovilla
npx wrangler pages deploy dist/demovilla --project-name=demovilla-portal --commit-dirty=true
```

Verify auth is wired end to end:
```
curl -s -X POST https://demovilla-portal.pages.dev/api/login \
  -H "Content-Type: application/json" -d '{"pin":"<OWNER_PIN>"}'
```
Should return `{"success":true,"token":"..."}`.

## 6. Custom domain (manual — dashboard only)
No `wrangler pages domain` command exists (checked `wrangler pages --help`
— not in the command tree). Add via Cloudflare dashboard: Pages →
`demovilla-portal` → Custom domains → add `demo.stayvibe360.com`. SSL
provisions automatically.

## 7. Acceptance
Run `/infra` TestRunner (full pass) against the deployed demo before
trusting it for a live meeting. Log in with the owner PIN from step 3,
navigate to `/infra/testrunner`, Run All.

---

## Before every demo meeting (not a one-time step)
This tenant's *data* gets reset and reseeded before each prospect
meeting — see `scripts/demo-data/` for the generator and reset script.
The provisioning above (steps 1-6) only needs to happen once; only the
data needs refreshing.
