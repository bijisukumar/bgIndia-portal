# Estate DB Migration — bgindia-db → bgindiadb-estates

## The problem
coconut_harvests, rubber_harvests, estate_transactions, irrigation_logs
exist in bgindia-db (main) but should live in bgindiadb-estates.
Data is in bgindia-db. bgindiadb-estates tables were just created (empty).

## Commands — run from bgIndia-portal folder on your machine

### STEP 1: Export data from bgindia-db and import to bgindiadb-estates

```bash
# Export each table from bgindia-db
npx wrangler d1 export bgindia-db --remote --table=coconut_harvests --output=scripts/export-coconut.sql
npx wrangler d1 export bgindia-db --remote --table=rubber_harvests --output=scripts/export-rubber.sql
npx wrangler d1 export bgindia-db --remote --table=estate_transactions --output=scripts/export-estate-txn.sql
npx wrangler d1 export bgindia-db --remote --table=irrigation_logs --output=scripts/export-irrigation.sql

# Import into bgindiadb-estates
npx wrangler d1 execute bgindiadb-estates --remote --file=scripts/export-coconut.sql
npx wrangler d1 execute bgindiadb-estates --remote --file=scripts/export-rubber.sql
npx wrangler d1 execute bgindiadb-estates --remote --file=scripts/export-estate-txn.sql
npx wrangler d1 execute bgindiadb-estates --remote --file=scripts/export-irrigation.sql
```

### STEP 2: Verify row counts match in both DBs

```bash
npx wrangler d1 execute bgindia-db --remote --command="SELECT 'coconut' as t, COUNT(*) as n FROM coconut_harvests UNION ALL SELECT 'rubber', COUNT(*) FROM rubber_harvests UNION ALL SELECT 'txn', COUNT(*) FROM estate_transactions UNION ALL SELECT 'irrigation', COUNT(*) FROM irrigation_logs"

npx wrangler d1 execute bgindiadb-estates --remote --command="SELECT 'coconut' as t, COUNT(*) as n FROM coconut_harvests UNION ALL SELECT 'rubber', COUNT(*) FROM rubber_harvests UNION ALL SELECT 'txn', COUNT(*) FROM estate_transactions UNION ALL SELECT 'irrigation', COUNT(*) FROM irrigation_logs"
```

Both outputs must match before proceeding.

### STEP 3: Rename originals to _old in bgindia-db (safe fallback)

```bash
npx wrangler d1 execute bgindia-db --remote --file=scripts/rename-estate-tables-to-old.sql
```

### STEP 4: Smoke test estate360
- Log in as Pradosh
- Check coconut dashboard still shows 6 harvests
- Enter a test irrigation log
- Confirm quick info updates

### STEP 5: Retire _old tables (when confident — weeks later is fine)

```bash
npx wrangler d1 execute bgindia-db --remote --file=scripts/retire-estate-tables-from-bgindia-db.sql
```
(retire script drops _old tables — edit it to say coconut_harvests_old etc. first)

## Rollback
If anything breaks after step 3:
```bash
npx wrangler d1 execute bgindia-db --remote --command="ALTER TABLE coconut_harvests_old RENAME TO coconut_harvests"
npx wrangler d1 execute bgindia-db --remote --command="ALTER TABLE rubber_harvests_old RENAME TO rubber_harvests"
npx wrangler d1 execute bgindia-db --remote --command="ALTER TABLE estate_transactions_old RENAME TO estate_transactions"
npx wrangler d1 execute bgindia-db --remote --command="ALTER TABLE irrigation_logs_old RENAME TO irrigation_logs"
```
