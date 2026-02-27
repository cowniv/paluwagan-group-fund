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
