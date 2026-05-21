# v2.0 — Estate DB Split Migration Guide

## Overview
Moves coconut_harvests, rubber_harvests, estate_transactions from
BGIndiaDB-Dwarka (bgindia-db) to BGIndiaDB-Estates (new DB).

## Step 1 — Create the new D1 database
Run in terminal:
```bash
npx wrangler d1 create BGIndiaDB-Estates
```
Copy the database_id from the output.
Paste it into wrangler.toml replacing REPLACE_WITH_ESTATES_DB_ID

## Step 2 — Create the schema in the new DB
```bash
npx wrangler d1 execute BGIndiaDB-Estates --file=schema-estates.sql --remote
```

## Step 3 — Export existing estate data from old DB
Run these in D1Explorer (Ad-hoc query) on bgindia-db:
```sql
-- Check how many rows to migrate
SELECT 'coconut_harvests' as tbl, COUNT(*) as rows FROM coconut_harvests
UNION ALL
SELECT 'rubber_harvests', COUNT(*) FROM rubber_harvests
UNION ALL
SELECT 'estate_transactions', COUNT(*) FROM estate_transactions;
```

If rows exist, export via:
```bash
npx wrangler d1 export bgindia-db --remote --output=estate-data-backup.sql \
  --table=coconut_harvests --table=rubber_harvests --table=estate_transactions
```

## Step 4 — Import data into new DB
```bash
npx wrangler d1 execute BGIndiaDB-Estates --file=estate-data-backup.sql --remote
```

## Step 5 — Push code + deploy
```bash
git push origin main
```
Cloudflare redeploys automatically with new DB_ESTATES binding.

## Step 6 — Verify
Log in as Pradosh → check coconut/rubber data still shows.
Log in as Owner → check estates screens still work.

## Step 7 — Clean up old tables (ONLY after confirming Step 6)
Run in D1Explorer on bgindia-db:
```sql
-- Only run after confirming data is live in BGIndiaDB-Estates
DROP TABLE IF EXISTS coconut_harvests;
DROP TABLE IF EXISTS rubber_harvests;
DROP TABLE IF EXISTS estate_transactions;
```

## Rollback
If anything goes wrong before Step 7, just revert wrangler.toml:
- Remove the DB_ESTATES binding block
- The worker's ActiveDB guard returns a 503 for estate actions
- No data has been deleted from bgindia-db
- git checkout v1.5-baseline to go fully back
