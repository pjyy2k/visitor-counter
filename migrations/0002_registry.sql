CREATE TABLE registered_sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  origin TEXT NOT NULL,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX login_attempts_expiry ON login_attempts(expires_at);

CREATE TABLE admin_credentials (
  id INTEGER PRIMARY KEY CHECK(id=1),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
