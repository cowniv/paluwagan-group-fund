// End-to-end flow against an in-memory SQLite database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";

let server, base;
let clock = new Date("2026-02-02T08:00:00Z");
const tokens = {};
const ids = {};

before(() => {
  const app = createApp(openDb(), { jwtSecret: "test-secret", now: () => clock });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

async function call(method, path, body, who) {
  const res = await fetch(base + path, {
