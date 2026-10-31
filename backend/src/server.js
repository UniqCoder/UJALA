import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AVLTree } from './ds/AVLTree.js';
import { BST } from './ds/BST.js';
import { InputError } from './model.js';
import { inverters, specifications, sources, algorithmCatalogue } from './catalogues.js';
import { solve, compare } from './planner.js';
import { stagedPlan } from './algorithms/stagedPlan.js';

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const testcases = readJson('../data/testcases.json');

const catalogue = new AVLTree();
for (const item of readJson('../data/catalogue.json')) catalogue.insert(item.name.toLowerCase(), item);

for (const item of algorithmCatalogue()) catalogue.insert(item.name.toLowerCase(), item);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const api = express.Router();
const body = (req) => req.body ?? {};

api.get('/health', (req, res) => res.json({ ok: true, catalogueSize: catalogue.size }));

// Static JSON catalogues: filters are case-insensitive, repeated/object query values rejected.
function filterValue(value, label) {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) throw new InputError(`${label} must be a non-empty string.`);
  return value.trim().toLowerCase();
}
api.get('/inverters', (req, res) => {
  const brand = filterValue(req.query.brand, 'Brand');
  res.json({ brands: inverters.brands, models: inverters.models.filter((m) => !brand || m.manufacturer.toLowerCase() === brand) });
});
api.get('/inverters/:id', (req, res) => {
  const item = inverters.models.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Inverter model not found.' });
  res.json(item);
});
api.get('/appliance-specifications', (req, res) => {
  const category = filterValue(req.query.category, 'Category');
  res.json({ categories: specifications.categories, items: specifications.items.filter((a) => !category || a.category === category) });
});
api.get('/appliance-specifications/:id', (req, res) => {
  const item = specifications.items.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Appliance specification not found.' });
  res.json(item);
});
api.get('/data-sources', (req, res) => res.json(sources));

api.get('/catalogue', (req, res) => {
  res.json(catalogue.prefixSearch(String(req.query.prefix ?? '').trim().toLowerCase()));
});

api.post('/catalogue', (req, res) => {
  const { name, watts, surgeFactor = 1, dutyCycle = 1, category = 'other', room = 'Other' } = body(req);
  if (typeof name !== 'string' || !name.trim() || name.length > 60) throw new InputError('Name must be 1–60 characters.');
  const num = (v, min, max, label) => {
    if (typeof v !== 'number' || !(v >= min && v <= max)) throw new InputError(`${label} must be a number between ${min} and ${max}.`);
    return v;
  };
  const item = {
    name: name.trim(),
    watts: num(watts, 1, 10000, 'Watts'),
    surgeFactor: num(surgeFactor, 1, 8, 'Surge factor'),
    dutyCycle: num(dutyCycle, 0.01, 1, 'Duty cycle'),
    category: String(category).slice(0, 30),
    room: String(room).slice(0, 30),
  };
  catalogue.insert(item.name.toLowerCase(), item);
  res.status(201).json({ item, height: catalogue.height(), size: catalogue.size });
});

// Inserting names in alphabetical order: a plain BST degenerates into a list, AVL stays ~log n.
api.get('/catalogue/heights', (req, res) => {
  const avl = new AVLTree();
  const bst = new BST();
  for (const item of catalogue.prefixSearch('')) {
    const key = item.name.toLowerCase();
    avl.insert(key, item);
    bst.insert(key);
  }
  res.json({ n: avl.size, avlHeight: avl.height(), bstHeight: bst.height() });
});

api.get('/testcases', (req, res) => res.json(testcases));

api.post('/plan', (req, res) => {
  const { setup, appliances, algorithm = 'auto' } = body(req);
  res.json(solve(String(algorithm), setup, appliances));
});

api.post('/compare', (req, res) => {
  const { setup, appliances } = body(req);
  res.json(compare(setup, appliances));
});

api.post('/staged', (req, res) => {
  const { setup, appliances, hours = [2, 4, 6, 8] } = body(req);
  if (!Array.isArray(hours) || hours.length === 0 || hours.length > 12 || !hours.every((h) => typeof h === 'number' && h > 0 && h <= 48)) {
    throw new InputError('Hours must be a list of up to 12 durations between 0 and 48.');
  }
  res.json(stagedPlan(setup, appliances, hours));
});

api.post('/bb-tree', (req, res) => {
  const { setup, appliances, strategy = 'LC' } = body(req);
  const s = String(strategy).toUpperCase();
  if (!['LC', 'FIFO', 'LIFO'].includes(s)) throw new InputError('Strategy must be LC, FIFO or LIFO.');
  const plan = solve(`bb-${s.toLowerCase()}`, setup, appliances, { traceLimit: 60 });
  res.json({ strategy: s, nodes: plan.trace.nodes, bestId: plan.trace.bestId, stats: plan.stats, totalImportance: plan.totalImportance });
});

app.use('/api', api);

app.use((req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.path}` }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Check the backend console.' : err.message });
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => console.log(`Ujala backend on http://localhost:${port}/api`));
}
