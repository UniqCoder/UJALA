// The power model from PRD Section 5: input validation, derived capacities,
// per-appliance weights and the C1–C4 constraint checks.

export const EPS = 1e-9;

// Safe depth of discharge by battery type.
export const DOD = { flat: 0.5, tubular: 0.7, lithium: 0.9 };

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const fmt = (x) => Math.round(x).toLocaleString('en-IN');
const round1 = (x) => Math.round(x * 10) / 10;

function readNum(src, key, def, min, max, label, integer = false) {
  const raw = src[key] ?? def;
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new InputError(`${label} is missing or not a number.`);
  if (v < min || v > max) throw new InputError(`${label} must be between ${min} and ${max}.`);
  if (integer && !Number.isInteger(v)) throw new InputError(`${label} must be a whole number.`);
  return v;
}

// O(1). Validates the setup and fills in defaults.
export function normalizeSetup(setup) {
  if (!setup || typeof setup !== 'object') throw new InputError('Setup is missing. Send inverter, battery and outage details.');
  const batteryType = String(setup.batteryType ?? 'tubular').toLowerCase();
  if (!Object.hasOwn(DOD, batteryType)) throw new InputError('Battery type must be flat, tubular or lithium.');
  let health = readNum(setup, 'health', 1, 0.1, 100, 'Battery health');
  if (health > 1) health /= 100; // accept 80 as well as 0.8
  return {
    inverterVA: readNum(setup, 'inverterVA', undefined, 50, 20000, 'Inverter rating (VA)'),
    powerFactor: readNum(setup, 'powerFactor', 0.8, 0.5, 1, 'Power factor'),
    surgeTolerance: readNum(setup, 'surgeTolerance', 1.5, 1, 4, 'Surge tolerance'),
    batteryAh: readNum(setup, 'batteryAh', undefined, 1, 2000, 'Battery capacity (Ah)'),
    batteryV: readNum(setup, 'batteryV', 12, 6, 96, 'Battery voltage'),
    batteryType,
    health,
    efficiency: readNum(setup, 'efficiency', 0.85, 0.5, 1, 'Inverter efficiency'),
    outageHours: readNum(setup, 'outageHours', undefined, 0.25, 48, 'Expected outage (hours)'),
  };
}

// O(1). maxW = VA × PF; peakW = maxW × surge tolerance; usableWh = Ah × V × DoD × health × efficiency.
export function capacities(s) {
  const maxW = s.inverterVA * s.powerFactor;
  return {
    maxW,
    peakW: maxW * s.surgeTolerance,
    usableWh: s.batteryAh * s.batteryV * DOD[s.batteryType] * s.health * s.efficiency,
  };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

// O(total units). Turns the appliance list into one item per unit (3 fans = 3 items) with
// w_i, e_i = w_i × min(hours, T) × duty, x_i = (surge − 1) × w_i and v_i.
export function expandAppliances(list, T) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new InputError('Add the appliances in your home to start. Typical wattages fill in automatically.');
  }
  const items = [];
  const used = Object.create(null);
  list.forEach((a, idx) => {
    if (!a || typeof a !== 'object') throw new InputError(`Appliance ${idx + 1} is not valid.`);
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, 60) : '';
    if (!name) throw new InputError(`Appliance ${idx + 1} needs a name.`);
    const watts = readNum(a, 'watts', undefined, 1, 10000, `${name}: watts`);
    const quantity = readNum(a, 'quantity', 1, 1, 20, `${name}: quantity`, true);
    const importance = readNum(a, 'importance', 5, 1, 10, `${name}: importance`, true);
    const surgeFactor = readNum(a, 'surgeFactor', 1, 1, 8, `${name}: surge factor`);
    const dutyCycle = readNum(a, 'dutyCycle', 1, 0.01, 1, `${name}: duty cycle`);
    const hoursNeeded = readNum(a, 'hoursNeeded', T, 0, 48, `${name}: hours needed`);
    const base = slug(a.id ?? name);
    for (let k = 1; k <= quantity; k++) {
      let id = `${base}-${k}`;
      while (used[id]) id += `-${idx}`;
      used[id] = true;
      items.push({
        id,
        name: quantity > 1 ? `${name} ${k}` : name,
        room: typeof a.room === 'string' ? a.room : 'Other',
        watts,
        energyWh: watts * Math.min(hoursNeeded, T) * dutyCycle,
        surgeExtra: (surgeFactor - 1) * watts,
        importance,
        dutyCycle,
        mustRun: a.mustRun === true,
      });
    }
  });
  if (items.length > 60) throw new InputError('Too many appliance units (max 60). Lower some quantities.');
  return items;
}

// A running total of a partial selection.
export const emptyState = () => ({ load: 0, energy: 0, maxSurge: 0, value: 0 });

