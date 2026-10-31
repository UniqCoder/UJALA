<div align="center">

# UJALA

### When the power goes out, know what to keep on.

A household inverter planner that turns your inverter, battery, appliances and priorities into an actionable backup plan.

**Automatic optimization · Manufacturer-informed setup · Explainable decisions**

[Get started](#run-ujala-locally) · [Features](#what-you-can-do) · [Data structures](#data-structures-used) · [How it decides](#how-the-optimization-works) · [API](#api-reference)

</div>

---

## What is UJALA?

UJALA helps answer a practical question during a power cut:

> **“Which appliances should I keep running so that the things I need most fit within my inverter and battery limits?”**

Select your inverter model, enter your actual battery configuration, add household appliances, and set their importance. UJALA automatically chooses a feasible combination, estimates its backup time, and explains what was left out and why.

The project combines a household planning interface with an Algorithm Lab that makes the underlying data structures and optimization methods visible.

## The problem it solves

An inverter's rating alone does not tell a household how to use its backup well. A setup can stay within its running-watt limit and still exhaust the battery too early. A motor can also need more power at startup than it draws while running.

| Household question | What UJALA considers |
| --- | --- |
| Can these appliances run together? | Continuous running watts versus inverter capacity |
| Will the battery cover the expected outage? | Appliance energy demand versus estimated usable battery energy |
| Could a motor's startup exceed the allowance? | Running load plus the largest additional startup surge |
| What matters most if everything cannot run? | User-assigned importance and must-run requirements |
| What if the outage lasts longer? | Staged plans across multiple outage durations |
| Why was an appliance excluded? | An explanation of its running-load, energy or surge constraint |

**The goal is to make better use of the backup you already have.** UJALA recommends a plan for the household to follow; physical appliance switching remains manual.

## What you can do

| Feature | How it helps |
| --- | --- |
| **Choose your actual inverter** | Cascading manufacturer/model selection applies documented ratings, bank voltage and available specifications. Custom configurations remain editable. |
| **Configure the real battery** | Set bank Ah, voltage, chemistry, health and expected outage duration. Review compatibility warnings. |
| **Add appliances by category** | Choose fans, refrigerators, lighting, electronics, and kitchen/utility appliances without typing their specifications from scratch. |
| **Set household priorities** | Adjust quantity, room, importance, required hours and must-run status. Override watts, duty cycle and startup assumptions. |
| **Plan automatically** | Click **Plan my backup**. The Planner handles optimization without asking you to choose an algorithm. |
| **See the result** | Explore the room-based house visualization, appliance switchboard and inverter-style indicators. |
| **Understand trade-offs** | Review selected appliances, excluded appliances, estimated backup hours, load, energy, startup demand and explanations. |
| **Prepare for a longer outage** | Inspect the outage timeline and staged switch-off/switch-on recommendations. |
| **Explore the algorithms** | Compare methods, operation counts, execution times, search strategies and visualizations in Algorithm Lab. |

### Two experiences, one model

**Planner — for the household.** Configure the setup, describe priorities, and get an automatically optimized plan. Manual switch toggles let you explore how a different appliance combination changes the indicators.

**Algorithm Lab — for understanding the engineering.** Compare greedy, dynamic programming, three branch-and-bound traversals, and brute force on the same inputs. Inspect the DP heatmap, search tree, pruning statistics, growth comparisons and AVL/BST height comparison.

## A typical planning session

1. **Select the inverter.** Choose a manufacturer/model or enter a custom configuration.
2. **Configure the battery.** Use your actual bank capacity, voltage, chemistry and health; enter the expected outage duration.
3. **Add household appliances.** Assign rooms and quantities, review power defaults, and set importance and required hours.
4. **Mark essentials as must-run.** For example, keep the work router included if that is a non-negotiable requirement.
5. **Click Plan my backup.** Review the selected combination and the reasons for exclusions. Explore the longer-outage timeline if needed.

If the must-run appliances alone exceed a modeled limit, UJALA explains the conflict instead of silently dropping them.

## Manufacturer and appliance data

The catalogue currently includes **five inverter presets**:

| Manufacturer | Model | VA rating | Published watt capacity | Battery bank |
| --- | --- | ---: | ---: | ---: |
| Luminous | Zelio+ 1100 | 900 VA | 756 W | 12 V |
| Luminous | Power sine 1100 | 900 VA | 756 W | 12 V |
| Luminous | Zelio+ 1700 | 1500 VA | 1260 W | 24 V |
| Microtek | SUPER POWER UPS 1100 SW, SKU 899-A21-1101 | 950 VA | 760 W | 12 V |
| V-Guard | Prime 1150 | 1000 VA | 800 W | 12 V |

The appliance specification catalogue contains **25 entries across five categories**: 23 editable generic estimates and two exact manufacturer products, the Philips 9 W smart bulb and Samsung H4570 32-inch TV. Exact-product verification applies only to the fields supported by each source; it does not certify every default in that entry.

Data is deliberately separated by purpose:

| File | Responsibility |
| --- | --- |
| [`inverter-catalogue.json`](backend/data/inverter-catalogue.json) | Inverter identities, ratings, compatibility information and available technical specifications |
| [`appliance-specifications.json`](backend/data/appliance-specifications.json) | Categories, exact products, generic estimates and editable appliance defaults |
| [`data-sources.json`](backend/data/data-sources.json) | Item-level source URLs, reviewed dates, supported fields, confidence and caveats |
| [`catalogue.json`](backend/data/catalogue.json) | Original algorithm-ready appliance catalogue, preserved alongside mapped specification entries |
| [`testcases.json`](backend/data/testcases.json) | Synthetic demonstration and acceptance-test scenarios |

Manufacturer-sourced values, generic estimates and user overrides are distinguished in the interface. Missing specifications stay absent rather than receiving invented precision. Source conflicts and model-revision caveats are recorded in the [catalogue implementation and source notes](docs/manufacturer-catalogues.md).

## How the optimization works

Each appliance unit is an indivisible choice: include it or leave it out. Quantity is expanded into individual units, allowing some fans or lights to remain on while others are excluded.

**Objective:** maximize the sum of selected appliance importance scores, subject to four requirements:

1. **Running load:** total running watts fit within the inverter's continuous limit.
2. **Battery energy:** estimated energy demand fits within usable battery energy.
3. **Startup surge:** running watts plus the largest additional motor-starting demand fit within the configured peak allowance.
4. **Must-run:** every essential appliance is included, or the setup is reported as infeasible.

The automatic Planner uses **least-cost branch and bound** with fractional-knapsack upper bounds to prune choices that cannot improve the result. It does not run every algorithm just to generate an ordinary household plan.

When that search completes, the result is optimal for the supplied inputs and importance objective. If the existing **200,000-node expansion cap** is reached, UJALA compares the feasible search result with the greedy baseline, keeps the better one, and labels it **best found**, without claiming proven optimality.

### Why not just choose the most efficient appliance first?

One built-in synthetic test has a 600 W limit: floodlights need 350 W and are worth 9 importance points; two PCs each need 300 W and are worth 7 points. Greedy takes the floodlights first and scores 9. The two PCs together fit at 600 W and score 14. This demonstrates why individually attractive choices can produce a weaker overall plan.

### Methods available in Algorithm Lab

| Method | Role | Important trade-off |
| --- | --- | --- |
| Greedy | Fast importance-per-watt baseline | `O(n log n)`; not guaranteed optimal |
| Dynamic programming | Watt-and-energy knapsack table | `O(nWE)` time; ignores surge during selection and may coarsen table steps to fit memory |
| Branch and bound — LC | Best-bound-first search; used by automatic planning | Handles running load, energy and surge; exponential worst case with pruning and a node cap |
| Branch and bound — FIFO | Breadth-first exploration | Same constraints, different search order and frontier behavior |
| Branch and bound — LIFO | Depth-first exploration | Same constraints, different search order and frontier behavior |
| Brute force | Exhaustive correctness reference for small cases | `O(2ⁿn)`; limited to 20 optional units |

Here, `n` is optional appliance-unit count; `W` and `E` are the discretized DP capacities. DP results receive a separate surge check and warning when necessary. A plan that fails a constraint is not applied to the Planner switchboard.

## Data structures used

The core structures below are implemented directly in [`backend/src/ds`](backend/src/ds), so their behavior can be inspected rather than hidden behind an external algorithms library.

| Data structure | Where UJALA uses it | Why it is used | Key costs |
| --- | --- | --- | --- |
| **AVL tree** | Appliance-name catalogue and legacy prefix search | Keeps the name index balanced; returns matching appliances in name order | Insert/exact lookup `O(log n)`; prefix search `O(log n + k)` for `k` matches |
| **Binary max-heap / priority queue** | Least-cost branch-and-bound frontier and custom heap sort | Explores the node with the highest remaining importance bound first; orders appliances by priority | Push/pop `O(log n)`; heap sort `O(n log n)` |
| **Circular-buffer queue** | FIFO branch-and-bound frontier | Preserves breadth-first order without shifting the full array on each removal | Enqueue amortized `O(1)`; dequeue `O(1)` |
| **Array-backed stack** | LIFO branch-and-bound frontier | Supports depth-first exploration with explicit last-in, first-out behavior | Push amortized `O(1)`; pop `O(1)` |
| **Unbalanced BST** | Catalogue height comparison in the Lab/API | Demonstrates how sorted insertion can create a linear-height tree compared with AVL balancing | Insert `O(h)`; worst-case height `O(n)` |
| **Typed-array DP tables** | Dynamic-programming solver | Stores best importance and reconstruction decisions in compact contiguous arrays | `Int32Array` for scores; `Uint8Array` for keep decisions; `O(nWE)` total table space |
| **Arrays and ID-keyed objects** | Appliance lists, selected units, switch states and membership checks | Maintains ordered collections and direct ID-based state access | Iteration `O(n)`; ordinary object-key access typically constant time |

The **max-heap powers the automatic Planner**, while the queue and stack support alternative traversals in the Lab. The plain BST is a comparison structure, not the production catalogue index.

## Power model

The frontend indicators and backend solvers import the same capacity function from [`shared/power.js`](shared/power.js).

| Quantity | Calculation |
| --- | --- |
| Continuous running limit | Manufacturer-rated watts when available; otherwise `VA × power factor` |
| Estimated peak allowance | `running limit × configurable surge tolerance` |
| Usable battery energy | `bank Ah × bank V × depth of discharge × health × inverter efficiency` |
| Appliance energy | `watts × min(required hours, outage hours) × duty cycle` |
| Additional startup demand | `(startup factor − 1) × running watts` |
| Displayed backup estimate | `usable battery energy ÷ sum(selected watts × duty cycle)` |

A published W/VA ratio is not presented as a manufacturer-verified power factor. A series-manual efficiency bound is not silently converted into an exact measured efficiency. Surge allowance and efficiency assumptions remain visibly editable when no suitable exact rating is available.

## Run UJALA locally

**Requirements:** Node.js **22.12 or newer** and npm. No database, API key or external product-data service is required for the current application.

Clone the repository and install both packages:

```bash
git clone https://github.com/UniqCoder/UJALA.git
cd UJALA
npm ci --prefix backend
npm ci --prefix frontend
```

**Terminal 1 — from the UJALA repository root:**

```bash
npm start --prefix backend
```

**Terminal 2 — also from the UJALA repository root:**

```bash
npm run dev --prefix frontend
```

Open **[http://localhost:5173](http://localhost:5173)**, or go directly to the [Planner](http://localhost:5173/planner) or [Algorithm Lab](http://localhost:5173/lab). The backend health endpoint is [http://localhost:4000/api/health](http://localhost:4000/api/health).

Both terminals must remain running. These commands work in PowerShell as well as ordinary Unix shells. `localhost` refers to the computer on which you start the servers.

<details>
<summary><strong>Commands and common startup problems</strong></summary>

| Task | Command, run from the repository root |
| --- | --- |
| Backend with automatic restart | `npm run dev --prefix backend` |
| Backend tests | `npm test --prefix backend` |
| Frontend production build | `npm run build --prefix frontend` |
| Preview the frontend build | `npm run preview --prefix frontend` |
| Update the current checkout | `git pull origin master` |

**“Missing script: start”** usually means npm is running in the wrong folder. UJALA has separate `backend` and `frontend` packages; there is no root start script. Use the prefixed commands above from the repository root, or enter the appropriate package folder first.

**Cannot reach the page?** Check that Vite started successfully and use the Local URL it prints. If its usual port is occupied, that URL may use a different port.

**The page loads but planning fails?** Keep the backend running on port `4000`. The development server forwards `/api` requests there. If you change the backend port, update the Vite proxy accordingly.

**Production preview is not the development proxy.** `npm run preview` only serves the frontend build. A production setup needs the Express API and an explicit `/api` reverse proxy or equivalent routing. Keep the root `shared/` directory available to the backend, and include it in the frontend build context.

</details>

## Architecture and stack

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Interface | React 18, Vite, custom CSS, GSAP | Landing experience, Planner, house visualization and Algorithm Lab |
| Application state | Zustand | Setup, appliances, manual switches, plans and errors |
| Shared power model | JavaScript ES modules | Consistent capacity calculations and catalogue-to-input mapping |
| API | Node.js, Express | Input validation, catalogue access, planning and lab endpoints |
| Optimization | Custom JavaScript algorithms and data structures | Feasible selection, priority maximization, comparisons and traces |
| Data | Separate JSON datasets | Product specifications, assumptions, provenance and synthetic scenarios |

See [`backend/src/planner.js`](backend/src/planner.js) for automatic selection, [`backend/src/model.js`](backend/src/model.js) for validation and constraints, and [`frontend/src/pages/Planner.jsx`](frontend/src/pages/Planner.jsx) for the household workflow.

## API reference

All routes use the `/api` prefix. Validation failures return an explanatory `{ "error": "…" }` response.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend availability and catalogue size |
| `GET` | `/inverters?brand=Luminous` | All inverter models or manufacturer-filtered models |
| `GET` | `/inverters/:id` | Inverter specification record |
| `GET` | `/appliance-specifications?category=fans` | All appliance specifications or category-filtered items |
| `GET` | `/appliance-specifications/:id` | Appliance specification record |
| `GET` | `/data-sources` | Specification provenance and caveats |
| `GET` | `/catalogue?prefix=fan` | Legacy algorithm-ready prefix search |
| `POST` | `/catalogue` | Add/replace an in-memory catalogue entry |
| `GET` | `/catalogue/heights` | AVL-versus-BST height comparison |
| `GET` | `/testcases` | Built-in synthetic scenarios |
| `POST` | `/plan` | Automatic optimization by default; explicit methods available for experimentation |
| `POST` | `/compare` | Compare all applicable lab methods |
| `POST` | `/staged` | Automatic plans for multiple outage durations |
| `POST` | `/bb-tree` | Branch-and-bound trace for LC/FIFO/LIFO |

<details>
<summary><strong>Example automatic planning request</strong></summary>

Send this JSON body to `POST /api/plan`:

```json
{
  "algorithm": "auto",
  "setup": {
    "inverterId": "luminous-zelio-1100",
    "batteryAh": 150,
    "batteryV": 12,
    "batteryType": "tubular",
    "health": 100,
    "outageHours": 4
  },
  "appliances": [
    {
      "id": "router",
      "name": "Wi-Fi router",
      "watts": 12,
      "importance": 10,
      "mustRun": true
    },
    {
      "id": "fan",
      "name": "Ceiling fan",
      "watts": 75,
      "quantity": 2,
      "importance": 7,
      "hoursNeeded": 4,
      "dutyCycle": 1,
      "surgeFactor": 2
    }
  ]
}
```

The example appliance wattage and startup values are illustrative inputs. With a preset ID, inverter ratings are resolved from the backend catalogue. The response includes selected and excluded units, constraint checks, running/energy/surge totals, estimated backup hours, warnings, optimization status and execution statistics.

</details>

## Validation

The current backend test command passes **38 checks**: 22 original acceptance checks and 16 catalogue/API/automatic-planning checks. Coverage includes custom data structures, manufacturer filters, shared capacity calculations, manual overrides, compatibility warnings, motor surge, energy limits, must-run behavior, automatic results against brute force, and preservation of explicit lab methods.

```bash
npm test --prefix backend
npm run build --prefix frontend
```

React DOM interaction checks have also exercised catalogue selection, specification display, repeated appliance additions, custom edits and automatic planning. These are software checks using synthetic inputs; they are not physical inverter measurements or a real-world runtime benchmark.

## Scope and current limitations

- **Planning guidance:** UJALA does not read inverter telemetry, monitor live battery state, or control physical appliances.
- **Estimated inputs:** Battery health, duty cycle, inverter efficiency and motor-starting assumptions affect every runtime estimate. Generic appliance presets need adjustment to match actual equipment.
- **Simplified battery model:** Energy uses a static capacity model; it does not model temperature effects, nonlinear discharge curves or battery aging dynamically.
- **Simplified surge model:** The check adds the largest individual startup demand to the running load; simultaneous motor starts and surge duration are not simulated.
- **Search limits:** Completed automatic searches establish optimality for the modeled objective. Capped searches provide a feasible best-found result.
- **Session storage:** There are no user accounts or database. Planner state is held in browser memory, and custom API catalogue entries reset when the backend restarts.
- **Catalogue scope:** Manufacturer data covers the listed models and source revisions, not every inverter or appliance sold under those brands. Compatibility warnings do not constitute installation approval.

## Explore the project

| Resource | What you will find |
| --- | --- |
| [`frontend/src`](frontend/src) | Interface, state and visualizations |
| [`backend/src/algorithms`](backend/src/algorithms) | Greedy, DP, branch and bound, brute force and staged planning |
| [`backend/src/ds`](backend/src/ds) | Custom heap, queue, stack, AVL and BST implementations |
| [`shared/power.js`](shared/power.js) | Shared capacity and input-mapping helpers |
| [`docs/manufacturer-catalogues.md`](docs/manufacturer-catalogues.md) | Detailed catalogue sources, specifications and implementation notes |
| [`PRD.md`](PRD.md) | Original project requirements; current behavior is documented above |
| [`report/`](report) | Accompanying DSA report and supporting figures |

---

<div align="center">

**UJALA — make an informed plan for the power you have.**

</div>
