// Acceptance checks from PRD Section 10.4 plus data-structure unit checks.
// Expected optima always come from brute force, never typed by hand.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MaxHeap, heapSort } from '../ds/MaxHeap.js';
import { Queue } from '../ds/Queue.js';
import { Stack } from '../ds/Stack.js';
import { AVLTree } from '../ds/AVLTree.js';
import { BST } from '../ds/BST.js';
import { normalizeSetup, capacities } from '../model.js';
import { solve, compare } from '../planner.js';
import { stagedPlan } from '../algorithms/stagedPlan.js';
import { app } from '../server.js';

const cases = JSON.parse(readFileSync(new URL('../../data/testcases.json', import.meta.url), 'utf8'));
const tc = (id) => cases.find((c) => c.id === id);
const plan = (alg, c) => solve(alg, c.setup, c.appliances);
const BB = ['bb-lc', 'bb-fifo', 'bb-lifo'];

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${err.message.split('\n').join('\n        ')}`);
  }
}

console.log('\nData structures');

await test('heap sort orders 500 random numbers, largest first', () => {
  const xs = Array.from({ length: 500 }, () => Math.floor(Math.random() * 1000));
  const { sorted } = heapSort(xs, (a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1] >= sorted[i]);
  assert.equal(sorted.length, xs.length);
});

await test('max-heap pops in priority order', () => {
  const h = new MaxHeap((a, b) => a - b);
  for (const x of [5, 1, 9, 3, 7]) h.push(x);
  assert.deepEqual([h.pop(), h.pop(), h.pop(), h.pop(), h.pop(), h.pop()], [9, 7, 5, 3, 1, undefined]);
});

await test('queue stays FIFO across wrap-around and growth', () => {
  const q = new Queue(4);
  const out = [];
  for (let i = 0; i < 3; i++) q.enqueue(i);
  out.push(q.dequeue(), q.dequeue());
  for (let i = 3; i < 10; i++) q.enqueue(i);
  while (q.size) out.push(q.dequeue());
  assert.deepEqual(out, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(q.dequeue(), undefined);
});

await test('stack is LIFO', () => {
  const s = new Stack();
  for (const x of [1, 2, 3]) s.push(x);
  assert.deepEqual([s.pop(), s.pop(), s.pop(), s.pop()], [3, 2, 1, undefined]);
});

await test('AVL stays balanced on 1000 sorted keys; plain BST becomes a list', () => {
  const avl = new AVLTree();
  const bst = new BST();
  for (let i = 0; i < 1000; i++) {
    const key = String(i).padStart(4, '0');
    avl.insert(key, i);
    bst.insert(key);
  }
  assert.ok(avl.height() <= 1.45 * Math.log2(1002), `AVL height ${avl.height()}`);
  assert.equal(bst.height(), 1000);
  assert.equal(avl.get('0500'), 500);
  const all = avl.prefixSearch('');
  assert.equal(all.length, 1000);
  for (let i = 0; i < 1000; i++) assert.equal(all[i], i);
});

await test('AVL prefix search finds exactly the matching keys', () => {
  const avl = new AVLTree();
  for (const k of ['fan', 'fridge', 'fan heater', 'tv', 'tube light', 'f', 'geyser']) avl.insert(k, k);
  assert.deepEqual(avl.prefixSearch('fa'), ['fan', 'fan heater']);
  assert.deepEqual(avl.prefixSearch('t'), ['tube light', 'tv']);
  assert.deepEqual(avl.prefixSearch('x'), []);
});

console.log('\nModel');

await test('TC1 capacities: 640 W running, 960 W peak, about 1071 Wh usable', () => {
  const caps = capacities(normalizeSetup(tc('TC1').setup));
  assert.equal(caps.maxW, 640);
  assert.equal(caps.peakW, 960);
  assert.ok(Math.abs(caps.usableWh - 1071) < 1);
});

console.log('\nAlgorithms');

for (const id of ['TC1', 'TC3', 'TC6']) {
  await test(`${id}: DP and all three branch and bound strategies match brute force`, () => {
    const best = plan('brute', tc(id)).totalImportance;
    for (const alg of ['dp', ...BB]) {
      const p = plan(alg, tc(id));
      assert.equal(p.totalImportance, best, `${alg} got ${p.totalImportance}, brute force ${best}`);
      assert.ok(Object.values(p.constraintsOk).every(Boolean), `${alg} broke a constraint`);
    }
  });
}

await test('every feasible case: B&B equals brute force, greedy never beats it, all B&B plans are valid', () => {
  for (const c of cases.filter((c) => c.id !== 'TC5')) {
    const best = plan('brute', c).totalImportance;
    for (const alg of BB) {
      const p = plan(alg, c);
      assert.equal(p.totalImportance, best, `${c.id} ${alg}`);
      assert.ok(Object.values(p.constraintsOk).every(Boolean), `${c.id} ${alg} broke a constraint`);
    }
    assert.ok(plan('greedy', c).totalImportance <= best, `${c.id} greedy beat the optimum`);
  }
});

await test('TC2: greedy returns less than the optimum', () => {
  const g = plan('greedy', tc('TC2')).totalImportance;
  const best = plan('brute', tc('TC2')).totalImportance;
  assert.ok(g < best, `greedy ${g}, optimum ${best}`);
  console.log(`        greedy ${g}, optimum ${best}`);
});

await test('TC4: DP plan fails the surge check with a warning; B&B plan passes', () => {
  const dp = plan('dp', tc('TC4'));
  assert.equal(dp.surge.ok, false);
  assert.ok(dp.warnings.some((w) => /surge/i.test(w)));
  for (const alg of BB) assert.equal(plan(alg, tc('TC4')).surge.ok, true, alg);
  assert.ok(!plan('bb-lc', tc('TC4')).selected.some((it) => /pump/i.test(it.name)));
});

await test('TC5: solving throws an error naming the running-load limit', () => {
  assert.throws(() => plan('bb-lc', tc('TC5')), (err) => err.status === 400 && /running load/i.test(err.message));
});

await test('TC6: least-cost B&B expands fewer nodes than brute force checks subsets', () => {
  const { plans } = compare(tc('TC6').setup, tc('TC6').appliances);
  const by = Object.fromEntries(plans.map((p) => [p.algorithm, p.stats]));
  assert.equal(by.brute.subsets, 2 ** 20);
  assert.ok(by['bb-lc'].nodesExpanded < by.brute.subsets);
  console.log(`        brute ${by.brute.subsets} subsets, DP ${by.dp.cells} cells, ` +
    `B&B expanded LC ${by['bb-lc'].nodesExpanded} / FIFO ${by['bb-fifo'].nodesExpanded} / LIFO ${by['bb-lifo'].nodesExpanded}`);
});

await test('staged plan gives one stage per duration with switch-off instructions', () => {
  const { stages } = stagedPlan(tc('TC1').setup, tc('TC1').appliances, [2, 4, 6, 8]);
  assert.equal(stages.length, 4);
  assert.ok(stages.slice(1).some((s) => s.switchOff?.length > 0));
});

await test('bad input is rejected with a clear message', () => {
  assert.throws(() => solve('bb-lc', { inverterVA: 800 }, []), /battery capacity/i);
  assert.throws(() => solve('bb-lc', tc('TC1').setup, []), /add the appliances/i);
  assert.throws(() => solve('constructor', tc('TC1').setup, tc('TC1').appliances), /unknown method/i);
});

console.log('\nAPI');

const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api`;
const post = (path, data) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

