import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  contribution_amount INTEGER NOT NULL CHECK (contribution_amount > 0),
  frequency           TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly')),
  start_date          TEXT NOT NULL,
  created_by          INTEGER NOT NULL REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- position = rotation order (1 = first to receive the pot)
CREATE TABLE IF NOT EXISTS members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id),
  UNIQUE (group_id, position)
);

CREATE TABLE IF NOT EXISTS contributions (
  id          INTEGER PRIMARY KEY,
  group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  cycle       INTEGER NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  amount      INTEGER NOT NULL,
  proof_note  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (group_id, cycle, user_id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id           INTEGER PRIMARY KEY,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  cycle        INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  amount       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','released')),
  requested_by INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  released_at  TEXT,
  UNIQUE (group_id, cycle)
);

CREATE TABLE IF NOT EXISTS payout_approvals (
  payout_id  INTEGER NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (payout_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
