import { heapSort, MaxHeap } from '../ds/MaxHeap.js';
import { Queue } from '../ds/Queue.js';
import { Stack } from '../ds/Stack.js';
import { EPS, fits, addItem } from '../model.js';
import { byValuePerWatt } from './greedy.js';

const NODE_CAP = 200_000;
const valuePerWh = (it) => (it.energyWh > 0 ? it.importance / it.energyWh : 1e12);

// One interface over the three containers: LC = max-heap on bound, FIFO = queue, LIFO = stack.
function makeContainer(strategy) {
  if (strategy === 'LC') {
    const heap = new MaxHeap((a, b) => a.bound - b.bound);
    return { put: (x) => heap.push(x), take: () => heap.pop(), size: () => heap.size };
  }
  if (strategy === 'FIFO') {
    const q = new Queue();
    return { put: (x) => q.enqueue(x), take: () => q.dequeue(), size: () => q.size };
  }
  const st = new Stack();
  return { put: (x) => st.push(x), take: () => st.pop(), size: () => st.size };
}

// O(2^n · n) worst case (2^n nodes, O(n) bound each); bounding prunes most of the tree in practice.
// Exact over C1 + C2 + C3. strategy is 'LC' | 'FIFO' | 'LIFO'.
// traceLimit > 0 records the first nodes generated, for the Lab's state-space tree.
export function branchAndBound(items, caps, base, strategy = 'LC', { traceLimit = 0 } = {}) {
  const { sorted, comparisons } = heapSort(items, byValuePerWatt);
  const n = sorted.length;
  // Same items ordered by importance per Wh, remembering their index in `sorted`.
  const byEnergy = heapSort(
    sorted.map((it, idx) => ({ it, idx })),
    (a, b) => valuePerWh(a.it) - valuePerWh(b.it)
  ).sorted;

  // O(n). Upper bound = min of two fractional-knapsack relaxations of the undecided items:
  // one fills the remaining watts (ignoring energy), the other the remaining energy
  // (ignoring watts). Each drops a constraint, so each is a valid bound; the smaller is tighter.
  // Values are whole numbers, so the bound can be floored.
  function upperBound(node) {
    let room = caps.maxW - node.load;
    let byWatts = node.value;
    for (let i = node.level; i < n && room > EPS; i++) {
      const it = sorted[i];
      if (it.watts <= room) {
        room -= it.watts;
        byWatts += it.importance;
      } else {
        byWatts += (it.importance * room) / it.watts;
        room = 0;
      }
    }
    room = caps.usableWh - node.energy;
    let byWh = node.value;
    for (const { it, idx } of byEnergy) {
      if (idx < node.level) continue;
      if (it.energyWh <= room) {
        room -= it.energyWh;
        byWh += it.importance;
      } else {
        byWh += (it.importance * room) / it.energyWh;
        break;
      }
    }
    return Math.floor(Math.min(byWatts, byWh) + EPS);
  }

  const stats = { operations: 0, nodesGenerated: 0, nodesExpanded: 0, pruned: 0, infeasible: 0, capped: false };
  const trace = [];
  const record = (node, parent, decision, status) => {
    if (trace.length >= traceLimit) return;
    node.rec = { id: stats.nodesGenerated, parent: parent?.rec?.id ?? null, level: node.level, decision, value: node.value, bound: node.bound ?? null, status };
    trace.push(node.rec);
  };
  const mark = (node, status) => {
    if (node.rec) node.rec.status = status;
  };

  const makeNode = (level, s, taken) => ({ level, load: s.load, energy: s.energy, maxSurge: s.maxSurge, value: s.value, taken, bound: 0 });
  const root = makeNode(0, { ...base, value: 0 }, []);
  root.bound = upperBound(root);
  stats.nodesGenerated++;
  record(root, null, 'root', 'queued');

  let best = { value: 0, taken: [], rec: root.rec };
  const box = makeContainer(strategy);
  box.put(root);

  while (box.size() > 0) {
    const node = box.take();
    if (node.bound <= best.value) {
      stats.pruned++;
      mark(node, 'pruned');
      continue;
    }
    if (node.level === n) continue;
    if (stats.nodesExpanded >= NODE_CAP) {
      stats.capped = true;
      break;
    }
    stats.nodesExpanded++;
    mark(node, 'expanded');
    const item = sorted[node.level];
    const children = [];

    // Child 1: include the item.
    stats.nodesGenerated++;
    if (fits(node, item, caps)) {
      const inc = makeNode(node.level + 1, addItem(node, item), node.taken.concat(item));
      inc.bound = upperBound(inc);
      record(inc, node, 'include', 'queued');
      if (inc.value > best.value) best = { value: inc.value, taken: inc.taken, rec: inc.rec };
      if (inc.bound > best.value) children.push(inc);
      else {
        stats.pruned++;
        mark(inc, 'pruned');
      }
    } else {
      stats.infeasible++;
      record({ level: node.level + 1, value: node.value + item.importance }, node, 'include', 'infeasible');
    }

    // Child 2: exclude the item.
    stats.nodesGenerated++;
    const exc = makeNode(node.level + 1, node, node.taken);
    exc.bound = upperBound(exc);
    record(exc, node, 'exclude', 'queued');
    if (exc.bound > best.value) children.push(exc);
    else {
      stats.pruned++;
      mark(exc, 'pruned');
    }

    // On a stack the last child pushed is explored first; push include last so LIFO
    // dives down the include branch (classic depth-first) instead of the empty one.
    if (strategy === 'LIFO') children.reverse();
    for (const c of children) box.put(c);
  }

  stats.operations = stats.nodesExpanded;
  stats.sortComparisons = comparisons;
  const result = { chosen: best.taken, stats };
  if (traceLimit > 0) result.trace = { nodes: trace, bestId: best.rec?.id ?? null };
  return result;
}
