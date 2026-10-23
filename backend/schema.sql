PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  reminder INTEGER NOT NULL DEFAULT 0,
  consent_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','expired'))
);
CREATE UNIQUE INDEX IF NOT EXISTS occupied_slot ON appointments(date,time) WHERE status IN ('pending','confirmed');
CREATE INDEX IF NOT EXISTS appointment_time ON appointments(starts_at,status);
CREATE TABLE IF NOT EXISTS mail_jobs (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('clinic','confirmed','cancelled','reminder')),
  due_at INTEGER NOT NULL,
  sent_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS due_mail ON mail_jobs(sent_at,due_at);
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 1, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS closures (date TEXT PRIMARY KEY);
