import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import CaseLoader, { useTestcases } from '../components/CaseLoader.jsx';
import { METHODS } from './Planner.jsx';

let growthJob = null;
const label = (id) => METHODS.find((m) => m.id === id)?.label ?? id;
const n = (x) => (x == null ? '-' : x.toLocaleString('en-IN'));

function Race({ result }) {
  if (!result) return <p className="hint">Running every method on this setup.</p>;
  const valid = result.plans.filter((p) => p.constraintsOk.C1 && p.constraintsOk.C2 && p.constraintsOk.C3);
  const best = Math.max(...valid.map((p) => p.totalImportance));
  const ok = (v) => (v ? <span className="tick">Met</span> : <span className="cross">Broken</span>);

  return (
    <div className="race-wrap">
      <table className="race">
        <thead>
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Importance</th>
            <th scope="col">Verdict</th>
            <th scope="col">Running load</th>
            <th scope="col">Battery</th>
            <th scope="col">Surge</th>
            <th scope="col">Work done</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {result.plans.map((p) => {
            const surgeFail = !p.constraintsOk.C3;
            const short = best - p.totalImportance;
            let verdict = <span className="good">Best possible</span>;
            if (surgeFail) verdict = <span className="cross">Would trip when the {p.selected.find((s) => s.surgeExtra === Math.max(...p.selected.map((x) => x.surgeExtra)))?.name} starts</span>;
            else if (short > 0) verdict = <span className="cross">{short} short of the best</span>;
            const work =
              p.stats.subsets != null ? `${n(p.stats.subsets)} subsets`
              : p.stats.cells != null ? `${n(p.stats.cells)} cells`
              : p.stats.nodesExpanded != null ? `${n(p.stats.nodesExpanded)} nodes expanded, ${n(p.stats.pruned)} pruned`
              : `${n(p.stats.operations)} steps`;
            return (
              <tr key={p.algorithm} className={surgeFail || short > 0 ? 'row-bad' : ''}>
                <th scope="row">{label(p.algorithm)}</th>
                <td className="big num">{p.totalImportance}</td>
                <td>{verdict}</td>
                <td>{ok(p.constraintsOk.C1)} <small className="num">{p.loadPct}%</small></td>
                <td>{ok(p.constraintsOk.C2)} <small className="num">{p.energyPct}%</small></td>
                <td>{ok(p.constraintsOk.C3)} <small className="num">{n(p.surge.peakDemandW)} / {n(p.surge.peakW)} W</small></td>
                <td className="num">{work}</td>
                <td className="num">{p.stats.timeMs} ms</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {result.optionalCount > 20 && <p className="hint">Brute force skipped: {result.optionalCount} optional appliances is more than 20.</p>}
    </div>
  );
}

// Night-to-glow colour ramp for the DP heatmap.
function ramp(f) {
  const a = [31, 39, 66];
  const b = [255, 181, 71];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * f)).join(',')})`;
}

function Heatmap({ table }) {
  if (!table) return <p className="hint">Run the race to fill the table.</p>;
  const { values, wAxis, eAxis, path } = table;
  const rows = values.length;
  const cols = values[0].length;
  const max = Math.max(1, ...values.flat());
  const W = 420;
  const H = 300;
  const cw = W / cols;
  const ch = H / rows;
  const wMax = wAxis[wAxis.length - 1] || 1;
  const eMax = eAxis[eAxis.length - 1] || 1;
  const px = (e) => (eMax ? (e / eMax) * (W - cw) + cw / 2 : cw / 2);
  const py = (w) => H - (wMax ? (w / wMax) * (H - ch) + ch / 2 : ch / 2);
  return (
    <figure className="heatmap">
      <svg viewBox={`-50 -10 ${W + 60} ${H + 50}`} role="img" aria-label="Heatmap of the final DP table">
        {values.map((row, r) =>
          row.map((v, c) => (
            <rect key={`${r}-${c}`} x={c * cw} y={H - (r + 1) * ch} width={cw + 0.5} height={ch + 0.5} fill={ramp(v / max)}>
              <title>{`${wAxis[r]} W, ${eAxis[c]} Wh available: best importance ${v}`}</title>
            </rect>
          ))
        )}
        <polyline points={path.map((p) => `${px(p.e)},${py(p.w)}`).join(' ')} className="dp-path" />
        {path.map((p, i) => (
          <circle key={i} cx={px(p.e)} cy={py(p.w)} r="3.5" className="dp-dot" />
        ))}
        <text x={W / 2} y={H + 34} className="axis-title" textAnchor="middle">Battery energy available (Wh) →</text>
        <text transform={`translate(-34 ${H / 2}) rotate(-90)`} className="axis-title" textAnchor="middle">Watts available →</text>
        <text x="0" y={H + 16} className="axis">0</text>
        <text x={W} y={H + 16} className="axis" textAnchor="end">{n(eMax)}</text>
        <text x="-6" y={H} className="axis" textAnchor="end">0</text>
        <text x="-6" y="8" className="axis" textAnchor="end">{n(wMax)}</text>
      </svg>
      <figcaption>
        Each cell is <code>dp[w][e]</code>: the best importance reachable with w watts and e Wh to spare. The white line walks back through the
        keep table from the top-right corner, taking one appliance per step.
      </figcaption>
    </figure>
  );
}

function Tree({ data }) {
  if (!data) return <p className="hint">Loading the search tree.</p>;
  const kids = {};
  for (const nd of data.nodes) (kids[nd.parent] ??= []).push(nd);
  const pos = {};
  let leaf = 0;
  const place = (nd) => {
    const ch = kids[nd.id] ?? [];
    ch.forEach(place);
    pos[nd.id] = { x: ch.length ? (pos[ch[0].id].x + pos[ch[ch.length - 1].id].x) / 2 : leaf++ * 26, y: nd.level * 54 };
  };
  const roots = kids[null] ?? [];
  roots.forEach(place);
  const onBest = {};
  const byId = Object.fromEntries(data.nodes.map((nd) => [nd.id, nd]));
  for (let id = data.bestId; id != null && byId[id]; id = byId[id].parent) onBest[id] = true;
  const width = Math.max(200, leaf * 26);
  const height = Math.max(...data.nodes.map((nd) => nd.level)) * 54 + 30;

  return (
    <svg viewBox={`-16 -16 ${width + 16} ${height + 16}`} className="tree" role="img" aria-label="Branch and bound state-space tree">
      {data.nodes.filter((nd) => nd.parent != null && pos[nd.parent]).map((nd) => (
        <line
          key={`e${nd.id}`}
          x1={pos[nd.parent].x} y1={pos[nd.parent].y} x2={pos[nd.id].x} y2={pos[nd.id].y}
          className={`edge ${nd.decision} ${onBest[nd.id] ? 'best' : ''}`}
        />
      ))}
      {data.nodes.map((nd) => (
        <g key={nd.id} transform={`translate(${pos[nd.id].x} ${pos[nd.id].y})`} className={`tnode ${nd.status} ${onBest[nd.id] ? 'best' : ''}`}>
          <title>{`${nd.decision} at level ${nd.level}: value ${nd.value}${nd.bound != null ? `, bound ${nd.bound}` : ''}, ${nd.status}`}</title>
          <circle r="10" />
          {(nd.status === 'pruned' || nd.status === 'infeasible') && <path d="M-6,-6L6,6M6,-6L-6,6" className="x" />}
          {nd.bound != null && nd.status !== 'pruned' && <text y="3.5" textAnchor="middle">{nd.bound}</text>}
        </g>
      ))}
    </svg>
  );
}

function GrowthChart({ data }) {
  if (!data) return <p className="hint">Timing TC6 at 10 to 20 appliances.</p>;
  const series = [
    { key: 'brute', name: 'Brute force subsets', cls: 's-brute' },
    { key: 'dp', name: 'DP cells', cls: 's-dp' },
    { key: 'lc', name: 'B&B least cost', cls: 's-lc' },
    { key: 'fifo', name: 'B&B FIFO', cls: 's-fifo' },
    { key: 'lifo', name: 'B&B LIFO', cls: 's-lifo' },
  ];
  const W = 460;
  const H = 260;
  const xs = data.map((d) => d.n);
  const maxLog = Math.ceil(Math.log10(Math.max(...data.flatMap((d) => series.map((s) => d[s.key])))));
  const x = (v) => ((v - xs[0]) / (xs[xs.length - 1] - xs[0])) * W;
  const y = (v) => H - (Math.log10(Math.max(1, v)) / maxLog) * H;
  // Direct labels at the line ends, nudged apart so close lines don't overprint.
  const labelY = {};
  const ends = series.map((s) => ({ key: s.key, y: y(data[data.length - 1][s.key]) })).sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => (labelY[e.key] = i && e.y - labelY[ends[i - 1].key] < 15 ? labelY[ends[i - 1].key] + 15 : e.y));  return (
    <svg viewBox={`-46 -12 ${W + 280} ${H + 52}`} className="growth" role="img" aria-label="Work done by each method as the number of appliances grows, log scale">
      {Array.from({ length: maxLog + 1 }, (_, i) => (
        <g key={i}>
          <line x1="0" x2={W} y1={y(10 ** i)} y2={y(10 ** i)} className="grid" />
          <text x="-8" y={y(10 ** i) + 4} textAnchor="end" className="axis">{i === 0 ? '1' : `10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[i]}`}</text>
        </g>
      ))}
      {xs.map((v) => (
        <text key={v} x={x(v)} y={H + 18} textAnchor="middle" className="axis">{v}</text>
      ))}
      <text x={W / 2} y={H + 38} textAnchor="middle" className="axis-title">Optional appliances (n)</text>
      {series.map((s) => (
        <g key={s.key} className={`series ${s.cls}`}>
          <polyline points={data.map((d) => `${x(d.n)},${y(d[s.key])}`).join(' ')} />
          {data.map((d) => (
            <circle key={d.n} cx={x(d.n)} cy={y(d[s.key])} r="3">
              <title>{`n = ${d.n}: ${n(d[s.key])}`}</title>
            </circle>
          ))}
          <text x={W + 10} y={labelY[s.key] + 4}>
            {s.name} <tspan className="num">{n(data[data.length - 1][s.key])}</tspan>
          </text>
        </g>
      ))}
    </svg>
  );
}

const COMPLEXITY = [
  ['Greedy (importance per watt)', 'O(n log n)', 'Heap sort, then one pass', 'Fast; can miss the best set (TC2)'],
  ['0/1 knapsack DP, two limits', 'O(n · W · E)', 'Table over watts × energy', 'Exact for load and battery; pseudo-polynomial'],
  ['Branch and bound (LC, FIFO, LIFO)', 'O(2ⁿ) worst case', 'Heap, queue or stack of nodes', 'Exact for all three limits; pruning keeps it small'],
  ['Brute force', 'O(2ⁿ · n)', 'Bitmask over every subset', 'Ground truth; only up to n = 20'],
  ['Heap sort', 'O(n log n)', 'Array-backed max-heap', 'Orders items for greedy and B&B'],
  ['AVL catalogue', 'O(log n) search and insert', 'Self-balancing BST', 'Prefix search as you type'],
];

export default function Lab() {
  const { setup, appliances, call, loadCase } = useStore();
  const cases = useTestcases();
  const [race, setRace] = useState(null);
  const [raceError, setRaceError] = useState('');
  const [strategy, setStrategy] = useState('LC');
  const [tree, setTree] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [heights, setHeights] = useState(null);

  useEffect(() => {
    let live = true;
    setRace(null);
    setRaceError('');
    call('/compare', { setup, appliances })
      .then((r) => live && setRace(r))
      .catch((e) => live && setRaceError(e.message || ''));
    return () => {
      live = false;
    };
  }, [setup, appliances, call]);

  useEffect(() => {
    let live = true;
    setTree(null);
    call('/bb-tree', { setup, appliances, strategy }).then((r) => live && setTree(r)).catch(() => {});
    return () => {
      live = false;
    };
  }, [setup, appliances, strategy, call]);

  useEffect(() => {
    call('/catalogue/heights').then(setHeights).catch(() => {});
  }, [call]);

  useEffect(() => {
    const tc6 = cases.find((c) => c.id === 'TC6');
    if (!tc6) return;
    // Shared across mounts: twelve brute-force runs are worth doing once per page load.
    growthJob ??= (async () => {
      const rows = [];
      for (let k = 10; k <= 20; k += 2) {
        const { plans } = await call('/compare', { setup: tc6.setup, appliances: tc6.appliances.slice(0, k) });
        const s = (id) => plans.find((p) => p.algorithm === id).stats;
        rows.push({ n: k, brute: s('brute').subsets, dp: s('dp').cells, lc: s('bb-lc').nodesExpanded, fifo: s('bb-fifo').nodesExpanded, lifo: s('bb-lifo').nodesExpanded });
      }
      return rows;
    })();
    let live = true;
    growthJob.then((rows) => live && setGrowth(rows)).catch(() => (growthJob = null));
    return () => {
      live = false;
    };
  }, [cases, call]);

  const nodeCount = (id) => race?.plans.find((p) => p.algorithm === id)?.stats.nodesExpanded;
  const dpPlan = race?.plans.find((p) => p.algorithm === 'dp');

  return (
    <main className="lab">
      <div className="lab-head">
        <div>
          <h1>Algorithm lab</h1>
          <p className="lede">Every method plans the same house. The race shows which ones find the best plan and which ones would leave you in the dark.</p>
        </div>
        <div className="lab-controls">
          <CaseLoader />
          <div className="quick">
            {['TC2', 'TC4', 'TC6'].map((id) => {
              const tc = cases.find((c) => c.id === id);
              return (
                <button key={id} className="btn ghost" disabled={!tc} onClick={() => loadCase(tc)}>
                  {id}: {tc?.name ?? id}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="panel race-panel">
        <h2>Race</h2>
        {raceError ? <p className="bad">{raceError}</p> : <Race result={race} />}
      </section>

      <div className="lab-grid">
        <section className="panel">
          <h2>DP table</h2>
          <Heatmap table={dpPlan?.dpTable} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Branch and bound search tree</h2>
            <div className="segmented" role="group" aria-label="Search strategy">
              {['LC', 'FIFO', 'LIFO'].map((s) => (
                <button key={s} className={strategy === s ? 'active' : ''} aria-pressed={strategy === s} onClick={() => setStrategy(s)}>
                  {s} <small className="num">{n(nodeCount(`bb-${s.toLowerCase()}`))}</small>
                </button>
              ))}
            </div>
          </div>
          <Tree data={tree} />
          <p className="legend">
            Numbers are each node's upper bound. Solid edges include the next appliance, dashed edges leave it out. Crossed nodes were pruned or
            broke a limit. The amber path leads to the best plan. First 60 nodes shown.
          </p>
        </section>
        <section className="panel">
          <h2>Growth as the house gets bigger</h2>
          <GrowthChart data={growth} />
          <p className="legend">Log scale. Brute force doubles with every appliance; branch and bound grows far slower because bounds prune whole subtrees.</p>
        </section>
        <section className="panel">
          <h2>Catalogue tree height</h2>
          {heights ? (
            <div className="heights">
              <p>{heights.n} appliance names inserted in alphabetical order:</p>
              {[
                ['Plain BST', heights.bstHeight, 'bar-bst'],
                ['AVL tree', heights.avlHeight, 'bar-avl'],
              ].map(([name, h, cls]) => (
                <div className="hbar" key={name}>
                  <span>{name}</span>
                  <i className={cls} style={{ width: `${(100 * h) / heights.n}%` }} />
                  <b className="num">{h}</b>
                </div>
              ))}
              <p className="legend">Sorted input turns a plain BST into a linked list. AVL rotations keep the height near log₂ n, so every search stays fast.</p>
            </div>
          ) : (
            <p className="hint">Needs the server.</p>
          )}
          <h2 className="sub">Complexity</h2>
          <table className="complexity">
            <thead>
              <tr>
                <th scope="col">Algorithm</th>
                <th scope="col">Time</th>
                <th scope="col">Structure</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {COMPLEXITY.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
