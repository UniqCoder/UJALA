import { resolveSetup, setupWarnings } from './catalogues.js';
// Glue between the API and the algorithms: validate, run, time, format.
import { normalizeSetup, capacities, expandAppliances, splitMustRun, buildPlan, InputError } from './model.js';
import { greedy } from './algorithms/greedy.js';
import { knapsackDP } from './algorithms/knapsackDP.js';
import { branchAndBound } from './algorithms/branchAndBound.js';
import { bruteForce, BRUTE_LIMIT } from './algorithms/bruteForce.js';

export const ALGORITHMS = {
  greedy,
  dp: knapsackDP,
  'bb-lc': (items, caps, base, opts) => branchAndBound(items, caps, base, 'LC', opts),
  'bb-fifo': (items, caps, base, opts) => branchAndBound(items, caps, base, 'FIFO', opts),
  'bb-lifo': (items, caps, base, opts) => branchAndBound(items, caps, base, 'LIFO', opts),
  brute: bruteForce,
};

// O(n). Validates input and computes capacities and items once.
export function prepare(setup, appliances) {
  const s = normalizeSetup(resolveSetup(setup));
  const caps = capacities(s);
  const items = expandAppliances(appliances, s.outageHours);
  return { setup: s, warnings: setupWarnings(s), caps, items, ...splitMustRun(items, caps) };
}

// Run the full-constraint solver automatically; compare a fast feasible baseline if its search is capped.
function automatic(ctx, opts) {
  const t0 = performance.now();
  const exact = run('bb-lc', ctx, opts);
  let best = exact;
  if (exact.stats.capped) {
    const baseline = run('greedy', ctx);
    if (baseline.totalImportance > exact.totalImportance) best = baseline;
    best.warnings.push('Search limit reached. This is the best feasible plan found; the maximum importance score has not been proven.');
  }
  best.optimization = { mode: 'automatic', optimal: !exact.stats.capped,
    objective: 'maximize total appliance importance while meeting running load, energy, startup surge and must-run constraints' };
  best.stats.timeMs = Math.round((performance.now() - t0) * 1000) / 1000;
  return best;
}

function run(algorithm, ctx, opts) {
  if (algorithm === 'auto') return automatic(ctx, opts);
  if (!Object.hasOwn(ALGORITHMS, algorithm)) {
    throw new InputError(`Unknown method "${algorithm}". Use one of: ${Object.keys(ALGORITHMS).join(', ')}.`);
  }
  const t0 = performance.now();
  const result = ALGORITHMS[algorithm](ctx.optional, ctx.caps, ctx.base, opts);
  return buildPlan(algorithm, ctx, result, performance.now() - t0);
}

// O(n) setup plus the chosen algorithm's cost (greedy O(n log n), DP O(n·W·E),
// B&B O(2^n) worst case, brute force O(2^n · n)).
export function solve(algorithm, setup, appliances, opts) {
  return run(algorithm, prepare(setup, appliances), opts);
}

// O(2^n · n) dominated by brute force, which only runs when n ≤ 20.
export function compare(setup, appliances) {
  const ctx = prepare(setup, appliances);
  const plans = [];
  for (const name of Object.keys(ALGORITHMS)) {
    if (name === 'brute' && ctx.optional.length > BRUTE_LIMIT) continue;
    plans.push(run(name, ctx));
  }
  return { optionalCount: ctx.optional.length, plans };
}
