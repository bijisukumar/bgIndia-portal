-- ════════════════════════════════════════════════════════════
-- HISTORICAL STAYS BACKFILL — guests recovered from Google Drive check-in
-- forms that were never entered into the app (Feb 2024 - May 2026).
--
-- 42 stays total. Each gets a stay_id in the DWK-YYYY-BFnnn format
-- (BF = backfill), guaranteed not to collide with any existing or
-- future stay_id scheme (sequential DWK-YYYY-NNNN or random app-generated).
--
-- gross/commission_pct/commission_amt/net are all set to 0 — we don't have
-- the actual tariff charged for these historical stays, matching the same
-- convention used in scripts/seed-master.sql for other backfilled rows
-- with unknown revenue (e.g. 'Mathi', 'Rama Chandran', 'Sujitha Naduvileveetil').
--
-- created_by = 'system' (data-recovery backfill, not owner-entered).
--
-- PARVATHY NOTE: 3 of these stays (DWK-2024-BF005, DWK-2025-BF029,
-- DWK-2026-BF039) are recorded under a single canonical guest_name
-- 'Parvathy Hemant' even though the actual on-site guests varied each
-- time (e.g. her mother, or a 'Ms Sreelekha' party) -- per user confirmation,
-- Parvathy is consistently the booking/paying contact across all 3, so they
-- should be unified under her for guest-history purposes. Using one exact
-- guest_name string ensures scripts/reset-and-rebackfill-guests.sql (which
-- groups guests by exact guest_name match) merges these 3 stays into one
-- guests row when you next run it.
--
-- After running this file, re-run scripts/reset-and-rebackfill-guests.sql
-- so the guests table picks up these 42 new stays (it fully rebuilds from
-- the stays table each time, so it's safe to re-run).
-- ════════════════════════════════════════════════════════════

-- ── STAYS ──────────────────────────────────────────────────────


INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF001', 'dwarka', 'booking_com', 'Jithuswaraj Karuvanthodi', '9946974611', 'jittu.srj@gmail.com', '2024-02-14', '2024-02-15', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-02-14T12:00:00', '2024-02-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF002', 'dwarka', 'direct', 'Karthik M', '9894224755', 'karmanoharan@gmail.com', '2024-02-18', '2024-02-19', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-02-18T12:00:00', '2024-02-18T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF003', 'dwarka', 'direct', 'Srividya Sathyamurthy', '9008619884', 'srividya.sathyamurthy@gmail.com', '2024-02-22', '2024-02-23', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-02-22T12:00:00', '2024-02-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF004', 'dwarka', 'agoda', 'Mahesh Mukundan', '+918861919347', 'maheshmukundan999@gmail.com', '2024-03-21', '2024-03-22', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-03-21T12:00:00', '2024-03-21T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF005', 'dwarka', 'direct', 'Parvathy Hemant', NULL, NULL, '2024-04-07', '2024-04-10', 3, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-04-07T12:00:00', '2024-04-07T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF006', 'dwarka', 'airbnb', 'Vijay Raj', NULL, NULL, '2024-04-28', '2024-04-29', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-04-28T12:00:00', '2024-04-28T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF007', 'dwarka', 'airbnb', 'Srikant Romeo', NULL, NULL, '2024-05-04', '2024-05-05', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-05-04T12:00:00', '2024-05-04T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF008', 'dwarka', 'direct', 'Abhirami Sankar', '+91 7397311446', 'abhiramisankar4@gmail.com', '2024-06-08', '2024-06-11', 3, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-06-08T12:00:00', '2024-06-08T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF009', 'dwarka', 'direct', 'Anu Sabu', '+91 89219 76892', 'anusabu101@gmail.com', '2024-06-18', '2024-06-19', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-06-18T12:00:00', '2024-06-18T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF010', 'dwarka', 'direct', 'Asha Gopa Kumar', '9989211402', 'ashagk141173@gmail.com', '2024-07-04', '2024-07-06', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-07-04T12:00:00', '2024-07-04T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF011', 'dwarka', 'booking_com', 'Anil Kumar V', '+91 9605617593', 'anilkvm@gmail.com', '2024-08-02', '2024-08-06', 4, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-08-02T12:00:00', '2024-08-02T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF012', 'dwarka', 'airbnb', 'Priya Muniandy', '+0164051408', 'priyaandy81@gmail.com', '2024-08-09', '2024-08-10', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-08-09T12:00:00', '2024-08-09T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF013', 'dwarka', 'booking_com', 'Rahul Mani', '+91 90803 64645', 'rahul31121994@gmail.com', '2024-08-21', '2024-08-22', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-08-21T12:00:00', '2024-08-21T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF014', 'dwarka', 'direct', 'Akila', '+918682013456', 'akilasrimathi14@gmail.com', '2024-08-23', '2024-08-24', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-08-23T12:00:00', '2024-08-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF015', 'dwarka', 'direct', 'Preman', '+97450456774', 'premanqatar@gmail.com', '2024-09-14', '2024-09-17', 3, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-09-14T12:00:00', '2024-09-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF016', 'dwarka', 'booking_com', 'Janani Babukrishnan', NULL, 'janani2110@gmail.com', '2024-09-22', '2024-09-26', 4, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-09-22T12:00:00', '2024-09-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF017', 'dwarka', 'direct', 'Priya Dharshini S', '+91-9980531484', 'psubr225@gmail.com', '2024-09-27', '2024-09-28', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-09-27T12:00:00', '2024-09-27T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF018', 'dwarka', 'direct', 'Dr. Poornima', '9497267011', 'dr.poorni85@gmail.com', '2024-10-01', '2024-10-02', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-10-01T12:00:00', '2024-10-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF019', 'dwarka', 'booking_com', 'Shyam Kumar MA', '+91 7736326693', 'shyamkumarma1994@gmail.com', '2024-10-12', '2024-10-13', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-10-12T12:00:00', '2024-10-12T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2024-BF020', 'dwarka', 'direct', 'Bivin Babu', '+971 55 919 8609', 'bivinbabu0484@gmail.com', '2024-12-25', '2024-12-26', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2024-12-25T12:00:00', '2024-12-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF021', 'dwarka', 'direct', 'Sananda Gayathri', NULL, NULL, '2025-01-16', '2025-01-17', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-01-16T12:00:00', '2025-01-16T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF022', 'dwarka', 'direct', 'Ganesh Baliga', '+91 968 644 0321', 'ganesh.baliga@gmail.com', '2025-02-07', '2025-02-09', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-02-07T12:00:00', '2025-02-07T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF023', 'dwarka', 'direct', 'M. Santhoshi Kumari', '+91 99599 67964', 'msanthoshi3636@gmail.com', '2025-02-17', '2025-02-18', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-02-17T12:00:00', '2025-02-17T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF024', 'dwarka', 'direct', 'Krishna Ravi Boonapalli', '+91 81970 14422', 'rboonapalli@gmail.com', '2025-02-23', '2025-02-24', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-02-23T12:00:00', '2025-02-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF025', 'dwarka', 'direct', 'Balaji Narasimhan', '+1 (704) 232-5851', 'balajinarasimhan7@gmail.com', '2025-04-15', '2025-04-16', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-04-15T12:00:00', '2025-04-15T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF026', 'dwarka', 'direct', 'Prasanth S', '+919500097507', 'sprashanthbe@gmail.com', '2025-04-25', '2025-04-26', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-04-25T12:00:00', '2025-04-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF027', 'dwarka', 'direct', 'Arun Kumar', '+91 99439 25936', 'aruntm12@gmail.com', '2025-05-01', '2025-05-01', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-05-01T12:00:00', '2025-05-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF028', 'dwarka', 'airbnb', 'Milen Raj', '+91 94000 40966', 'milen.raj@gmail.com', '2025-06-24', '2025-06-25', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-06-24T12:00:00', '2025-06-24T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF029', 'dwarka', 'direct', 'Parvathy Hemant', '+971 56 199 3824', 'parvathy.hemant@gmail.com', '2025-07-24', '2025-07-26', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-07-24T12:00:00', '2025-07-24T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF030', 'dwarka', 'direct', 'Rohith Arun', '+91 80560 63633', 'rohith.roshi@gmail.com', '2025-08-28', '2025-08-29', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-08-28T12:00:00', '2025-08-28T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF031', 'dwarka', 'booking_com', 'Abdul Malik Al Saeed', '+966 50 311 0106', 'alsaeed100@gmail.com', '2025-09-07', '2025-09-08', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-09-07T12:00:00', '2025-09-07T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF032', 'dwarka', 'direct', 'Sarjit Sagar', '+91 93808 67747', 'sarjitsagar.ps@gmail.com', '2025-09-19', '2025-09-20', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-09-19T12:00:00', '2025-09-19T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF033', 'dwarka', 'direct', 'Partheebaraj TS', '+91 99658 83309', 'partheebrj51@gmail.com', '2025-09-27', '2025-09-29', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-09-27T12:00:00', '2025-09-27T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF034', 'dwarka', 'direct', 'Sridhar V', '+91 98423 24022', 'sridharvs24@gmail.com', '2025-10-02', '2025-10-03', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-10-02T12:00:00', '2025-10-02T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF035', 'dwarka', 'direct', 'Yashin V S', '+91 98860 77121', 'yashinvs@yahoo.com', '2025-10-18', '2025-10-19', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-10-18T12:00:00', '2025-10-18T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2025-BF036', 'dwarka', 'airbnb', 'Santosh Kumaravel Sundaravadivelu', '+61 431 933 607', 'santoshisjerry@gmail.com', '2025-12-23', '2025-12-25', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2025-12-23T12:00:00', '2025-12-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2026-BF037', 'dwarka', 'direct', 'Rishab K A', '+91 861 850 5856', 'rishabmango@gmail.com', '2026-02-13', '2026-02-15', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2026-02-13T12:00:00', '2026-02-13T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2026-BF038', 'dwarka', 'airbnb', 'Sreesha Ravindran', '+17349253230', 'jayaramsivaramannair@gmail.com', '2026-02-23', '2026-02-25', 2, 0, 0, 0, 0, 'closed', 'system', 'system', '2026-02-23T12:00:00', '2026-02-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2026-BF039', 'dwarka', 'direct', 'Parvathy Hemant', '+971 9745652422', 'parvathy.hemant@gmail.com', '2026-03-15', '2026-03-18', 3, 0, 0, 0, 0, 'closed', 'system', 'system', '2026-03-15T12:00:00', '2026-03-15T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2026-BF040', 'dwarka', 'direct', 'Amith Ramachandran Nair', '+91 98333 72889', 'amithnair2@gmail.com', '2026-05-01', '2026-05-02', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2026-05-01T12:00:00', '2026-05-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2026-BF041', 'dwarka', 'airbnb', 'Sangeeth Satheesh', '+91 96337 30791', 'sangeeth.sat@gmail.com', '2026-05-12', '2026-05-13', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2026-05-12T12:00:00', '2026-05-12T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, guest_phone, guest_email, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_by, updated_by, created_at, updated_at)
VALUES ('DWK-2026-BF042', 'dwarka', 'airbnb', 'Aswin', '+91 94463 59430', 'aswinsnair08@gmail.com', '2026-05-16', '2026-05-17', 1, 0, 0, 0, 0, 'closed', 'system', 'system', '2026-05-16T12:00:00', '2026-05-16T12:00:00');

-- ── RAMAN COMMISSIONS ──────────────────────────────────────────
-- Flat rule confirmed from functions/api/[[route]].js: nights > 1 -> 2000, else 1000.
-- These are unpaid (is_paid=0) -- mark paid via the Raman Commission screen once
-- you've confirmed payment, or run the existing "pay all unpaid" action if all of
-- these have indeed already been paid out historically.


INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF001', 'DWK-2024-BF001', 'Jithuswaraj Karuvanthodi', '2024-02-14', 1, 1000, 0, 'system', 'system', '2024-02-14T12:00:00', '2024-02-14T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF002', 'DWK-2024-BF002', 'Karthik M', '2024-02-18', 1, 1000, 0, 'system', 'system', '2024-02-18T12:00:00', '2024-02-18T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF003', 'DWK-2024-BF003', 'Srividya Sathyamurthy', '2024-02-22', 1, 1000, 0, 'system', 'system', '2024-02-22T12:00:00', '2024-02-22T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF004', 'DWK-2024-BF004', 'Mahesh Mukundan', '2024-03-21', 1, 1000, 0, 'system', 'system', '2024-03-21T12:00:00', '2024-03-21T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF005', 'DWK-2024-BF005', 'Parvathy Hemant', '2024-04-07', 3, 2000, 0, 'system', 'system', '2024-04-07T12:00:00', '2024-04-07T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF006', 'DWK-2024-BF006', 'Vijay Raj', '2024-04-28', 1, 1000, 0, 'system', 'system', '2024-04-28T12:00:00', '2024-04-28T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF007', 'DWK-2024-BF007', 'Srikant Romeo', '2024-05-04', 1, 1000, 0, 'system', 'system', '2024-05-04T12:00:00', '2024-05-04T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF008', 'DWK-2024-BF008', 'Abhirami Sankar', '2024-06-08', 3, 2000, 0, 'system', 'system', '2024-06-08T12:00:00', '2024-06-08T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF009', 'DWK-2024-BF009', 'Anu Sabu', '2024-06-18', 1, 1000, 0, 'system', 'system', '2024-06-18T12:00:00', '2024-06-18T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF010', 'DWK-2024-BF010', 'Asha Gopa Kumar', '2024-07-04', 2, 2000, 0, 'system', 'system', '2024-07-04T12:00:00', '2024-07-04T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF011', 'DWK-2024-BF011', 'Anil Kumar V', '2024-08-02', 4, 2000, 0, 'system', 'system', '2024-08-02T12:00:00', '2024-08-02T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF012', 'DWK-2024-BF012', 'Priya Muniandy', '2024-08-09', 1, 1000, 0, 'system', 'system', '2024-08-09T12:00:00', '2024-08-09T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF013', 'DWK-2024-BF013', 'Rahul Mani', '2024-08-21', 1, 1000, 0, 'system', 'system', '2024-08-21T12:00:00', '2024-08-21T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF014', 'DWK-2024-BF014', 'Akila', '2024-08-23', 1, 1000, 0, 'system', 'system', '2024-08-23T12:00:00', '2024-08-23T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF015', 'DWK-2024-BF015', 'Preman', '2024-09-14', 3, 2000, 0, 'system', 'system', '2024-09-14T12:00:00', '2024-09-14T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF016', 'DWK-2024-BF016', 'Janani Babukrishnan', '2024-09-22', 4, 2000, 0, 'system', 'system', '2024-09-22T12:00:00', '2024-09-22T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF017', 'DWK-2024-BF017', 'Priya Dharshini S', '2024-09-27', 1, 1000, 0, 'system', 'system', '2024-09-27T12:00:00', '2024-09-27T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF018', 'DWK-2024-BF018', 'Dr. Poornima', '2024-10-01', 1, 1000, 0, 'system', 'system', '2024-10-01T12:00:00', '2024-10-01T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF019', 'DWK-2024-BF019', 'Shyam Kumar MA', '2024-10-12', 1, 1000, 0, 'system', 'system', '2024-10-12T12:00:00', '2024-10-12T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF020', 'DWK-2024-BF020', 'Bivin Babu', '2024-12-25', 1, 1000, 0, 'system', 'system', '2024-12-25T12:00:00', '2024-12-25T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF021', 'DWK-2025-BF021', 'Sananda Gayathri', '2025-01-16', 1, 1000, 0, 'system', 'system', '2025-01-16T12:00:00', '2025-01-16T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF022', 'DWK-2025-BF022', 'Ganesh Baliga', '2025-02-07', 2, 2000, 0, 'system', 'system', '2025-02-07T12:00:00', '2025-02-07T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF023', 'DWK-2025-BF023', 'M. Santhoshi Kumari', '2025-02-17', 1, 1000, 0, 'system', 'system', '2025-02-17T12:00:00', '2025-02-17T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF024', 'DWK-2025-BF024', 'Krishna Ravi Boonapalli', '2025-02-23', 1, 1000, 0, 'system', 'system', '2025-02-23T12:00:00', '2025-02-23T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF025', 'DWK-2025-BF025', 'Balaji Narasimhan', '2025-04-15', 1, 1000, 0, 'system', 'system', '2025-04-15T12:00:00', '2025-04-15T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF026', 'DWK-2025-BF026', 'Prasanth S', '2025-04-25', 1, 1000, 0, 'system', 'system', '2025-04-25T12:00:00', '2025-04-25T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF027', 'DWK-2025-BF027', 'Arun Kumar', '2025-05-01', 1, 1000, 0, 'system', 'system', '2025-05-01T12:00:00', '2025-05-01T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF028', 'DWK-2025-BF028', 'Milen Raj', '2025-06-24', 1, 1000, 0, 'system', 'system', '2025-06-24T12:00:00', '2025-06-24T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF029', 'DWK-2025-BF029', 'Parvathy Hemant', '2025-07-24', 2, 2000, 0, 'system', 'system', '2025-07-24T12:00:00', '2025-07-24T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF030', 'DWK-2025-BF030', 'Rohith Arun', '2025-08-28', 1, 1000, 0, 'system', 'system', '2025-08-28T12:00:00', '2025-08-28T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF031', 'DWK-2025-BF031', 'Abdul Malik Al Saeed', '2025-09-07', 1, 1000, 0, 'system', 'system', '2025-09-07T12:00:00', '2025-09-07T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF032', 'DWK-2025-BF032', 'Sarjit Sagar', '2025-09-19', 1, 1000, 0, 'system', 'system', '2025-09-19T12:00:00', '2025-09-19T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF033', 'DWK-2025-BF033', 'Partheebaraj TS', '2025-09-27', 2, 2000, 0, 'system', 'system', '2025-09-27T12:00:00', '2025-09-27T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF034', 'DWK-2025-BF034', 'Sridhar V', '2025-10-02', 1, 1000, 0, 'system', 'system', '2025-10-02T12:00:00', '2025-10-02T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF035', 'DWK-2025-BF035', 'Yashin V S', '2025-10-18', 1, 1000, 0, 'system', 'system', '2025-10-18T12:00:00', '2025-10-18T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF036', 'DWK-2025-BF036', 'Santosh Kumaravel Sundaravadivelu', '2025-12-23', 2, 2000, 0, 'system', 'system', '2025-12-23T12:00:00', '2025-12-23T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF037', 'DWK-2026-BF037', 'Rishab K A', '2026-02-13', 2, 2000, 0, 'system', 'system', '2026-02-13T12:00:00', '2026-02-13T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF038', 'DWK-2026-BF038', 'Sreesha Ravindran', '2026-02-23', 2, 2000, 0, 'system', 'system', '2026-02-23T12:00:00', '2026-02-23T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF039', 'DWK-2026-BF039', 'Parvathy Hemant', '2026-03-15', 3, 2000, 0, 'system', 'system', '2026-03-15T12:00:00', '2026-03-15T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF040', 'DWK-2026-BF040', 'Amith Ramachandran Nair', '2026-05-01', 1, 1000, 0, 'system', 'system', '2026-05-01T12:00:00', '2026-05-01T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF041', 'DWK-2026-BF041', 'Sangeeth Satheesh', '2026-05-12', 1, 1000, 0, 'system', 'system', '2026-05-12T12:00:00', '2026-05-12T12:00:00');

INSERT OR IGNORE INTO raman_commissions (comm_id, stay_id, guest_name, checkin_date, nights, commission, is_paid, created_by, updated_by, created_at, updated_at)
VALUES ('RC-BF042', 'DWK-2026-BF042', 'Aswin', '2026-05-16', 1, 1000, 0, 'system', 'system', '2026-05-16T12:00:00', '2026-05-16T12:00:00');