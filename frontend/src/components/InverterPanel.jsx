import { fmt } from '../power.js';

// Seven-segment readout. Unlit "8"s sit behind the value like a real LCD.
export function Seg({ value, width }) {
  const text = String(value).padStart(width, '!'); // "!" is a blank cell in DSEG7
  const ghost = text.replace(/[^.]/g, '8');
  return (
    <span className="seg">
      <span className="seg-ghost" aria-hidden="true">{ghost}</span>
      <span className="seg-value">{text}</span>
    </span>
  );
}

function Led({ label, lit, tone = 'lcd', blink = false }) {
  return (
    <span className={`led ${lit ? 'lit' : ''} tone-${tone} ${blink ? 'blink' : ''}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export default function InverterPanel({ t, caps, compact = false }) {
  const tripped = t.overload || t.surgeTrip;
  const pct = Math.min(t.loadPct, 120);
  const backup = t.backupHours == null ? '' : t.backupHours >= 100 ? '99.9' : t.backupHours.toFixed(1);
  const batteryLeft = Math.max(0, 100 - t.energyPct);

  return (
    <section className={`inverter ${compact ? 'compact' : ''}`} aria-label="Inverter panel">
      <div className="lcd">
        <div className="lcd-row">
          <span className="lcd-label">Load</span>
          <Seg value={tripped ? '' : Math.round(t.load)} width={4} />
          <span className="lcd-unit">W</span>
        </div>
        <div className="lcd-bar" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} className={(i + 0.5) * (100 / 12) <= pct ? (i >= 10 ? 'on over' : 'on') : ''} />
          ))}
          <span className="lcd-pct">{Math.round(t.loadPct)}%</span>
        </div>
        <div className="lcd-row">
          <span className="lcd-label">Backup</span>
          <Seg value={tripped ? '' : backup} width={4} />
          <span className="lcd-unit">h</span>
        </div>
        {!compact && (
          <div className="lcd-row">
            <span className="lcd-label">Battery left</span>
            <Seg value={tripped ? '' : Math.round(batteryLeft)} width={3} />
            <span className="lcd-unit">%</span>
          </div>
        )}
      </div>
      <div className="leds">
        <Led label="Mains off" lit />
        <Led label="On battery" lit={!tripped} />
        <Led label="Overload" lit={tripped} tone="trip" blink={tripped} />
      </div>
      {!compact && (
        <div className="panel-notes" aria-live="polite">
          {t.overload && (
            <p className="bad">
              Overload: {fmt(t.load)} W is over the {fmt(caps.maxW)} W limit. The inverter would trip.
            </p>
          )}
          {!t.overload && t.surgeTrip && (
            <p className="bad">
              Starting the {t.surgeName} needs {fmt(t.peakDemand)} W, but the inverter can only take {fmt(caps.peakW)} W for a moment. It would trip.
            </p>
          )}
          {!tripped && t.drain && (
            <p className="bad">
              The battery runs out after about {fmt(t.backupHours, 1)} h, before your {fmt(t.T, 1)} h outage ends.
            </p>
          )}
          {!tripped && !t.drain && t.count > 0 && (
            <p className="calm">
              Within limits. Surge peak {fmt(t.peakDemand)} of {fmt(caps.peakW)} W.
            </p>
          )}
          {t.count === 0 && <p className="calm">Everything is off. Flip a switch, or let Ujala plan it.</p>}
        </div>
      )}
    </section>
  );
}
