-- Find out which GST-BACKFILL-* guest_id(s) are still referenced by
-- bookings or enquiries, which is what's blocking the DELETE in
-- reset-and-rebackfill-guests.sql.

SELECT 'bookings' AS source_table, b.booking_id, b.guest_id, g.name AS guest_name
FROM bookings b
JOIN guests g ON g.guest_id = b.guest_id
WHERE b.guest_id LIKE 'GST-BACKFILL-%';

SELECT 'enquiries' AS source_table, e.enquiry_id, e.guest_id, g.name AS guest_name
FROM enquiries e
JOIN guests g ON g.guest_id = e.guest_id
WHERE e.guest_id LIKE 'GST-BACKFILL-%';
