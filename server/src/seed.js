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