// O(1)
export function addItem(s, it) {
  return {
    load: s.load + it.watts,
    energy: s.energy + it.energyWh,
    maxSurge: Math.max(s.maxSurge, it.surgeExtra),
    value: s.value + it.importance,
  };
}

// O(1). Would adding item `it` to state `s` keep C1, C2 and C3 true?
export function fits(s, it, caps) {
  const load = s.load + it.watts;
  return (
    load <= caps.maxW + EPS &&
    s.energy + it.energyWh <= caps.usableWh + EPS &&
    load + Math.max(s.maxSurge, it.surgeExtra) <= caps.peakW + EPS
  );
}

// O(n). Splits must-run items from optional ones and checks C4 is achievable,
// throwing an error that names the first broken limit.
export function splitMustRun(items, caps) {
  const mustRun = [];
  const optional = [];
  let base = emptyState();
  let surgeItem = null;
  for (const it of items) {
    if (!it.mustRun) {
      optional.push(it);
      continue;
    }
    mustRun.push(it);
    if (!surgeItem || it.surgeExtra > surgeItem.surgeExtra) surgeItem = it;
    base = addItem(base, it);
  }
  if (base.load > caps.maxW + EPS) {
    throw new InputError(
      `Your must-run appliances need ${fmt(base.load)} W, but the inverter supports ${fmt(caps.maxW)} W (running load limit). Remove one or lower its wattage.`
    );
  }
  if (base.energy > caps.usableWh + EPS) {
    throw new InputError(
      `Your must-run appliances need ${fmt(base.energy)} Wh over the outage, but the battery can supply ${fmt(caps.usableWh)} Wh (battery limit). Remove one or shorten its hours.`
    );
  }
  if (base.load + base.maxSurge > caps.peakW + EPS) {
    throw new InputError(
      `Starting the ${surgeItem.name} with your must-run load needs ${fmt(base.load + base.maxSurge)} W, but the inverter's surge limit is ${fmt(caps.peakW)} W (surge limit). Remove a must-run motor.`
    );
  }
  return { mustRun, optional, base };
}

// O(n). Explains which limit keeps each left-out item out of the plan.
function whyLeftOut(it, s, caps) {
  const load = s.load + it.watts;
  if (load > caps.maxW + EPS) return `would exceed running load by ${fmt(load - caps.maxW)} W`;
  if (s.energy + it.energyWh > caps.usableWh + EPS) {
    return `would exceed battery energy by ${fmt(s.energy + it.energyWh - caps.usableWh)} Wh`;
  }
  const peak = load + Math.max(s.maxSurge, it.surgeExtra);
  if (peak > caps.peakW + EPS) return `its start-up surge would exceed the peak limit by ${fmt(peak - caps.peakW)} W`;
  return 'fits, but this method did not pick it';
}

// O(n). Builds the API plan response for a set of chosen optional items.
export function buildPlan(algorithm, ctx, result, timeMs) {
  const { caps, mustRun, optional } = ctx;
  const selected = mustRun.concat(result.chosen);
  let s = emptyState();
  let runningW = 0;
  for (const it of selected) {
    s = addItem(s, it);
    runningW += it.watts * it.dutyCycle;
  }
  const chosenIds = Object.create(null);
  for (const it of selected) chosenIds[it.id] = true;

  const peakDemandW = s.load + s.maxSurge;
  const constraintsOk = {
    C1: s.load <= caps.maxW + EPS,
    C2: s.energy <= caps.usableWh + EPS,
    C3: peakDemandW <= caps.peakW + EPS,
    C4: true, // must-run items are always added above
  };
  const warnings = [...(result.warnings ?? [])];
  if (!constraintsOk.C3) {
    warnings.push(
      `This plan fails the surge check: starting the largest motor needs ${fmt(peakDemandW)} W but the inverter's peak is ${fmt(caps.peakW)} W. Use the branch and bound result.`
    );
  }

  const plan = {
    algorithm,
    selected,
    leftOut: optional.filter((it) => !chosenIds[it.id]).map((it) => ({ ...it, reason: whyLeftOut(it, s, caps) })),
    totalImportance: s.value,
    loadW: round1(s.load),
    maxW: round1(caps.maxW),
    loadPct: round1((100 * s.load) / caps.maxW),
    energyWh: round1(s.energy),
    usableWh: round1(caps.usableWh),
    energyPct: round1((100 * s.energy) / caps.usableWh),
    surge: { ok: constraintsOk.C3, peakDemandW: round1(peakDemandW), peakW: round1(caps.peakW) },
    backupHours: runningW > 0 ? round1(caps.usableWh / runningW) : null,
    constraintsOk,
    stats: { ...result.stats, timeMs: Math.round(timeMs * 1000) / 1000 },
    warnings,
  };
  if (result.dpTable) plan.dpTable = result.dpTable;
  if (result.trace) plan.trace = result.trace;
  return plan;
}
