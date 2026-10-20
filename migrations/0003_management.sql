ALTER TABLE registered_sites ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
ALTER TABLE registered_sites ADD COLUMN last_seen_at INTEGER;
ALTER TABLE admin_sessions ADD COLUMN credential_salt TEXT;
UPDATE admin_sessions SET credential_salt=(SELECT salt FROM admin_credentials WHERE id=1);
