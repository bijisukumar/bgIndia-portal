-- ============================================================
-- Run against bgindia-db
-- Only coconut_harvests exists here — everything else was
-- already in bgindiadb-estates or never existed in bgindia-db.
-- ============================================================

ALTER TABLE coconut_harvests RENAME TO coconut_harvests_old;
