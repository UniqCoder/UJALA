import { useState } from 'react';
import data from '../../../backend/data/appliance-specifications.json';
import { applianceDefaults } from '../../../shared/power.js';
import { useStore } from '../store.js';
import { ROOMS, roomOf } from './House.jsx';

export default function AppliancePicker() {
  const add = useStore((s) => s.addAppliance);
  const T = useStore((s) => s.setup.outageHours);
  const [category, setCategory] = useState(data.categories[0].id);
  const [id, setId] = useState('');
  const [draft, setDraft] = useState(null);
  const [added, setAdded] = useState('');
  const item = data.items.find((a) => a.id === id);
  function pick(id) {
    setId(id); setAdded('');
    const item = data.items.find((a) => a.id === id);
    setDraft(item ? { ...applianceDefaults(item), room: roomOf(item.room), quantity: 1, importance: 5, hoursNeeded: T, mustRun: false } : null);
  }
  const num = (key, min, max) => (e) => {
    const n = Number(e.target.value);
    if (e.target.value !== '' && n >= min && n <= max) setDraft({ ...draft, [key]: n });
  };
  return <div className="catalogue-picker add">
    <h3>3 · Household appliances</h3>
    <div className="fields">
      <label className="field"><span>Category</span><select value={category} onChange={(e) => { setCategory(e.target.value); pick(''); }}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="field"><span>Appliance</span><select value={id} onChange={(e) => pick(e.target.value)}><option value="">Select appliance</option>{data.items.filter((a) => a.category === category).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    </div>
    {item && draft && <>
      <div className="spec-card"><b>{item.classification}</b> · {item.confidence}
        <p className="hint">Default {item.ratedOperatingW} W · duty {item.dutyCycle * 100}% · startup {item.surgeFactor}× (estimate) · estimated {item.estimatedEnergyWhPerHour} Wh per elapsed hour.</p>
        <p className="hint">{item.notes}</p>
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source · verified {item.verificationDate}</a>}
      </div>
      <div className="fields">
        <label className="field"><span>Watts (editable)</span><input type="number" min="1" max="10000" value={draft.watts} onChange={num('watts',1,10000)} /></label>
        <label className="field"><span>Quantity</span><input type="number" min="1" max="20" step="1" value={draft.quantity} onChange={(e) => { if (Number.isInteger(Number(e.target.value))) num('quantity',1,20)(e); }} /></label>
        <label className="field"><span>Required hours</span><input type="number" min="0" max="48" step="0.25" value={draft.hoursNeeded} onChange={num('hoursNeeded',0,48)} /></label>
        <label className="field"><span>Duty fraction (estimate)</span><input type="number" min="0.01" max="1" step="0.01" value={draft.dutyCycle} onChange={num('dutyCycle',.01,1)} /></label>
        <label className="field"><span>Startup factor (estimate)</span><input type="number" min="1" max="8" step="0.1" value={draft.surgeFactor} onChange={num('surgeFactor',1,8)} /></label>
        <label className="field"><span>Room</span><select value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })}>{ROOMS.map((r) => <option key={r.key}>{r.key}</option>)}</select></label>
        <label className="field"><span>Importance (1–10)</span><input type="number" min="1" max="10" step="1" value={draft.importance} onChange={(e) => { if (Number.isInteger(Number(e.target.value))) num('importance',1,10)(e); }} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={draft.mustRun} onChange={(e) => setDraft({ ...draft, mustRun: e.target.checked })} />Must run</label>
      <button type="button" className="btn" onClick={() => { add({ ...draft, wattsOverridden: draft.watts !== item.ratedOperatingW }); setAdded(`Added ${draft.quantity} × ${draft.name}. You can add more.`); }}>Add to switchboard</button>
      <p className="hint" role="status">{added}</p>
    </>}
  </div>;
}
