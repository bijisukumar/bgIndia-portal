-- Room-by-room condition capture at move-in/move-out. One row per
-- (prop_id, event_type, room) for the current tenancy; cleared on
-- closeOutTenant/moveInIncomingTenant so a new tenant starts blank.
-- loss_id links a damaged room to the claim raised for it in
-- rev360_lease_losses, once the owner decides to bill it.
CREATE TABLE IF NOT EXISTS rev360_room_inspections (
  inspection_id   TEXT PRIMARY KEY,
  prop_id         TEXT NOT NULL REFERENCES rev360_rental_props(prop_id),
  event_type      TEXT NOT NULL CHECK(event_type IN ('move_in','move_out')),
  tenant_snapshot TEXT,
  room            TEXT NOT NULL,
  condition       TEXT NOT NULL DEFAULT 'Good' CHECK(condition IN ('Good','Damaged')),
  notes           TEXT,
  photo_url       TEXT,
  loss_id         TEXT REFERENCES rev360_lease_losses(loss_id),
  created_by      TEXT DEFAULT 'owner',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS rev360_idx_room_inspections_unique ON rev360_room_inspections(prop_id, event_type, room);
