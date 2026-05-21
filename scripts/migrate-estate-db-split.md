# v2.0 — Estate DB Split Migration Guide

## Overview
Moves coconut_harvests, rubber_harvests, estate_transactions from
bgindia-db (villa DB) to bgindiadb-estates (new DB).

## Step 1 — Schema already created in dashboard
DB created as: bgindiadb-estates (id: 6e23cb84-d341-4b2e-8062-e8244844309d)

## Step 2 — Create the schema in the new DB
```bash
npx wrangler d1 execute bgindiadb-estates --file=schema-estates.sql --remote
```

## Step 3 — Export existing estate data from old DB
Run in D1Explorer (Ad-hoc query) on bgindia-db:
```sql
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
npx wrangler d1 execute bgindiadb-estates --file=estate-data-backup.sql --remote
```

## Step 5 — Verify
Log in as Pradosh → check coconut/rubber data still shows.
Log in as Owner → check estates screens still work.

## Step 6 — Clean up old tables (ONLY after confirming Step 5)
Run in D1Explorer on bgindia-db:
```sql
DROP TABLE IF EXISTS coconut_harvests;
DROP TABLE IF EXISTS rubber_harvests;
DROP TABLE IF EXISTS estate_transactions;
```

## Rollback
git checkout v1.5-baseline to go fully back.
No data deleted from bgindia-db until Step 6.
