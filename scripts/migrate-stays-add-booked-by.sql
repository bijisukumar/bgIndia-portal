-- ════════════════════════════════════════════════════════════
-- Migration: add booked_by_guest_id to stays.
--
-- Real-world pattern this supports: someone (e.g. Parvathy) makes the
-- enquiry/booking and pays, but a different person (e.g. Venkittaswamy)
-- actually shows up and fills the check-in form. Today those become two
-- fully disconnected records -- the booking contact's guest history never
-- reflects the stay, because reset-and-rebackfill-guests-fk-safe.sql groups
-- stays by exact guest_name, and guest_name on the real stay is whoever
-- checked in, not whoever booked.
--
-- booked_by_guest_id is nullable and almost always NULL (the normal case:
-- same person books and checks in). It's only set when an owner explicitly
-- links a stay to a different booking contact via the new "Booked By" field
-- on the Complete Booking screen.
--
-- NOT a foreign key constraint (D1/SQLite enforces FKs strictly per the
-- FK-block incident from the Parvathy/Romala guests rebuild earlier --
-- a plain nullable TEXT column avoids re-creating that same fragility for
-- a field that's edited ad-hoc from the UI, not part of the core booking
-- pipeline).
-- ════════════════════════════════════════════════════════════

ALTER TABLE stays ADD COLUMN booked_by_guest_id TEXT;
ALTER TABLE stays ADD COLUMN booked_by_name TEXT;
-- booked_by_name is denormalized (no JOIN needed to render "Booked by: X"
-- in lists) -- same pattern as guest_name itself being denormalized rather
-- than purely FK'd to guests.
