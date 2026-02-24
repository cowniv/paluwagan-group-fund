// Demo data: 5 users and one group already a few cycles in.
// Everyone's password is "password123".
import bcrypt from "bcryptjs";
import { rmSync } from "node:fs";
import { openDb } from "./db.js";
import { cycleDueDate } from "./rules.js";

const file = process.env.DB_FILE || "data/paluwagan.db";
for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
const db = openDb(file);

const hash = bcrypt.hashSync("password123", 10);
const people = [
  ["ana@example.com", "Ana Reyes"],
  ["ben@example.com", "Ben Cruz"],
  ["carla@example.com", "Carla Santos"],
  ["dino@example.com", "Dino Garcia"],
  ["ella@example.com", "Ella Mendoza"],
];
const ids = people.map(([email, name]) => Number(db.prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)").run(email, name, hash).lastInsertRowid));

// start 3 weeks ago so cycles 1-4 are already due
const start = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
const at = (cycle, hour) => `${cycleDueDate(start, "weekly", cycle)}T${String(hour).padStart(2, "0")}:00:00.000Z`;

const groupId = Number(
  db.prepare("INSERT INTO groups (name, contribution_amount, frequency, start_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("Barkada Ipon 2026", 500, "weekly", start, ids[0], at(1, 1)).lastInsertRowid
);
ids.forEach((id, i) => db.prepare("INSERT INTO members (group_id, user_id, position) VALUES (?, ?, ?)").run(groupId, id, i + 1));

const log = (actor, action, details, when) =>
  db.prepare("INSERT INTO audit_log (group_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)").run(groupId, actor, action, JSON.stringify(details), when);
log(ids[0], "group.created", { name: "Barkada Ipon 2026", contributionAmount: 500, frequency: "weekly", startDate: start, rotation: ids }, at(1, 1));

const pay = (cycle, idx, hour) => {
  const note = `GCash ref ${1000 + cycle * 10 + idx}`;
  db.prepare("INSERT INTO contributions (group_id, cycle, user_id, amount, proof_note, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(groupId, cycle, ids[idx], 500, note, at(cycle, hour));
  log(ids[idx], "contribution.recorded", { cycle, amount: 500, proofNote: note }, at(cycle, hour));
};

// cycle 1: everyone paid, payout to Ana released (3 of 4 approvals)
[0, 1, 2, 3, 4].forEach((i) => pay(1, i, 2 + i));
const p1 = Number(db.prepare("INSERT INTO payouts (group_id, cycle, recipient_id, amount, status, requested_by, created_at, released_at) VALUES (?, 1, ?, 2500, 'released', ?, ?, ?)").run(groupId, ids[0], ids[1], at(1, 8), at(1, 12)).lastInsertRowid);
log(ids[1], "payout.requested", { cycle: 1, recipientId: ids[0], amount: 2500, required: 3 }, at(1, 8));
[1, 2, 3].forEach((i, k) => {
  db.prepare("INSERT INTO payout_approvals (payout_id, user_id, created_at) VALUES (?, ?, ?)").run(p1, ids[i], at(1, 9 + k));
  log(ids[i], "payout.approved", { payoutId: p1, cycle: 1, approvals: k + 1, required: 3 }, at(1, 9 + k));
});
log(null, "payout.released", { payoutId: p1, cycle: 1, recipientId: ids[0], amount: 2500 }, at(1, 12));

// cycle 2: everyone paid, payout to Ben pending with 1 approval
[0, 1, 2, 3, 4].forEach((i) => pay(2, i, 2 + i));
