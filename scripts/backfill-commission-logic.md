# Commission Backfill Logic

## Rules
- source = 'airbnb'       → commission_pct = 3,  commission_amt = gross * 0.03,  net = gross - commission_amt
- source = 'direct'       → commission_pct = 0,  commission_amt = 0,             net = gross
- source = 'booking.com'  → commission_pct = 15, commission_amt = gross * 0.15,  net = gross - commission_amt
- source = 'makemytrip'   → commission_pct = 18, commission_amt = gross * 0.18,  net = gross - commission_amt
- source = 'goibibo'      → commission_pct = 18, commission_amt = gross * 0.18,  net = gross - commission_amt
- source = 'expedia'      → commission_pct = 3,  commission_amt = gross * 0.03,  net = gross - commission_amt
- Only update stays where gross > 0 AND commission_amt = 0 AND status != 'cancelled'
