-- ════════════════════════════════════════════════════════════

-- Final 5 contact-info gaps -- found via email/Airbnb search,

-- as none of these had any contact info in the Drive check-in

-- forms either. Completes the contact-info backfill started in

-- fill-missing-contact-info.sql.

--

-- SAFE: only fills currently blank guest_phone/guest_email on

-- stays, never overwrites. Updates guests.phone/email the same way

-- if a matching guests row exists by exact name.

-- ════════════════════════════════════════════════════════════



UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 88676 34963'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0057';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 79078 57978'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'vimalrevi96@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0048';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+61 401 283 275'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'vibinett@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0047';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+1 (647) 745-0721'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-0017';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 83495 61751'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'unnikvb@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-0006';



-- Also fill guests.phone/email for the same 5, if a guests row exists

-- with this exact name (it should, since reset-and-rebackfill-guests-fk-safe.sql

-- already ran and rebuilt guests from stays).



UPDATE guests SET phone = COALESCE(NULLIF(NULLIF(TRIM(phone), ''), '—'), '+91 88676 34963'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Pooja Devan';

UPDATE guests SET phone = COALESCE(NULLIF(NULLIF(TRIM(phone), ''), '—'), '+91 79078 57978'), email = COALESCE(NULLIF(NULLIF(TRIM(email), ''), '—'), 'vimalrevi96@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Vimal Revi';

UPDATE guests SET phone = COALESCE(NULLIF(NULLIF(TRIM(phone), ''), '—'), '+61 401 283 275'), email = COALESCE(NULLIF(NULLIF(TRIM(email), ''), '—'), 'vibinett@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Vibin Thattayath Vasu';

UPDATE guests SET phone = COALESCE(NULLIF(NULLIF(TRIM(phone), ''), '—'), '+1 (647) 745-0721'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sharath Balakrishnan';

UPDATE guests SET phone = COALESCE(NULLIF(NULLIF(TRIM(phone), ''), '—'), '+91 83495 61751'), email = COALESCE(NULLIF(NULLIF(TRIM(email), ''), '—'), 'unnikvb@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Shilpa Gopan';