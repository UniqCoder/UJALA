import test from 'node:test';
import assert from 'node:assert/strict';
import { inverters, specifications, sources, resolveSetup } from '../catalogues.js';
import { normalizeSetup, capacities } from '../model.js';
import { capacities as browserCapacities } from '../../../frontend/src/power.js';
import { selectInverter, applianceDefaults, editAppliance, compatibilityWarnings } from '../../../shared/power.js';
import { solve, ALGORITHMS } from '../planner.js';
import { app } from '../server.js';
const model = inverters.models[0];
const base = { inverterVA: 800, powerFactor: .8, batteryAh: 150, batteryV: 12, batteryType: 'tubular', health: 100, efficiency: .85, surgeTolerance: 1.5, outageHours: 4 };
const appliance = { id: 'fan', name: 'Fan', watts: 75, quantity: 1, importance: 5, dutyCycle: 1, surgeFactor: 2 };
const server = app.listen(0);
const url = `http://localhost:${server.address().port}/api`;
test.after(() => server.close());
const get = async (path) => { const r = await fetch(url + path); assert.equal(r.status, 200); return r.json(); };

test('brands and manufacturer filtering are available through the API', async () => {
  const all = await get('/inverters');
  assert.deepEqual(all.brands, ['Luminous', 'Microtek', 'V-Guard']);
  assert.ok(all.models.length >= 5);
  for (const b of all.brands) {
    const result = await get(`/inverters?brand=${encodeURIComponent(b.toLowerCase())}`);
    assert.ok(result.models.length);
    assert.ok(result.models.every((m) => m.manufacturer === b));
  }
  assert.deepEqual((await get('/inverters?brand=unknown')).models, []);
});
test('model selection populates inverter ratings without assuming battery capacity or chemistry', async () => {
  const fetched = await get('/inverters/' + model.id);
  const s = selectInverter({ ...base, batteryAh: 175, batteryType: 'lithium' }, fetched);
  assert.equal(s.inverterVA, 900); assert.equal(s.ratedOutputW, 756);
  assert.equal(s.batteryV, 12); assert.equal(s.batteryAh, 175); assert.equal(s.batteryType, 'lithium');
  assert.equal(s.powerFactor, .8); assert.equal(fetched.powerFactor, null);
});
test('verified rated watts win over PF and fallback still uses VA × PF', () => {
  assert.equal(capacities(normalizeSetup(selectInverter(base, model))).maxW, 756);
  assert.equal(capacities(normalizeSetup(base)).maxW, 640);
  for (const bad of [0, -2, Infinity, 'not a number']) assert.throws(() => normalizeSetup({ ...base, ratedOutputW: bad }), /rated output/i);
});
test('browser and backend capacities share the same function for both health formats', () => {
  assert.equal(browserCapacities, capacities);
  for (const health of [1, .8, 100, 80]) {
    const s = { ...selectInverter(base, model), health };
    assert.deepEqual(browserCapacities(s), capacities(normalizeSetup(s)));
  }
});
test('categories filter correctly and all requested generic appliances are present', async () => {
  const all = await get('/appliance-specifications');
  assert.equal(all.categories.length, 5); assert.equal(all.items.length, 25);
  for (const c of all.categories) {
    const result = await get('/appliance-specifications?category=' + c.id);
    assert.ok(result.items.length); assert.ok(result.items.every((a) => a.category === c.id));
  }
  const exact = await get('/appliance-specifications/philips-wiz-8718699732585');
  assert.equal(exact.ratedOperatingW, 9); assert.equal(exact.modelNumber, '8718699732585');
});
test('mapped appliance defaults preserve different duty cycles and never convert annual kWh', () => {
  const fan = applianceDefaults(specifications.items.find((a) => a.id === 'standard-ceiling-fan'));
  const fridge = applianceDefaults(specifications.items.find((a) => a.id === 'single-door-fridge'));
  assert.equal(fan.dutyCycle, 1); assert.equal(fridge.dutyCycle, .35);
  assert.equal(fridge.watts, 120); assert.equal(fridge.surgeFactor, 3);
});
test('manual wattage override stays user-entered through subsequent edits', () => {
  const item = applianceDefaults(specifications.items.find((a) => a.id === 'philips-wiz-8718699732585'));
  const edited = editAppliance(editAppliance(item, { watts: 11 }), { quantity: 2 });
  assert.equal(edited.watts, 11); assert.equal(edited.wattsOverridden, true); assert.equal(edited.sourceUrl, item.sourceUrl);
});
test('battery voltage, chemistry and capacity incompatibilities are explicit, unknown remains unknown', () => {
  const vguard = inverters.models.find((m) => m.manufacturer === 'V-Guard');
  assert.match(compatibilityWarnings({ ...base, batteryV: 24 }, model).join(' '), /voltage mismatch/);
  assert.match(compatibilityWarnings({ ...base, batteryType: 'lithium' }, model).join(' '), /not listed/);
  assert.match(compatibilityWarnings({ ...base, batteryAh: 20 }, vguard).join(' '), /minimum/);
  assert.match(compatibilityWarnings({ ...base, batteryAh: 250 }, vguard).join(' '), /maximum/);
  assert.match(compatibilityWarnings(base, model).join(' '), /undocumented/);
  assert.match(compatibilityWarnings(base, null).join(' '), /not been manufacturer-verified/);
});
test('server resolves preset ratings itself and preserves actual battery voltage for mismatch reporting', () => {
  const s = resolveSetup({ ...base, inverterId: model.id, ratedOutputW: 9999, batteryV: 24 });
  assert.equal(s.ratedOutputW, 756); assert.equal(s.batteryV, 24);
  assert.throws(() => resolveSetup({ ...base, inverterId: 'missing' }), /Unknown inverter/);
});
test('all six algorithms consume the rated watt ceiling and maintain must-run behavior', () => {
  const s = selectInverter(base, model);
  for (const alg of Object.keys(ALGORITHMS)) {
    const p = solve(alg, s, [{ ...appliance, mustRun: true }, { ...appliance, id: 'heavy', name: 'Heavy load', watts: 800 }]);
    assert.equal(p.maxW, 756); assert.ok(p.selected.some((a) => a.id === 'fan-1'));
    assert.ok(!p.selected.some((a) => a.id === 'heavy-1')); assert.ok(p.constraintsOk.C1);
  }
});
test('motor startup and energy limits still constrain a selected preset', () => {
  const s = selectInverter({ ...base, batteryAh: 2000, outageHours: .25 }, model);
  const p = solve('bb-lc', s, [{ ...appliance, watts: 500, surgeFactor: 3 }]);
  assert.equal(p.selected.length, 0);
  assert.match(p.leftOut[0].reason, /peak limit/);
  assert.throws(() => solve('bb-lc', { ...s, batteryAh: 1 }, [{ ...appliance, mustRun: true }]), /battery limit/);
});
test('API rejects malformed filters and unknown IDs clearly', async () => {
  for (const path of ['/inverters/missing', '/appliance-specifications/missing']) assert.equal((await fetch(url + path)).status, 404);
  for (const path of ['/inverters?brand=', '/inverters?brand=x&brand=y', '/appliance-specifications?category=']) assert.equal((await fetch(url + path)).status, 400);
});
test('every dataset item has provenance and unverified fields are explicitly absent or estimated', async () => {
  const provenance = await get('/data-sources');
  assert.equal(provenance.length, sources.length);
  for (const item of [...inverters.models, ...specifications.items]) assert.ok(provenance.some((s) => s.datasetItemId === item.id));
  for (const m of inverters.models) { assert.equal(m.powerFactor, null); assert.equal(m.surgeCapacity, null); assert.equal(m.efficiency, null); }
  for (const a of specifications.items.filter((a) => a.classification === 'typical estimate')) { assert.equal(a.verificationDate, null); assert.equal(a.sourceUrl, null); }
});

test('Microtek SW manual data preserves bounds and charging guidance without inventing fixed ratings', () => {
  const m = inverters.models.find((m) => m.id === 'microtek-super-power-1100-sw');
  assert.equal(m.minBatteryAh, 100); assert.equal(m.maxBatteryAh, 200);
  assert.equal(m.batteryAhRangeKind, 'recommended');
  assert.equal(m.transferTimeMs.maxInclusive, 15);
  assert.equal(m.chargingCurrentRule.batteryAhFraction, .1);
  assert.equal(m.maxChargingA, null);
  assert.equal(m.publishedEfficiency.minExclusive, .8);
  assert.equal(m.publishedEfficiency.conflictingProductPage, true);
  assert.equal(m.efficiency, null); assert.equal(m.powerFactor, null);
  assert.ok(sources.some((s) => s.datasetItemId === m.id && s.officialSourceUrl === m.manualUrl));
});
