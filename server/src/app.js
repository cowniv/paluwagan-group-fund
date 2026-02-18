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
    auth,
    wrap((req, res) => {
      const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(req.userId);
      if (!user) throw new HttpError(401, "User no longer exists");
      res.json(user);
    })
  );

  // ---------- groups ----------
  app.get(
    "/api/groups",
    auth,
    wrap((req, res) => {
      const groups = db
        .prepare(
          `SELECT g.*, (SELECT COUNT(*) FROM members WHERE group_id = g.id) AS member_count
           FROM groups g JOIN members m ON m.group_id = g.id
           WHERE m.user_id = ? ORDER BY g.created_at DESC, g.id DESC`
        )
        .all(req.userId);
      res.json(
        groups.map((g) => ({
          id: g.id,
          name: g.name,
          contributionAmount: g.contribution_amount,
          frequency: g.frequency,
          startDate: g.start_date,
          memberCount: g.member_count,
          currentCycle: currentCycle(g.start_date, g.frequency, g.member_count, today()),
        }))
      );
    })
  );

  app.post(
    "/api/groups",
    auth,
    wrap((req, res) => {
      const { name, contributionAmount, frequency, startDate, memberEmails = [], shuffle = false } = req.body ?? {};
      if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "Group name is required");
      if (!Number.isInteger(contributionAmount) || contributionAmount <= 0) throw new HttpError(400, "Contribution must be a positive whole number");
      if (!(frequency in FREQUENCIES)) throw new HttpError(400, "Frequency must be weekly, biweekly or monthly");
      if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new HttpError(400, "Start date must be YYYY-MM-DD");
      if (!Array.isArray(memberEmails)) throw new HttpError(400, "memberEmails must be a list");

      // creator is always a member; other members must already have accounts
      const creator = db.prepare("SELECT id, email FROM users WHERE id = ?").get(req.userId);
      const emails = [...new Set([creator.email, ...memberEmails.map((e) => String(e).trim().toLowerCase())])];
      const ids = [];
      const missing = [];
      for (const email of emails) {
        const u = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
        if (u) ids.push(u.id);
        else missing.push(email);
      }
      if (missing.length) throw new HttpError(400, `No account found for: ${missing.join(", ")}`);
      if (ids.length < 3) throw new HttpError(400, "A paluwagan needs at least 3 members");

      const rotation = buildRotation(ids, { shuffle: Boolean(shuffle), random });

      const groupId = db.transaction(() => {
        const { lastInsertRowid } = db
          .prepare("INSERT INTO groups (name, contribution_amount, frequency, start_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(name.trim(), contributionAmount, frequency, startDate, req.userId, nowIso());
        const gid = Number(lastInsertRowid);
        const insert = db.prepare("INSERT INTO members (group_id, user_id, position) VALUES (?, ?, ?)");
        rotation.forEach((uid, i) => insert.run(gid, uid, i + 1));
        audit(gid, req.userId, "group.created", { name: name.trim(), contributionAmount, frequency, startDate, rotation });
