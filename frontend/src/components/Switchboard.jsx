import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.js';
import AppliancePicker from './AppliancePicker.jsx';
import { ROOMS, roomOf } from './House.jsx';

const shortName = (name) => name.replace(/\s*\(.*?\)/, '');

export function Rocker({ on, label, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={`rocker ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="rocker-face" />
      <span className="rocker-dot" aria-hidden="true" />
    </button>
  );
}

function Editor({ appliance, onClose }) {
  const ref = useRef(null);
  const update = useStore((s) => s.updateAppliance);
  const remove = useStore((s) => s.removeAppliance);
  const T = useStore((s) => s.setup.outageHours);

  useEffect(() => {
    if (appliance && !ref.current.open) ref.current.showModal();
  }, [appliance]);
  if (!appliance) return <dialog ref={ref} className="editor" />;

  const set = (patch) => update(appliance.id, patch);
  const num = (key, min, max) => (e) => {
    const v = Number(e.target.value);
    if (e.target.value !== '' && v >= min && v <= max) set({ [key]: v });
  };

  return (
    <dialog ref={ref} className="editor" onClose={onClose}>
      <form method="dialog">
        <h3>{appliance.name}</h3>
        <label>
          Watts
          <input type="number" min="1" max="10000" defaultValue={appliance.watts} onChange={num('watts', 1, 10000)} />
        </label>
        <p className="hint wide">{appliance.wattsOverridden ? 'User-entered wattage override' : (appliance.classification ?? 'Legacy typical estimate')} · Startup and duty remain editable assumptions.{appliance.sourceUrl && <> <a href={appliance.sourceUrl} target="_blank" rel="noreferrer">Original source</a></>}</p>
        <label>Duty fraction (estimate)<input type="number" min="0.01" max="1" step="0.01" defaultValue={appliance.dutyCycle ?? 1} onChange={num('dutyCycle', .01, 1)} /></label>
        <label>Startup factor (estimate)<input type="number" min="1" max="8" step="0.1" defaultValue={appliance.surgeFactor ?? 1} onChange={num('surgeFactor', 1, 8)} /></label>
        <label>
          How many
          <input type="number" min="1" max="20" step="1" defaultValue={appliance.quantity ?? 1} onChange={num('quantity', 1, 20)} />
        </label>
        <label>
          Hours needed in the outage
          <input type="number" min="0" max="48" step="0.25" defaultValue={appliance.hoursNeeded ?? T} onChange={num('hoursNeeded', 0, 48)} />
        </label>
        <label>
          Room
          <select defaultValue={roomOf(appliance.room ?? 'Other')} onChange={(e) => set({ room: e.target.value })}>
            {ROOMS.map((r) => (
              <option key={r.key}>{r.key}</option>
            ))}
          </select>
        </label>
        <label className="wide">
          How important is it? <b>{appliance.importance ?? 5}</b> of 10
          <input type="range" min="1" max="10" value={appliance.importance ?? 5} onChange={num('importance', 1, 10)} />
        </label>
        <label className="check wide">
          <input type="checkbox" checked={!!appliance.mustRun} onChange={(e) => set({ mustRun: e.target.checked })} />
          Must stay on (a medical device, the router for work)
        </label>
        <div className="editor-actions wide">
          <button type="button" className="btn ghost danger" onClick={() => { remove(appliance.id); ref.current.close(); }}>
            Remove appliance
          </button>
          <button className="btn">Done</button>
        </div>
      </form>
    </dialog>
  );
}

function AddAppliance() {
  const call = useStore((s) => s.call);
  const add = useStore((s) => s.addAppliance);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let live = true;
    call(`/catalogue?prefix=${encodeURIComponent(q.trim().toLowerCase())}`)
      .then((r) => live && (setResults(r.slice(0, 8)), setMsg(r.length ? '' : 'Nothing in the catalogue starts with that.')))
      .catch(() => live && setMsg('The catalogue needs the Ujala server.'));
    return () => {
      live = false;
    };
  }, [q, call]);

  const pick = (item) => {
    add({ ...item, room: roomOf(item.room) });
    setQ('');
  };

  return (
    <div className="add">
      <input type="search" placeholder="Add appliance: start typing, e.g. fan" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the appliance catalogue" />
      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.name}>
              <button type="button" onClick={() => pick(r)}>
                <span>{r.name}</span>
                <span className="num">{r.watts} W</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && q && <p className="hint">{msg}</p>}
    </div>
  );
}

export default function Switchboard({ units }) {
  const on = useStore((s) => s.on);
  const toggle = useStore((s) => s.toggle);
  const appliances = useStore((s) => s.appliances);
  const [editing, setEditing] = useState(null);

  const groups = ROOMS.map((r) => ({ room: r.key, units: units.filter((u) => roomOf(u.room) === r.key) })).filter((g) => g.units.length);

  return (
    <section className="switchboard" aria-label="Switchboard">
      <h2>Switchboard</h2>
      {groups.length === 0 && <p className="hint">Add the appliances in your home to start. Typical wattages fill in automatically.</p>}
      <div className="plates">
        {groups.map((g) => (
          <div className="plate" key={g.room}>
            <span className="plate-room">{g.room}</span>
            <div className="plate-switches">
              {g.units.map((u) => (
                <div className="switch" key={u.id}>
                  <Rocker on={on[u.id]} label={`${u.name}, ${u.watts} W`} onClick={() => toggle(u.id)} />
                  <button type="button" className="switch-label" onClick={() => setEditing(u.applianceId)} title="Edit this appliance">
                    {shortName(u.name)}
                    <small className="num">{u.watts} W{u.mustRun ? ', must run' : ''}</small>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <AppliancePicker />
      <details><summary>Search the legacy catalogue</summary><AddAppliance /></details>
      <Editor key={editing} appliance={appliances.find((a) => a.id === editing)} onClose={() => setEditing(null)} />
    </section>
  );
}
