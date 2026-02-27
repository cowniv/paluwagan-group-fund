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
