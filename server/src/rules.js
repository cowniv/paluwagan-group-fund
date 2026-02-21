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
