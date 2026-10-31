// The house at night: a floor plan where ON appliances glow and light their room.

export const ROOMS = [
  { key: 'Bedroom', x: 0, y: 0, w: 220, h: 200 },
  { key: 'Hall', x: 220, y: 0, w: 240, h: 250 },
  { key: 'Kitchen', x: 460, y: 0, w: 140, h: 200 },
  { key: 'Study', x: 0, y: 200, w: 220, h: 200 },
  { key: 'Front room', x: 220, y: 250, w: 240, h: 150 },
  { key: 'Utility', x: 460, y: 200, w: 140, h: 200 },
];

const ALIASES = { Bathroom: 'Utility', Shop: 'Front room', Other: 'Front room' };
export const roomOf = (room) => (ROOMS.some((r) => r.key === room) ? room : ALIASES[room] ?? 'Front room');

export function kindOf(name) {
  const n = name.toLowerCase();
  if (/fan|cooler|exhaust|chimney/.test(n)) return 'fan';
  if (/bulb|light|lamp|tube|cfl/.test(n)) return 'light';
  if (/fridge|refrigerator|pump|washing|mixer|conditioner|concentrator|vacuum/.test(n)) return 'motor';
  return 'device';
}

const shortName = (name) => name.replace(/\s*\(.*?\)/, '');

function Glyph({ kind }) {
  if (kind === 'fan') {
    return (
      <g className="glyph">
        <circle r="10" className="ring" />
        <g className="blades">
          {[0, 120, 240].map((a) => (
            <ellipse key={a} rx="2.6" ry="7" cy="-5" transform={`rotate(${a})`} />
          ))}
        </g>
        <circle r="2" />
      </g>
    );
  }
  if (kind === 'light') {
    return (
      <g className="glyph">
        <circle r="6.5" cy="-2" />
        <rect x="-3" y="5" width="6" height="4" rx="1" className="base" />
      </g>
    );
  }
  if (kind === 'motor') {
    return (
      <g className="glyph">
        <rect x="-9" y="-11" width="18" height="22" rx="3" />
        <circle r="4" cy="3" className="hole" />
      </g>
    );
  }
  return (
    <g className="glyph">
      <rect x="-11" y="-8" width="22" height="14" rx="2" />
      <rect x="-4" y="7" width="8" height="2.5" rx="1" className="base" />
    </g>
  );
}

// Spreads n fixtures over a room in a grid that matches the room's shape.
function layout(room, n) {
  const ix = room.x + 18;
  const iy = room.y + 40;
  const iw = room.w - 36;
  const ih = room.h - 58;
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * iw) / ih)));
  const rows = Math.max(1, Math.ceil(n / cols));
  return (i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i % cols;
    return { x: ix + ((c + 0.5) * iw) / inRow, y: iy + ((r + 0.5) * ih) / rows };
  };
}

export default function House({ units, on, tripped = false, onPick }) {
  const byRoom = {};
  for (const r of ROOMS) byRoom[r.key] = [];
  for (const u of units) byRoom[roomOf(u.room)].push(u);

  return (
    <svg viewBox="-6 -6 612 412" className={`house ${tripped ? 'tripped' : ''}`} role="img" aria-label="Floor plan of the house showing which appliances are on">
      <defs>
        <radialGradient id="room-glow">
          <stop offset="0" stopColor="#FFB547" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#FFB547" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="spill">
          <stop offset="0" stopColor="#FFD38A" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#FFB547" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
        </radialGradient>
        {ROOMS.map((r) => (
          <clipPath id={`clip-${r.key.replace(' ', '-')}`} key={r.key}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} />
          </clipPath>
        ))}
      </defs>

      {ROOMS.map((r) => (
        <rect key={r.key} className="floor" x={r.x} y={r.y} width={r.w} height={r.h} />
      ))}

      <g className="lights">
        {ROOMS.map((r) => {
          const list = byRoom[r.key];
          const lit = list.filter((u) => on[u.id]).length;
          const place = layout(r, list.length);
          return (
            <g key={r.key} clipPath={`url(#clip-${r.key.replace(' ', '-')})`}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#room-glow)" className="room-glow" style={{ opacity: lit ? 0.35 + (0.65 * lit) / list.length : 0 }} />
              {list.map((u, i) => {
                const p = place(i);
                return <circle key={u.id} cx={p.x} cy={p.y} r="62" fill="url(#spill)" className="spill" style={{ opacity: on[u.id] ? 1 : 0 }} />;
              })}
            </g>
          );
        })}
      </g>

      {ROOMS.map((r) => (
        <rect key={r.key} className="wall" x={r.x} y={r.y} width={r.w} height={r.h} />
      ))}

      {ROOMS.map((r) => {
        const list = byRoom[r.key];
        const place = layout(r, list.length);
        return (
          <g key={r.key}>
            <text className="room-label" x={r.x + 14} y={r.y + 22}>{r.key}</text>
            {list.map((u, i) => {
              const p = place(i);
              return (
                <g
                  key={u.id}
                  className={`fixture ${on[u.id] ? 'on' : ''} ${onPick ? 'pickable' : ''}`}
                  transform={`translate(${p.x} ${p.y})`}
                  onClick={onPick ? () => onPick(u.id) : undefined}
                >
                  <title>{`${u.name}, ${u.watts} W, ${on[u.id] ? 'on' : 'off'}`}</title>
                  <Glyph kind={kindOf(u.name)} />
                  <text y="25" className="fixture-label">{shortName(u.name)}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
