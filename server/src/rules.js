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
