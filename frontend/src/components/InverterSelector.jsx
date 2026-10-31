import { useState } from 'react';
import { useStore } from '../store.js';
import catalogue from '../../../backend/data/inverter-catalogue.json';
import { capacities, compatibilityWarnings } from '../../../shared/power.js';

export default function InverterSelector({ children }) {
  const setup = useStore((s) => s.setup);
  const select = useStore((s) => s.selectInverter);
  const setSetup = useStore((s) => s.setSetup);
  const model = catalogue.models.find((m) => m.id === setup.inverterId);
  const [brand, setBrand] = useState(model?.manufacturer ?? '');
  const activeBrand = model?.manufacturer ?? brand;
  const warnings = compatibilityWarnings(setup, model);
  return <div className="catalogue-picker">
    <h3>1 · Inverter</h3>
    <p className="hint">{model ? 'Manufacturer-selected preset' : 'Custom configuration'} · Selecting a model applies its inverter ratings and bank voltage. Actual battery Ah, type and health stay yours.</p>
    <div className="fields">
      <label className="field"><span>Manufacturer</span><select value={activeBrand} onChange={(e) => { setBrand(e.target.value); if (!e.target.value) setSetup({ inverterId: null }); else if (model && e.target.value !== model.manufacturer) setSetup({ inverterId: null }); }}>
        <option value="">Custom / unlisted</option>{catalogue.brands.map((b) => <option key={b}>{b}</option>)}
      </select></label>
      {activeBrand && <label className="field"><span>Model</span><select value={model?.id ?? ''} onChange={(e) => { const m = catalogue.models.find((m) => m.id === e.target.value); if (m) select(m); }}>
        <option value="">Select model to apply ratings</option>{catalogue.models.filter((m) => m.manufacturer === activeBrand).map((m) => <option key={m.id} value={m.id}>{m.modelName}</option>)}
      </select></label>}
    </div>
    {model && <div className="spec-card">
      <b>{model.modelName}</b>
      <dl><dt>VA / rated watts</dt><dd>{model.vaRating} VA / {model.ratedOutputW} W</dd>
        <dt>Battery bank</dt><dd>{model.batterySystemV} V · {model.batteryCount} battery / batteries · Ah not included</dd>
        <dt>Waveform</dt><dd>{model.waveform}</dd>
        {model.supportedBatteryTypes?.length > 0 && <><dt>Battery types</dt><dd>{model.supportedBatteryTypes.map((type) => ({ flat: 'Flat plate', tubular: 'Tubular', smf: 'SMF', lithium: 'Lithium' }[type] ?? type)).join(', ')}</dd></>}
        {model.minBatteryAh != null && model.maxBatteryAh != null && <><dt>{model.batteryAhRangeKind === 'recommended' ? 'Recommended battery' : 'Supported battery'}</dt><dd>{model.minBatteryAh}–{model.maxBatteryAh} Ah</dd></>}
        {model.powerFactor != null && <><dt>Power factor</dt><dd>{model.powerFactor}</dd></>}
        {model.maxChargingA != null && <><dt>Max charging current</dt><dd>{model.maxChargingA} A</dd></>}
        {model.chargingCurrentRule && <><dt>Charging guideline</dt><dd>≈{Math.round(setup.batteryAh * model.chargingCurrentRule.batteryAhFraction * 10) / 10} A for your {setup.batteryAh} Ah battery (≈{model.chargingCurrentRule.batteryAhFraction * 100}% of Ah; manual guideline, not a fixed maximum)</dd></>}
        {model.efficiency != null && <><dt>Rated efficiency</dt><dd>{model.efficiency * 100}%</dd></>}
        {model.publishedEfficiency?.minExclusive != null && <><dt>Manual efficiency</dt><dd>&gt;{model.publishedEfficiency.minExclusive * 100}%{model.publishedEfficiency.conflictingProductPage ? ' · source discrepancy; see notes' : ''}</dd></>}
        <dt>Planning efficiency</dt><dd>{Math.round(setup.efficiency * 100)}% · editable {model.efficiency == null ? 'estimate' : 'setting'}</dd>
        {model.inputVoltageRange && <><dt>Input voltage</dt><dd>{Object.entries(model.inputVoltageRange).map(([k,v]) => `${k}: ${v.join('–')} V`).join('; ')}</dd></>}
        {model.outputVoltage && <><dt>Output voltage</dt><dd>{model.outputVoltage}</dd></>}
        {model.transferTimeMs && <><dt>Transfer time</dt><dd>{model.transferTimeMs.maxInclusive != null ? `≤${model.transferTimeMs.maxInclusive}` : `<${model.transferTimeMs.maxExclusive}`} ms</dd></>}
      </dl>
      <details className="spec-notes"><summary>Sources and verification notes</summary><p className="hint">{model.notes}</p>{model.manualUrl && <a href={model.manualUrl} target="_blank" rel="noreferrer">Official series manual</a>}</details>
      <a href={model.productUrl} target="_blank" rel="noreferrer">Manufacturer source</a><small> · Verified {model.verificationDate}</small>
      <button type="button" className="btn ghost" onClick={() => { setBrand(''); setSetup({ inverterId: null }); }}>Edit as custom (keep current values)</button>
    </div>}
    <p className="hint">Running limit: <b>{capacities(setup).maxW} W</b> · {setup.ratedOutputW != null ? (model ? 'Manufacturer watt rating' : 'User-entered watt rating') : 'VA × estimated PF'}. Surge allowance is a configurable estimate, not manufacturer-certified. Efficiency is an editable estimate unless documented.</p>
    {children}
    <h3>2 · Battery configuration</h3>
    <p className="hint">Voltage is the total bank voltage. Ah is bank capacity (series batteries keep the same Ah).</p>
    <div aria-live="polite">{warnings.map((w) => <p className="bad" key={w}>{w}</p>)}</div>
  </div>;
}
