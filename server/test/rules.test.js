import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRotation,
  recipientForCycle,
  cycleDueDate,
  currentCycle,
  requiredApprovals,
  isApproved,
  payoutBlocker,
  buildLedger,
  overdueList,
} from "../src/rules.js";

test("rotation keeps order unless shuffled, and shuffle is a permutation", () => {
  assert.deepEqual(buildRotation([1, 2, 3, 4]), [1, 2, 3, 4]);
  let seed = 0.3;
  const random = () => (seed = (seed * 9301 + 0.49297) % 1);
  const shuffled = buildRotation([1, 2, 3, 4, 5], { shuffle: true, random });
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
});

test("each member receives the pot exactly once over a full rotation", () => {
  const rotation = [7, 3, 9];
  assert.equal(recipientForCycle(rotation, 1), 7);
  assert.equal(recipientForCycle(rotation, 3), 9);
  const recipients = [1, 2, 3].map((c) => recipientForCycle(rotation, c));
  assert.equal(new Set(recipients).size, rotation.length);
  assert.throws(() => recipientForCycle(rotation, 4), RangeError);
  assert.throws(() => recipientForCycle(rotation, 0), RangeError);
});

test("due dates for weekly, biweekly and monthly (with month-end clamp)", () => {
  assert.equal(cycleDueDate("2026-02-02", "weekly", 1), "2026-02-02");
  assert.equal(cycleDueDate("2026-02-02", "weekly", 3), "2026-02-16");
  assert.equal(cycleDueDate("2026-02-02", "biweekly", 2), "2026-02-16");
  assert.equal(cycleDueDate("2026-01-31", "monthly", 2), "2026-02-28");
  assert.equal(cycleDueDate("2026-01-31", "monthly", 3), "2026-03-31");
});

test("current cycle advances with time and caps at member count", () => {
  assert.equal(currentCycle("2026-02-02", "weekly", 4, "2026-01-01"), 1);
  assert.equal(currentCycle("2026-02-02", "weekly", 4, "2026-02-10"), 2);
  assert.equal(currentCycle("2026-02-02", "weekly", 4, "2027-01-01"), 4);
});

test("majority approval excludes the recipient", () => {
  // 5 members -> 4 voters -> need 3
  assert.equal(requiredApprovals(5), 3);
  // 4 members -> 3 voters -> need 2
  assert.equal(requiredApprovals(4), 2);
  // 3 members -> 2 voters -> need 2 (a tie is not a majority)
  assert.equal(requiredApprovals(3), 2);
  assert.equal(isApproved(2, 5), false);
  assert.equal(isApproved(3, 5), true);
});

test("payout blocked until everyone paid, and only once per cycle", () => {
  assert.match(payoutBlocker({ paidUserIds: [1, 2], memberIds: [1, 2, 3] }), /1 member/);
  assert.equal(payoutBlocker({ paidUserIds: [1, 2, 3], memberIds: [1, 2, 3] }), null);
  assert.match(payoutBlocker({ paidUserIds: [1, 2, 3], memberIds: [1, 2, 3], existingPayout: {} }), /already/);
});

test("ledger keeps a running balance in time order", () => {
  const ledger = buildLedger([
    { type: "payout", amount: 1500, at: "2026-02-03", seq: 10 },
    { type: "contribution", amount: 500, at: "2026-02-01", seq: 1 },
    { type: "contribution", amount: 500, at: "2026-02-01", seq: 2 },
    { type: "contribution", amount: 500, at: "2026-02-02", seq: 3 },
  ]);
  assert.deepEqual(ledger.map((e) => e.balance), [500, 1000, 1500, 0]);
