-- ════════════════════════════════════════════════════════════
-- Migration: add home_country to stays table.
--
-- Foreign guests already had a home_country_address (free-text) field,
-- but no structured country field -- their actual home country was
-- buried in that text blob, same problem we hit parsing addresses from
-- the old Drive check-in docx forms. The check-in form's 'country'/
-- 'city'/'state'/'pincode' fields are intentionally always set to the
-- VILLA's India address for foreign guests (Form C compliance: current
-- address in India during the stay), so they can't double as the
-- guest's actual home country.
--
-- This adds a dedicated column for it, populated by the new Country
-- dropdown in the Home Country Address section of the check-in form
-- (src/screens/GuestCheckIn.jsx) -- defaults to NULL for existing rows,
-- 'India' going forward for domestic guests, guest-selected value for
-- foreign guests.
-- ════════════════════════════════════════════════════════════

ALTER TABLE stays ADD COLUMN home_country TEXT;