await test('GET /health and /catalogue prefix search', async () => {
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.ok, true);
  assert.ok(health.catalogueSize >= 50);
  const fans = await (await fetch(`${base}/catalogue?prefix=ce`)).json();
  assert.ok(fans.some((x) => x.name === 'Ceiling fan'));
});

await test('GET /catalogue/heights: BST height is n, AVL height near log n', async () => {
  const h = await (await fetch(`${base}/catalogue/heights`)).json();
  assert.equal(h.bstHeight, h.n);
  assert.ok(h.avlHeight <= 1.45 * Math.log2(h.n + 2));
});

await test('POST /plan on TC5 returns HTTP 400 naming the running-load limit', async () => {
  const res = await post('/plan', { ...tc('TC5'), algorithm: 'dp' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /running load/i);
});

await test('POST /plan, /compare, /staged and /bb-tree respond on TC1', async () => {
  const p = await (await post('/plan', { ...tc('TC1'), algorithm: 'dp' })).json();
  assert.ok(p.dpTable.values.length > 0);
  const c = await (await post('/compare', tc('TC1'))).json();
  assert.equal(c.plans.length, 6);
  const s = await (await post('/staged', tc('TC1'))).json();
  assert.equal(s.stages.length, 4);
  const t = await (await post('/bb-tree', { ...tc('TC1'), strategy: 'fifo' })).json();
  assert.ok(t.nodes.length > 0 && t.nodes.length <= 60);
});

server.close();

console.log('\nCode');

await test('every exported function in src/ has a time-complexity comment above it', () => {
  const dirs = ['..', '../ds', '../algorithms'].map((d) => new URL(d + '/', import.meta.url));
  const missing = [];
  for (const dir of dirs) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const lines = readFileSync(new URL(file, dir), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/^export function/.test(line)) return;
        const above = lines.slice(Math.max(0, i - 6), i).join('\n');
        if (!/O\(/.test(above)) missing.push(`${file}: ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(missing, []);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
