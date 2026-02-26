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
  assert.equal((await call("GET", "/groups")).status, 401);
});

test("create a group with a rotation", async () => {
  const bad = await call("POST", "/groups", { name: "X", contributionAmount: 500, frequency: "weekly", startDate: "2026-02-02", memberEmails: ["ghost@example.com"] }, "ana");
  assert.equal(bad.status, 400);

  const r = await call("POST", "/groups", {
    name: "Org Ipon",
    contributionAmount: 500,
    frequency: "weekly",
    startDate: "2026-02-02",
    memberEmails: ["ben@example.com", "carla@example.com", "dino@example.com"],
  }, "ana");
  assert.equal(r.status, 201);
  groupId = r.body.id;

  const g = (await call("GET", `/groups/${groupId}`, null, "ana")).body;
  assert.equal(g.pot, 2000);
  assert.equal(g.requiredApprovals, 2);
  assert.deepEqual(g.cycles.map((c) => c.recipientId), [ids.ana, ids.ben, ids.carla, ids.dino]);
});

test("payout needs everyone paid, then a majority of other members", async () => {
  await call("POST", `/groups/${groupId}/contributions`, { cycle: 1, proofNote: "GCash 111" }, "ana");
  tick();
  assert.equal((await call("POST", `/groups/${groupId}/contributions`, { cycle: 1, proofNote: "again" }, "ana")).status, 409);
  assert.equal((await call("POST", `/groups/${groupId}/contributions`, { cycle: 1 }, "ben")).status, 400); // proof note required

  const early = await call("POST", `/groups/${groupId}/payouts`, { cycle: 1 }, "ben");
  assert.equal(early.status, 409);

  for (const who of ["ben", "carla", "dino"]) {
    tick();
    await call("POST", `/groups/${groupId}/contributions`, { cycle: 1, proofNote: `ref-${who}` }, who);
  }
  tick();
  const req = await call("POST", `/groups/${groupId}/payouts`, { cycle: 1 }, "ben");
  assert.equal(req.status, 201);
  const pid = req.body.id;

  // recipient (ana) can't vote for herself
  assert.equal((await call("POST", `/groups/${groupId}/payouts/${pid}/approve`, null, "ana")).status, 403);

  tick();
  const v1 = await call("POST", `/groups/${groupId}/payouts/${pid}/approve`, null, "ben");
  assert.deepEqual([v1.body.approvals, v1.body.released], [1, false]);
  assert.equal((await call("POST", `/groups/${groupId}/payouts/${pid}/approve`, null, "ben")).status, 409);

  tick();
  const v2 = await call("POST", `/groups/${groupId}/payouts/${pid}/approve`, null, "carla");
  assert.deepEqual([v2.body.approvals, v2.body.released], [2, true]);
  assert.equal((await call("POST", `/groups/${groupId}/payouts/${pid}/approve`, null, "dino")).status, 409);
});

test("ledger balance, overdue view and audit log", async () => {
  tick();
  await call("POST", `/groups/${groupId}/contributions`, { cycle: 2, proofNote: "early" }, "carla");

  const ledger = (await call("GET", `/groups/${groupId}/ledger`, null, "dino")).body;
  assert.deepEqual(ledger.entries.map((e) => e.balance), [500, 1000, 1500, 2000, 0, 500]);
  assert.equal(ledger.balance, 500);

  clock = new Date("2026-02-12T08:00:00Z"); // cycle 2 (due Feb 9) is now late
  const overdue = (await call("GET", `/groups/${groupId}/overdue`, null, "ana")).body;
  assert.deepEqual(overdue.map((o) => o.name).sort(), ["ana", "ben", "dino"]);
  assert.ok(overdue.every((o) => o.daysLate === 3));

  const audit = (await call("GET", `/groups/${groupId}/audit`, null, "ana")).body;
  const actions = audit.map((a) => a.action);
  assert.ok(actions.includes("payout.released"));
  assert.equal(actions.at(-1), "group.created");
});

test("non-members can't see a group", async () => {
  const r = await call("POST", "/auth/register", { email: "outsider@example.com", name: "Out", password: "password123" });
  tokens.out = r.body.token;
  assert.equal((await call("GET", `/groups/${groupId}`, null, "out")).status, 403);
});
