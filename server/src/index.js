import { openDb } from "./db.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
