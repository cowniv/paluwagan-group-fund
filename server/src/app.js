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
