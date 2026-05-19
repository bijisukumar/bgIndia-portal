-- Close stale bookings never checked in
UPDATE stays SET status = 'closed', updated_by = 'system', updated_at = datetime('now') WHERE status IN ('booked','confirmed','docs_uploaded','ready_for_checkin') AND checkout_date < date('now','-7 days');
