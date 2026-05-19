-- Close checked_in with past checkout
UPDATE stays SET status = 'closed', updated_by = 'system', updated_at = datetime('now') WHERE status IN ('checked_in','ready_for_checkout') AND checkout_date < date('now','-1 day');
