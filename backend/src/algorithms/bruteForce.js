import { EPS, InputError } from '../model.js';

export const BRUTE_LIMIT = 20;

// O(2^n · n). Checks every subset with a bitmask; the ground truth for the tests.
export function bruteForce(items, caps, base) {
  const n = items.length;
  if (n > BRUTE_LIMIT) {
    throw new InputError(`Brute force is limited to ${BRUTE_LIMIT} optional appliances (you have ${n}); 2^${n} subsets would take too long.`);
  }
  let bestMask = 0;
  let bestValue = -1;
  const total = 2 ** n;
  for (let mask = 0; mask < total; mask++) {
    let load = base.load;
    let energy = base.energy;
    let surge = base.maxSurge;
    let value = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const it = items[i];
        load += it.watts;
        energy += it.energyWh;
        if (it.surgeExtra > surge) surge = it.surgeExtra;
        value += it.importance;
      }
    }
    const ok = load <= caps.maxW + EPS && energy <= caps.usableWh + EPS && load + surge <= caps.peakW + EPS;
    if (ok && value > bestValue) {
      bestValue = value;
      bestMask = mask;
    }
  }
  const chosen = [];
  for (let i = 0; i < n; i++) if (bestMask & (1 << i)) chosen.push(items[i]);
  return { chosen, stats: { operations: total, subsets: total } };
}
