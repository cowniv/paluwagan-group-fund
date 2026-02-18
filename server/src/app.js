import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { signToken, requireAuth } from "./auth.js";
import {
  buildRotation,
  recipientForCycle,
  cycleDueDate,
  currentCycle,
  potSize,
  requiredApprovals,
  isApproved,
  payoutBlocker,
  buildLedger,
  overdueList,
  FREQUENCIES,
} from "./rules.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param db  better-sqlite3 database from openDb()
 * @param opts.jwtSecret
 * @param opts.now  () => Date, injectable so tests can time-travel
 * @param opts.random  () => number, for rotation shuffling
 */
export function createApp(db, { jwtSecret, now = () => new Date(), random = Math.random, corsOrigin = true } = {}) {
  if (!jwtSecret) throw new Error("jwtSecret is required");
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "50kb" }));

  const nowIso = () => now().toISOString();
  const today = () => nowIso().slice(0, 10);

  // ---------- helpers ----------
  const audit = (groupId, actorId, action, details = {}) =>
    db
      .prepare("INSERT INTO audit_log (group_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(groupId, actorId, action, JSON.stringify(details), nowIso());

  function loadGroup(groupId, userId) {
    const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
    if (!group) throw new HttpError(404, "Group not found");
    const members = db
      .prepare(
        `SELECT m.user_id AS id, u.name, u.email, m.position
         FROM members m JOIN users u ON u.id = m.user_id
         WHERE m.group_id = ? ORDER BY m.position`
      )
      .all(groupId);
    if (!members.some((m) => m.id === userId)) throw new HttpError(403, "You are not a member of this group");
    return { group, members, rotation: members.map((m) => m.id) };
  }

  function paidByCycle(groupId) {
    const map = {};
    for (const c of db.prepare("SELECT cycle, user_id FROM contributions WHERE group_id = ?").all(groupId)) {
      (map[c.cycle] ??= []).push(c.user_id);
    }
    return map;
  }

  function payoutWithVotes(payout, memberCount) {
    const approvals = db
      .prepare(
        `SELECT a.user_id AS userId, u.name, a.created_at AS at
         FROM payout_approvals a JOIN users u ON u.id = a.user_id WHERE a.payout_id = ?`
      )
      .all(payout.id);
    return {
      id: payout.id,
      cycle: payout.cycle,
      recipientId: payout.recipient_id,
      amount: payout.amount,
      status: payout.status,
      createdAt: payout.created_at,
      releasedAt: payout.released_at,
      approvals,
      required: requiredApprovals(memberCount),
    };
  }

  const wrap = (fn) => (req, res, next) => {
    try {
      fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

  // ---------- auth ----------
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.post(
    "/api/auth/register",
    wrap((req, res) => {
      const { email, name, password } = req.body ?? {};
      if (typeof email !== "string" || !EMAIL_RE.test(email)) throw new HttpError(400, "A valid email is required");
      if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "Name is required");
      if (typeof password !== "string" || password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
      const normalized = email.trim().toLowerCase();
      if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(normalized)) throw new HttpError(409, "Email is already registered");
      const hash = bcrypt.hashSync(password, 10);
      const { lastInsertRowid } = db
        .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
        .run(normalized, name.trim(), hash);
      const user = { id: Number(lastInsertRowid), email: normalized, name: name.trim() };
      res.status(201).json({ token: signToken(user, jwtSecret), user });
    })
  );

  app.post(
    "/api/auth/login",
    wrap((req, res) => {
      const { email, password } = req.body ?? {};
      const row = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email ?? "").trim().toLowerCase());
      if (!row || !bcrypt.compareSync(String(password ?? ""), row.password_hash)) {
        throw new HttpError(401, "Wrong email or password");
      }
      const user = { id: row.id, email: row.email, name: row.name };
      res.json({ token: signToken(user, jwtSecret), user });
    })
  );

  const auth = requireAuth(jwtSecret);

  app.get(
    "/api/me",
