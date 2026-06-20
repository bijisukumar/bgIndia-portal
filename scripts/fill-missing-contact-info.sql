-- ════════════════════════════════════════════════════════════

-- CONTACT INFO BACKFILL -- 15 stays already in the DB that are

-- missing guest_phone/guest_email, where we have the data from the

-- Google Drive check-in form crawl. Each field only updates if it's

-- currently blank -- never overwrites an existing phone/email.

--

-- 5 other stays (Pooja Devan, Vimal Revi, Vibin Thattayath Vasu,

-- Sharath Balakrishnan, Shilpa Gopan) are ALSO missing contact info

-- but we don't have it from Drive either -- those genuinely need an

-- email search, not covered by this script.

-- ════════════════════════════════════════════════════════════



UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+919370780555'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'raj0313@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0056';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91-9047475025'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'mailtosundart@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0054';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+919500992376'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'renukasasi@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0053';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 9008523020'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'pashaarshad6@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-0041';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+971 52 955 1611'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'mails2syed@icloud.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-M0282';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 98407 21080'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'arun.pollachi@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-0036';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 90492 36633'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'shwetu.cool17@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-0035';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '0474 2747032'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'dsganesh79@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-0034';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 90483 50972'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'adarshkrishnanp@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-0032';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '8860102222'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'maddy.mahajan@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-0016';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 99679 50001'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'ajjukrao06@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-M0200';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+91 6351619634'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'hkc141298@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-0015';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+16693045508'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'jaynbhatt@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-0012';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '+19074727359'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'aswin2k1a@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-M0201';

UPDATE stays SET guest_phone = COALESCE(NULLIF(NULLIF(TRIM(guest_phone), ''), '—'), '00919747782399'), guest_email = COALESCE(NULLIF(NULLIF(TRIM(guest_email), ''), '—'), 'arjunkailath999@gmail.com'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-0005';