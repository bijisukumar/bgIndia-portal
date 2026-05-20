-- Mark Jan 2026 Raman commissions as paid
-- These were confirmed paid by owner on Jan 31 2026
UPDATE raman_commissions
SET is_paid = 1, paid_date = '2026-01-31', updated_by = 'owner'
WHERE comm_id IN ('RC-0188','RC-0189','RC-0190','RC-0191','RC-0192','RC-0193')
  AND is_paid = 0;

-- Verify
SELECT comm_id, guest_name, checkin_date, nights, commission, is_paid, paid_date
FROM raman_commissions
WHERE comm_id IN ('RC-0188','RC-0189','RC-0190','RC-0191','RC-0192','RC-0193')
ORDER BY checkin_date;
