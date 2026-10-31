import { useMemo, useRef, useState, useEffect } from 'react';
import { useStore, reducedMotion } from '../store.js';
import { capacities, units as toUnits, totals, fmt } from '../power.js';
import InverterSelector from '../components/InverterSelector.jsx';
import House from '../components/House.jsx';
import InverterPanel from '../components/InverterPanel.jsx';
import Switchboard from '../components/Switchboard.jsx';
import CaseLoader from '../components/CaseLoader.jsx';

export const METHODS = [
  { id: 'bb-lc', label: 'Branch and bound (least cost)' },
  { id: 'bb-fifo', label: 'Branch and bound (FIFO)' },
  { id: 'bb-lifo', label: 'Branch and bound (LIFO)' },
  { id: 'dp', label: 'Dynamic programming' },
  { id: 'greedy', label: 'Greedy' },
  { id: 'brute', label: 'Brute force' },
];

function NumField({ label, value, onChange, min, max, step = 1, unit, disabled = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-input">
        <input
          type="number"
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          key={value}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (e.target.value === '' || !(v >= min && v <= max)) e.target.value = value;
            else if (v !== value) onChange(v);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {unit && <i>{unit}</i>}
      </span>
    </label>
  );
}

function Setup() {
  const s = useStore((st) => st.setup);
  const setSetup = useStore((st) => st.setSetup);
  return (
    <section className="setup" aria-label="Your setup">
      <h2>Your setup</h2>
      <InverterSelector>
        <div className="fields">
        <NumField label="Inverter" disabled={!!s.inverterId} value={s.inverterVA} min={50} max={20000} step={50} unit="VA" onChange={(v) => setSetup({ inverterVA: v })} />
        {!s.inverterId && <label className="field"><span>Rated output W (optional)</span><input type="number" min="1" max="20000" placeholder="Blank: use VA × PF" value={s.ratedOutputW ?? ''} onChange={(e) => { const v = Number(e.target.value); if (e.target.value === '' || (v >= 1 && v <= 20000)) setSetup({ ratedOutputW: e.target.value === '' ? null : v }); }} /></label>}
        </div>
      </InverterSelector>
      <div className="fields">
        <NumField label="Battery" value={s.batteryAh} min={1} max={2000} step={10} unit="Ah" onChange={(v) => setSetup({ batteryAh: v })} />
        <label className="field">
          <span>Voltage</span>
          <select value={s.batteryV} onChange={(e) => setSetup({ batteryV: Number(e.target.value) })}>
            <option value={12}>12 V</option>
            <option value={24}>24 V</option>
            <option value={48}>48 V</option>
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select value={s.batteryType} onChange={(e) => setSetup({ batteryType: e.target.value })}>
            <option value="flat">Flat plate</option>
            <option value="tubular">Tubular</option>
            <option value="lithium">Lithium</option>
          </select>
        </label>
        <label className="field">
          <span>Health</span>
          <select value={s.health} onChange={(e) => setSetup({ health: Number(e.target.value) })}>
            <option value={100}>New</option>
            <option value={80}>2 to 3 years</option>
            <option value={60}>Older</option>
          </select>
        </label>
        <NumField label="Outage" value={s.outageHours} min={0.25} max={48} step={0.5} unit="h" onChange={(v) => setSetup({ outageHours: v })} />
      </div>
      <details className="advanced">
        <summary>Advanced</summary>
        <div className="fields">
          <NumField label="PF estimate (fallback only)" value={s.powerFactor} min={0.5} max={1} step={0.05} onChange={(v) => setSetup({ powerFactor: v })} />
          <NumField label="Efficiency estimate" value={s.efficiency} min={0.5} max={1} step={0.05} onChange={(v) => setSetup({ efficiency: v })} />
          <NumField label="Surge estimate" value={s.surgeTolerance} min={1} max={4} step={0.1} unit="×" onChange={(v) => setSetup({ surgeTolerance: v })} />
        </div>
      </details>
    </section>
  );
}

function WhyThisPlan({ plan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="why">
      <button type="button" className="btn ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        Why this plan
      </button>
      {open && (
        <div className="why-body">
          <p>
            Keeps {plan.selected.length} appliances on, worth {plan.totalImportance} importance points. Uses {fmt(plan.loadW)} of {fmt(plan.maxW)} W and{' '}
            {fmt(plan.energyWh)} of {fmt(plan.usableWh)} Wh.
          </p>
          {plan.leftOut.length > 0 && (
            <ul>
              {plan.leftOut.map((it) => (
                <li key={it.id}>
                  <b>{it.name}</b> left out: {it.reason}.
                </li>
              ))}
            </ul>
          )}
          <p className="stat-line num">
            {plan.stats.operations.toLocaleString('en-IN')} operations in {plan.stats.timeMs} ms
            {plan.stats.nodesExpanded != null && `, ${plan.stats.nodesExpanded} nodes expanded, ${plan.stats.pruned} pruned`}
            {plan.stats.cells != null && `, ${plan.stats.cells.toLocaleString('en-IN')} table cells`}
          </p>
        </div>
      )}
    </div>
  );
}

function Timeline({ staged, list, on, caps }) {
  const [hour, setHour] = useState(0);
  if (!staged) {
    return (
      <section className="timeline empty" aria-label="Outage timeline">
        <h2>Outage timeline</h2>
        <p className="hint">Plan your backup to see what to switch off if the outage runs longer.</p>
      </section>
    );
  }
  const max = 8;
  const marks = [];
  staged.stages.forEach((s, i) => {
    const at = i === 0 ? 0 : staged.stages[i - 1].hours;
    if (s.instruction) marks.push({ at, text: s.instruction });
    if (s.error) marks.push({ at, text: `Past ${at} h your must-run appliances alone are too much: ${s.error}`, bad: true });
  });
  const current = [...marks].reverse().find((m) => m.at <= hour);
  const t = totals(list, on, caps, hour);
  const left = Math.max(0, 100 - (100 * t.runningW * hour) / caps.usableWh);

  return (
    <section className="timeline" aria-label="Outage timeline">
      <h2>Outage timeline</h2>
      <div className="track">
        <input type="range" min="0" max={max} step="0.25" value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="Hours into the outage" />
        <div className="ticks" aria-hidden="true">
          {[0, 2, 4, 6, 8].map((h) => (
            <span key={h} style={{ left: `${(h / max) * 100}%` }}>{h} h</span>
          ))}
          {marks.map((m) => (
            <b key={m.at + m.text} className={m.bad ? 'bad' : ''} style={{ left: `${(m.at / max) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="timeline-read">
        <span className="num">
          At {fmt(hour, hour % 1 ? 2 : 0)} h the battery has about <b>{Math.round(left)}%</b> left with these switches.
        </span>
        <span className={current?.bad ? 'bad' : ''}>{current ? current.text : 'Keep the plan as it is for the first hours.'}</span>
      </div>
    </section>
  );
}

export default function Planner() {
  const { setup, appliances, on, plan, staged, error, algorithm } = useStore();
  const { setOn, setPlan, setStaged, setError, setAlgorithm, call } = useStore.getState();
  const [busy, setBusy] = useState(false);
  const timers = useRef([]);

  const caps = useMemo(() => capacities(setup), [setup]);
  const list = useMemo(() => toUnits(appliances, setup.outageHours), [appliances, setup.outageHours]);
  const t = totals(list, on, caps, setup.outageHours);
  const tripped = t.overload || t.surgeTrip;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Flip switches to the plan one at a time: first the ones going off, then the ones coming on.
  function applyPlan(selectedIds) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const target = {};
    for (const id of selectedIds) target[id] = true;
    if (reducedMotion()) return setOn(target);
    const steps = [...list.filter((u) => on[u.id] && !target[u.id]), ...list.filter((u) => target[u.id] && !on[u.id])];
    steps.forEach((u, i) => {
      timers.current.push(
        setTimeout(() => {
          const cur = useStore.getState().on;
          setOn({ ...cur, [u.id]: !!target[u.id] });
        }, 140 * i)
      );
    });
  }

  async function planMyBackup() {
    setBusy(true);
    try {
      const body = { setup, appliances };
      const p = await call('/plan', { ...body, algorithm });
      setPlan(p);
      if (Object.values(p.constraintsOk).every(Boolean)) applyPlan(p.selected.map((s) => s.id));
      call('/staged', body).then(setStaged).catch(() => {});
    } catch (err) {
      if (err.message) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="planner">
      <div className="planner-left">
        <Setup />
        <Switchboard units={list} />
      </div>

      <div className="planner-house">
        <div className="house-head">
          <p className="house-caption">
            {tripped ? 'The inverter has tripped. Everything is dark.' : t.count ? `${t.count} of ${list.length} switched on` : 'Power cut. Everything is off.'}
          </p>
          <CaseLoader onLoad={() => timers.current.forEach(clearTimeout)} />
        </div>
        <House units={list} on={on} tripped={tripped} onPick={(id) => useStore.getState().toggle(id)} />
      </div>

      <div className="planner-right">
        <InverterPanel t={t} caps={caps} />
        <div className="method">
          <h3>4 · Optimization</h3>
          <label className="field">
            <span>Method</span>
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={planMyBackup} disabled={busy || !appliances.length}>
            {busy ? 'Planning' : 'Plan my backup'}
          </button>
          {error && <p className="bad" role="alert">{error}</p>}
          {plan && (
            <>
              {plan.warnings.map((w) => (
                <p key={w} className="bad">{w}</p>
              ))}
              <WhyThisPlan plan={plan} key={plan.algorithm + plan.totalImportance} />
            </>
          )}
        </div>
      </div>

      <Timeline staged={staged} list={list} on={on} caps={caps} key={staged ? 'staged' : 'none'} />
    </main>
  );
}
