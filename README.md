# Ujala — Power Cut Planner

Ujala helps a household decide which appliances to keep running during a power
cut. It chooses the most valuable feasible set of appliances while respecting
the inverter's running-load limit, the battery's usable energy, start-up surge,
and must-run appliances.

Ujala is a **planner, not a controller**. It does not connect to an inverter or
switch appliances automatically. The household follows the generated plan
manually.

## Manufacturer-informed setup

Choose a Luminous, Microtek or V-Guard model, review its technical specifications,
configure the actual battery, and add appliances by category. Five inverter
presets and 25 appliance entries include explicit source and estimate labels.
Custom inverter ratings and appliance wattage overrides remain available.

See [catalogue implementation, sources, API and validation](docs/manufacturer-catalogues.md)
for the exact models, data limitations, shared power model, and file changes.
Include the root `shared/` folder when deploying either app. Dropdown datasets
are bundled at frontend build time from the same JSON files served by the API.

## What it demonstrates

Ujala is a data structures and algorithms project with an interactive React
interface:

- **Greedy** selection using importance per watt
- **0/1 dynamic programming** over watt and energy capacities
- **Branch and bound** with least-cost, FIFO, and LIFO search strategies
- **Brute force** subset enumeration as a correctness baseline
- Hand-written **max heap**, **queue**, **stack**, **AVL tree**, and **BST**
- Appliance catalogue prefix search backed by an AVL tree
- Staged recommendations for longer outages
- Operation counts, timings, pruning statistics, DP heatmaps, and branch-and-bound
  state-space trees

The **Planner** page is intended for creating a practical backup plan. The
**Algorithm lab** page compares methods on the same input and visualizes how
they work.

## Power model

For an inverter setup:

```text
running limit (W) = rated output watts, when supplied; otherwise inverter VA × power factor
estimated peak (W) = running limit × configurable surge tolerance
usable energy (Wh) = battery Ah × voltage × depth of discharge
                    × battery health × inverter efficiency
```

Each appliance unit contributes:

```text
energy (Wh)  = watts × min(hours needed, outage hours) × duty cycle
surge extra  = (surge factor − 1) × watts
value        = importance score from 1 to 10
```

The selected set must satisfy:

1. Total running watts do not exceed the running limit.
2. Total energy does not exceed usable battery energy.
3. Running watts plus the largest start-up surge do not exceed the peak limit.
4. Every appliance marked `mustRun` is selected.

Quantities are expanded into separate units, so three fans are treated as three
independent choices.

## Project structure

```text
ujala/
├── backend/
│   ├── data/
│   │   ├── catalogue.json       # Default appliance catalogue
│   │   └── testcases.json       # Demonstration and test scenarios
│   └── src/
│       ├── model.js             # Validation, capacities, constraints, plans
│       ├── planner.js           # Algorithm selection and comparison
│       ├── server.js            # Express API
│       ├── algorithms/          # Greedy, DP, B&B, brute force, staged plan
│       ├── ds/                  # Heap, queue, stack, AVL tree, BST
│       └── tests/run-tests.js
├── frontend/
│   ├── src/
│   │   ├── pages/               # Landing, Planner, Algorithm lab
│   │   ├── components/          # House, controls, switchboard, case loader
│   │   ├── store.js             # Zustand application state
│   │   └── power.js             # Frontend power calculations
│   ├── index.html
│   └── vite.config.js           # Dev server and API proxy
├── report/                      # Project report and supporting figures
└── PRD.md                      # Product and algorithm requirements
```

## Requirements

- Node.js 22 or newer
- npm

## Getting started

Install dependencies in both packages:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Start the backend in one terminal:

```bash
cd backend
npm run dev
```

The API runs at `http://localhost:4000/api`.

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in a browser. The Vite development server proxies
`/api` requests to the backend.

For a production frontend bundle:

```bash
cd frontend
npm run build
npm run preview
```

To run the backend directly:

```bash
cd backend
npm start
```

## API

All API routes are under `/api`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check server availability and catalogue size |
| `GET` | `/catalogue?prefix=fan` | Search default appliances by name prefix |
| `POST` | `/catalogue` | Add an appliance to the in-memory catalogue |
| `GET` | `/catalogue/heights` | Compare AVL and plain BST heights |
| `GET` | `/testcases` | Load built-in demonstration cases |
| `POST` | `/plan` | Run one selected algorithm |
| `POST` | `/compare` | Run all applicable algorithms |
| `POST` | `/staged` | Generate plans for multiple outage durations |
| `POST` | `/bb-tree` | Return branch-and-bound trace data for the lab |

Example request:

```bash
curl -X POST http://localhost:4000/api/plan ^
  -H "content-type: application/json" ^
  -d "{\"algorithm\":\"bb-lc\",\"setup\":{\"inverterVA\":800,\"batteryAh\":150,\"batteryV\":12,\"batteryType\":\"tubular\",\"health\":100,\"outageHours\":4},\"appliances\":[{\"name\":\"Fan\",\"watts\":60,\"quantity\":2,\"importance\":7,\"hoursNeeded\":4},{\"name\":\"Fridge\",\"watts\":180,\"importance\":10,\"surgeFactor\":3,\"dutyCycle\":0.4,\"hoursNeeded\":4,\"mustRun\":true}]}"
```

The response includes selected and excluded appliances, constraint results,
load/energy/surge totals, estimated backup time, and algorithm statistics.

## Algorithms and trade-offs

| Method | Role | Complexity |
| --- | --- | --- |
| Greedy | Fast baseline ordered by importance per watt | `O(n log n)` |
| Dynamic programming | Exact for running load and energy constraints | `O(n × W × E)` pseudo-polynomial |
| Branch and bound | Exact search including surge; LC/FIFO/LIFO vary traversal | Exponential worst case |
| Brute force | Ground truth for small cases | `O(2ⁿ × n)` |

Greedy is not guaranteed to be optimal because an appliance is an indivisible
0/1 choice. Dynamic programming is exact for its watt and energy table, but it
does not model the surge constraint in the same way; the API reports a surge
warning when a DP result fails that check. Branch and bound is the recommended
production method because it handles all three physical constraints and uses
fractional upper bounds to prune the search tree.

Brute force is intentionally limited to 20 optional appliance units because
the number of subsets grows as `2ⁿ`.

## Testing

Run the backend test suite:

```bash
cd backend
npm test
```

The tests cover the custom data structures, power model, all optimization
methods, feasibility and optimality comparisons, staged plans, API endpoints,
and complexity-comment coverage.

Build-check the frontend:

```bash
cd frontend
npm run build
```

## Notes

- The custom catalogue endpoint is in-memory and is reset when the backend
  restarts.
- The frontend shows an offline banner if the backend on port `4000` cannot be
  reached.
- `report/` contains the accompanying project report and figures.

