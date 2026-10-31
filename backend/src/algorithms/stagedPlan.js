import { solve } from '../planner.js';

// O(k · B&B) for k durations. Runs least-cost branch and bound for each outage length;
// the difference between consecutive plans becomes "switch off" instructions.
export function stagedPlan(setup, appliances, hours = [2, 4, 6, 8]) {
  const stages = [];
  let prev = null;
  let prevHours = 0;
  for (const T of hours) {
    let plan;
    try {
      plan = solve('auto', { ...setup, outageHours: T }, appliances);
    } catch (err) {
      if (!err.status) throw err;
      stages.push({ hours: T, error: err.message });
      continue;
    }
    const has = (p, it) => p.selected.some((x) => x.id === it.id);
    const switchOff = prev ? prev.selected.filter((it) => !has(plan, it)).map((it) => it.name) : [];
    const switchOn = prev ? plan.selected.filter((it) => !has(prev, it)).map((it) => it.name) : [];
    let instruction = null;
    if (switchOff.length) instruction = `If it passes ${prevHours} h, switch off: ${switchOff.join(', ')}`;
    if (switchOn.length) instruction = `${instruction ? instruction + '. ' : `If it passes ${prevHours} h, `}switch on: ${switchOn.join(', ')}`;
    stages.push({ hours: T, plan, switchOff, switchOn, instruction });
    prev = plan;
    prevHours = T;
  }
  return { stages };
}
