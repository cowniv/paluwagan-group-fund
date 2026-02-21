import { openDb } from "./db.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const db = openDb(process.env.DB_FILE || "data/paluwagan.db");
const app = createApp(db, { jwtSecret: JWT_SECRET, corsOrigin: process.env.CLIENT_ORIGIN || true });

const server = app.listen(PORT, () => console.log(`Paluwagan API on http://localhost:${PORT}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => {
