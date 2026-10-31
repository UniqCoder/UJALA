import { EPS } from '../model.js';

const KEEP_BYTES = 40_000_000; // memory budget for the keep[][][] table
const HEATMAP = 40; // heatmap is downsampled to at most 40 × 40

// O(n · W · E) time and space, pseudo-polynomial: W and E are the remaining watt and
// energy capacities measured in table steps. Exact over C1 + C2; ignores C3 (surge).
//
// Weights are rounded UP to whole steps, so every answer is truly feasible. Steps start at
// 1 W and 1 Wh (exact for whole-number inputs) and double only if the table would be too big.
// The PRD's fixed 10 W / 25 Wh steps lose the optimum on TC1 (40 instead of 43).
export function knapsackDP(items, caps, base) {
  const n = items.length;
  const capW = Math.max(0, caps.maxW - base.load);
  const capE = Math.max(0, caps.usableWh - base.energy);
  const cellLimit = Math.min(4_000_000, Math.floor(KEEP_BYTES / Math.max(n, 1)));

  let wStep = 1;
  let eStep = 1;
  let wq, eq, W, E;
  for (;;) {
    wq = items.map((it) => Math.ceil(it.watts / wStep - EPS));
    eq = items.map((it) => Math.ceil(it.energyWh / eStep - EPS));
    // No point making the table bigger than everything put together.
    W = Math.min(Math.floor(capW / wStep + EPS), sum(wq));
    E = Math.min(Math.floor(capE / eStep + EPS), sum(eq));
    if ((W + 1) * (E + 1) <= cellLimit) break;
    if (W >= E) wStep *= 2;
    else eStep *= 2;
  }

  const cols = E + 1;
  const cells = (W + 1) * cols;
  const dp = new Int32Array(cells); // dp[w][e] = best importance within w steps of watts, e of energy
  const keep = new Uint8Array(n * cells); // keep[i][w][e] = item i was taken to reach dp[w][e]
  let operations = 0;

  for (let i = 0; i < n; i++) {
    const wi = wq[i];
    const ei = eq[i];
    const vi = items[i].importance;
    // Downward loops so each item is used at most once (0/1).
    for (let w = W; w >= wi; w--) {
      for (let e = E; e >= ei; e--) {
        operations++;
        const take = dp[(w - wi) * cols + (e - ei)] + vi;
        if (take > dp[w * cols + e]) {
          dp[w * cols + e] = take;
          keep[i * cells + w * cols + e] = 1;
        }
      }
    }
  }

  // Walk back from the full table to find which items were taken.
  const chosen = [];
  const path = [{ w: W * wStep, e: E * eStep }];
  let w = W;
  let e = E;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i * cells + w * cols + e]) {
      chosen.push(items[i]);
      w -= wq[i];
      e -= eq[i];
      path.push({ w: w * wStep, e: e * eStep });
    }
  }

  const warnings = [];
  if (wStep > 1 || eStep > 1) {
    warnings.push(`DP table was coarsened to ${wStep} W × ${eStep} Wh steps to fit in memory, so the result may be slightly below the optimum.`);
  }
  return {
    chosen,
    stats: { operations, cells: n * cells, W, E, wStep, eStep },
    dpTable: heatmap(dp, W, E, wStep, eStep, path),
    warnings,
  };
}

function sum(a) {
  let s = 0;
  for (const x of a) s += x;
  return s;
}

// O(HEATMAP²). Samples the final dp table on an evenly spaced grid for the Lab heatmap.
function heatmap(dp, W, E, wStep, eStep, path) {
  const rows = Math.min(W + 1, HEATMAP);
  const cols = Math.min(E + 1, HEATMAP);
  const at = (i, count, max) => (count === 1 ? 0 : Math.round((i * max) / (count - 1)));
  const values = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(dp[at(r, rows, W) * (E + 1) + at(c, cols, E)]);
    values.push(row);
  }
  const wAxis = [];
  for (let r = 0; r < rows; r++) wAxis.push(at(r, rows, W) * wStep);
  const eAxis = [];
  for (let c = 0; c < cols; c++) eAxis.push(at(c, cols, E) * eStep);
  return { wAxis, eAxis, values, path };
}
