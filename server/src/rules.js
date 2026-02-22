// Pure business rules for a paluwagan. No database, no Express, so they're easy to test.
//
// How a paluwagan works: N members each put in the same amount every cycle.
// Each cycle, the whole pot (amount x N) goes to one member, following a fixed
// rotation. After N cycles everyone has received exactly one payout.

export const FREQUENCIES = { weekly: 7, biweekly: 14, monthly: null };

/** Rotation order: keep the given order, or shuffle it with an injectable random fn. */
export function buildRotation(userIds, { shuffle = false, random = Math.random } = {}) {
  const order = [...userIds];
  if (shuffle) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  return order;
}

/** Who receives the pot in a given cycle (1-based). */
export function recipientForCycle(rotation, cycle) {
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > rotation.length) {
    throw new RangeError(`cycle must be between 1 and ${rotation.length}`);
  }
  return rotation[cycle - 1];
}

/** Due date of a cycle, as YYYY-MM-DD. Cycle 1 is due on the start date. */
export function cycleDueDate(startDate, frequency, cycle) {
  const d = new Date(startDate + "T00:00:00Z");
  if (frequency === "monthly") {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + (cycle - 1));
    // clamp e.g. Jan 31 -> Feb 28
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else {
    const days = FREQUENCIES[frequency];
    if (!days) throw new Error(`unknown frequency "${frequency}"`);
    d.setUTCDate(d.getUTCDate() + days * (cycle - 1));
  }
  return d.toISOString().slice(0, 10);
}

/** The cycle that is currently open: the latest one whose due date has arrived (min 1, max N). */
export function currentCycle(startDate, frequency, memberCount, today) {
  let cycle = 1;
  for (let c = 2; c <= memberCount; c++) {
    if (cycleDueDate(startDate, frequency, c) <= today) cycle = c;
  }
  return cycle;
}

/** The pot for one cycle. */
export function potSize(contributionAmount, memberCount) {
  return contributionAmount * memberCount;
}

/**
 * Approvals needed to release a payout: a strict majority of the members who
 * can vote. The recipient can't vote on their own payout.
 */
export function requiredApprovals(memberCount) {
  const voters = memberCount - 1;
  return Math.floor(voters / 2) + 1;
}

export function isApproved(approvalCount, memberCount) {
  return approvalCount >= requiredApprovals(memberCount);
}

/** Can a payout be requested for this cycle? Returns null if OK, or the reason. */
export function payoutBlocker({ paidUserIds, memberIds, existingPayout }) {
  if (existingPayout) return "A payout for this cycle already exists";
  const unpaid = memberIds.filter((id) => !paidUserIds.includes(id));
  if (unpaid.length) return `${unpaid.length} member(s) haven't paid this cycle yet`;
  return null;
}

/**
 * Ledger with running balance. Contributions add to the fund, released payouts take from it.
 * entries: [{ type: 'contribution'|'payout', amount, at, ... }]
 */
export function buildLedger(entries) {
  const sorted = [...entries].sort((a, b) => (a.at === b.at ? a.seq - b.seq : a.at < b.at ? -1 : 1));
  let balance = 0;
  return sorted.map((e) => {
    balance += e.type === "contribution" ? e.amount : -e.amount;
    return { ...e, balance };
  });
}

/** Members who missed a cycle whose due date has passed. */
export function overdueList({ rotationLength, startDate, frequency, memberIds, paidByCycle, today }) {
  const out = [];
  for (let cycle = 1; cycle <= rotationLength; cycle++) {
    const dueDate = cycleDueDate(startDate, frequency, cycle);
    if (dueDate >= today) break;
    const paid = paidByCycle[cycle] ?? [];
    for (const userId of memberIds) {
      if (!paid.includes(userId)) {
        const daysLate = Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
        out.push({ cycle, dueDate, userId, daysLate });
      }
    }
  }
  return out;
}
