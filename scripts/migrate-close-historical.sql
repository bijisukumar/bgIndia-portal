-- Close checked_out stays
UPDATE stays SET status = 'closed', updated_by = 'system', updated_at = datetime('now') WHERE status = 'checked_out' AND checkout_date < date('now');
