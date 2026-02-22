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

