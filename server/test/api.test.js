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
    method,
    headers: { "Content-Type": "application/json", ...(who && { Authorization: `Bearer ${tokens[who]}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const tick = (minutes = 1) => (clock = new Date(clock.getTime() + minutes * 60_000));

let groupId;

test("register users and reject bad logins", async () => {
  for (const name of ["ana", "ben", "carla", "dino"]) {
    const r = await call("POST", "/auth/register", { email: `${name}@example.com`, name, password: "password123" });
    assert.equal(r.status, 201);
    tokens[name] = r.body.token;
    ids[name] = r.body.user.id;
  }
  assert.equal((await call("POST", "/auth/register", { email: "ana@example.com", name: "x", password: "password123" })).status, 409);
  assert.equal((await call("POST", "/auth/login", { email: "ana@example.com", password: "nope" })).status, 401);
