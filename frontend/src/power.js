// Client-side copy of the backend's power model (PRD Section 5), so the inverter
// panel can react instantly to manual switch toggles without a server round trip.

const DOD = { flat: 0.5, tubular: 0.7, lithium: 0.9 };

export function capacities(s) {
  const health = s.health > 1 ? s.health / 100 : s.health;
  const maxW = s.inverterVA * (s.powerFactor ?? 0.8);
  return {
    maxW,
    peakW: maxW * (s.surgeTolerance ?? 1.5),
    usableWh: s.batteryAh * s.batteryV * (DOD[s.batteryType] ?? 0.7) * health * (s.efficiency ?? 0.85),
  };
}

// One unit per quantity, with ids matching the backend ("<applianceId>-<k>").
export function units(appliances, T) {
  const out = [];
  for (const a of appliances) {
    const q = a.quantity ?? 1;
    for (let k = 1; k <= q; k++) {
      out.push({
        id: `${a.id}-${k}`,
        applianceId: a.id,
        name: q > 1 ? `${a.name} ${k}` : a.name,
        room: a.room ?? 'Other',
        watts: a.watts,
        energyWh: a.watts * Math.min(a.hoursNeeded ?? T, T) * (a.dutyCycle ?? 1),
        surgeExtra: ((a.surgeFactor ?? 1) - 1) * a.watts,
        dutyCycle: a.dutyCycle ?? 1,
        mustRun: !!a.mustRun,
      });
    }
  }
  return out;
}

export function totals(list, on, caps, T) {
  let load = 0;
  let energy = 0;
  let runningW = 0;
  let surge = null;
  for (const u of list) {
    if (!on[u.id]) continue;
    load += u.watts;
    energy += u.energyWh;
    runningW += u.watts * u.dutyCycle;
    if (!surge || u.surgeExtra > surge.surgeExtra) surge = u;
  }
  const peakDemand = load + (surge?.surgeExtra ?? 0);
  const backupHours = runningW > 0 ? caps.usableWh / runningW : null;
  return {
    load,
    energy,
    runningW,
    peakDemand,
    surgeName: surge?.surgeExtra > 0 ? surge.name : null,
    backupHours,
    loadPct: (100 * load) / caps.maxW,
    energyPct: (100 * energy) / caps.usableWh,
    overload: load > caps.maxW + 1e-9,
    surgeTrip: peakDemand > caps.peakW + 1e-9,
    drain: energy > caps.usableWh + 1e-9,
    count: Object.values(on).filter(Boolean).length,
    T,
  };
}

export const fmt = (x, digits = 0) =>
  x == null ? '-' : x.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
