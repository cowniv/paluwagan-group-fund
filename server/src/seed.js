// Demo data: 5 users and one group already a few cycles in.
// Everyone's password is "password123".
import bcrypt from "bcryptjs";
import { rmSync } from "node:fs";
import { openDb } from "./db.js";
import { cycleDueDate } from "./rules.js";

const file = process.env.DB_FILE || "data/paluwagan.db";
for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
const db = openDb(file);

