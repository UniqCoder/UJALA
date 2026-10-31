import { heapSort } from '../ds/MaxHeap.js';
import { fits, addItem } from '../model.js';

// Importance per watt, highest first.
export const byValuePerWatt = (a, b) => a.importance / a.watts - b.importance / b.watts;

// O(n log n). Heap-sorts by importance per watt, then adds each item that keeps C1–C3 true.
// Fast, but not optimal for 0/1 choices (see TC2).
export function greedy(items, caps, base) {
  const { sorted, comparisons } = heapSort(items, byValuePerWatt);
  let state = base;
  const chosen = [];
  for (const it of sorted) {
    if (fits(state, it, caps)) {
      state = addItem(state, it);
      chosen.push(it);
    }
  }
  return { chosen, stats: { operations: comparisons + sorted.length } };
}
