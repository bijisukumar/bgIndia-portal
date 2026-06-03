CREATE TABLE IF NOT EXISTS property_documents (
  doc_id        TEXT PRIMARY KEY,
  prop_id       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other',
  doc_name      TEXT NOT NULL,
  drive_url     TEXT,
  drive_folder_url TEXT,
  file_type     TEXT,
  doc_date      TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_property_docs_prop ON property_documents(prop_id, category);
