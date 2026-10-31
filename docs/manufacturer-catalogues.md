# Manufacturer and appliance catalogue implementation

## Configuration

The existing Planner now offers manufacturer → model selection, a technical specification card, battery configuration, category → appliance selection, and the existing optimization methods. Model selection is explicit: it applies inverter VA, rated watts and bank voltage, while retaining actual battery Ah, chemistry and health. Editing as custom retains values and removes the manufacturer preset identity. Clearing custom rated watts restores VA × PF. Custom running watts are user-entered, not manufacturer verified.

The category picker permits repeated additions and edits to watts, quantity, room, importance, required hours, must-run, duty and startup factor. The existing editor also exposes duty and startup overrides. Source provenance remains attached when wattage is overridden, with an explicit user-entered label. Legacy search, cases, house, switches and lab remain available.

Frontend dropdowns import the central JSON files at build time; they work without fetching a product service. The API reads those same files on startup. Rebuild the frontend and restart the backend after changing data to keep versions aligned. `shared/power.js` supplies the single capacity calculation implementation to both runtimes. Deployment must include the repository-level `shared` directory; do not deploy the backend folder in isolation.

## Inverter data, reviewed 2026-10-31

| Model | VA | Running W | DC bank | Batteries | Official source |
| --- | ---: | ---: | ---: | ---: | --- |
| Luminous Zelio+ 1100 | 900 | 756 | 12 V | 1 | [Luminous](https://www.luminousindia.com/home-inverters/zelio-1100) |
| Luminous Power sine 1100 | 900 | 756 | 12 V | 1 | [Luminous](https://www.luminousindia.com/home-inverters/power-sine-1100) |
| Luminous Zelio+ 1700 | 1500 | 1260 | 24 V | 2 | [Luminous](https://www.luminousindia.com/home-inverters/zelio-1700) |
| Microtek SUPER POWER UPS 1100 SW, SKU 899-A21-1101 | 950 | 760 | 12 V | 1 | [Microtek](https://www.microtek.in/product/power-backup-solutions/best-inverter-for-home-india/listing/super-power-pure-sinewave-ups-models-1100-12v-sw) |
| V-Guard Prime 1150 | 1000 | 800 | 12 V | 1 | [V-Guard](https://vguard.com/products/prime-1150-digital-inverter-ups) |

All five specify pure sine wave. No power factor was inferred from W/VA. Undocumented charging current, PF, surge rating/duration and numerical efficiency remain null. The card shows all available fields and unknowns.

Luminous Zelio and Microtek pages list flat plate, tubular and SMF batteries; the Power sine record leaves chemistry unknown because the retrieved standalone page did not establish it. The existing energy model supports flat plate, tubular and lithium; SMF is recorded as supported manufacturer data but not offered as a new battery-energy model.

V-Guard's overview says 80–220 Ah while its technical table says 80–230 Ah. Use the conservative intersection 80–220 Ah pending confirmation. Its key features say 1000 VA / 800 W capacity; the prose also calls 800 W maximum peak load. The 800 W capacity is the running ceiling, with no certified motor-starting allowance inferred. Estimated peaks above that require explicit manufacturer confirmation.

Microtek prints efficiency “<80%”; this is retained as a source caveat, not converted into a measured numerical efficiency. Users should replace the retained efficiency assumption with their validated value before relying on backup estimates.

For Zelio+ 1700, the technical table gives total bank voltage 24 V and two batteries; ambiguous prose must not be read as two individual 24 V batteries. Series batteries keep the same Ah.

## Appliance coverage

25 entries: 23 generic defaults plus two exact products. Categories cover five fan types, three refrigerator sizes, five lighting types, five electronics types, and five kitchen/utility types.

| Exact product | Verified input | Source |
| --- | --- | --- |
| Philips Smart Wi-Fi 9W LED Bulb E27 Pro, 8718699732585 | 9 W | [Philips / Signify](https://www.lighting.philips.co.in/consumer/p/smart-wi-fi-led-bulb-e27/8718699732585/specifications) |
| Samsung H4570 UA32H4570FUXXL | Maximum 65 W; AC 220–240 V, 50/60 Hz | [Samsung India](https://www.samsung.com/in/tvs/hd-tv/h4570-32-inch-hd-smart-tv-ua32h4570fuxxl/) |

Philips duty and surge are estimates, not verified product specifications. Samsung uses maximum input conservatively; typical consumption remains null. Its speaker output is not electrical input. Standby remains unknown for both.

All generic ratings, startup factors, and duty cycles are low-confidence editable planning assumptions, not measured category averages. Sources for generic assumptions are explicitly null; no manufacturer verification date is fabricated. Refrigerators use estimated compressor-on watts and cycling independently, never annual kWh divided into a running-watt rating. Kitchen appliances need realistic use hours; duty is the active fraction within those hours. Estimated Wh per hour is derived from planning watts × duty.

## Power and enforcement

- Continuous running limit: `ratedOutputW ?? inverterVA * powerFactor`.
- Estimated peak allowance: running limit × editable surge tolerance. No current record has a certified peak rating with known duration.
- Available energy: bank Ah × bank V × DoD × health × estimated inverter efficiency.
- Every algorithm receives the same computed capacity object. Selected presets are resolved against server data before normalization, preventing request-supplied ratings from replacing the preset's watts.
- Actual selected battery voltage is preserved server-side so mismatches produce warnings. Voltage, chemistry, Ah range and unknown compatibility are shown live and returned in plan warnings. These compatibility warnings do not block exploratory calculation or constitute installation approval.
- Existing running, energy, surge and must-run constraints remain intact. The lab's existing two-constraint DP can still return a surge-invalid example, with its warning and failed C3 flag preserved. Planner does not apply any plan that fails a constraint.

## API

| GET endpoint | Response |
| --- | --- |
| `/api/inverters` | `{ brands, models }` |
| `/api/inverters?brand=Luminous` | Same envelope, filtered models; case insensitive |
| `/api/inverters/:id` | Full inverter record |
| `/api/appliance-specifications` | `{ categories, items }` |
| `/api/appliance-specifications?category=fans` | Same envelope, filtered items |
| `/api/appliance-specifications/:id` | Full appliance record |
| `/api/data-sources` | Provenance array |
| `/api/catalogue` | Existing algorithm-ready AVL search, augmented with mapped specification defaults |

Unknown filters return empty arrays; unknown IDs return HTTP 404 with `{ error }`. Empty or repeated filter parameters return HTTP 400. Existing POST planning and lab endpoints retain their contracts, accepting optional `setup.inverterId` and `setup.ratedOutputW`. With a preset ID, trusted server ratings take precedence. Without one, optional rated watts are treated as user-entered input.

`data-sources.json` documents provenance by item ID, exact product, source URL/title, retrieval/review date, supported fields, confidence, estimated fields and missing-data caveats. `applianceDefaults()` maps the specification records to the existing watts/surgeFactor/dutyCycle contract without changing `catalogue.json`.

## File changes

Created: three JSON datasets in `backend/data`; `backend/src/catalogues.js`; `backend/src/tests/catalogues.test.js`; `shared/power.js` and `shared/package.json`; `frontend/src/components/InverterSelector.jsx` and `AppliancePicker.jsx`; this document.

Modified: backend `package.json`, model, planner and server; frontend Planner, Switchboard, InverterPanel, store, power adapter and styles; README. Existing algorithm implementations, `catalogue.json`, `testcases.json`, and original acceptance tests are unchanged.

## Validation

`cd backend && npm test`: 22 original acceptance checks and 13 new catalogue/model/API checks. Coverage includes brands, filters, details, preset population, authoritative watts, fallback PF, shared frontend/backend capacities, defaults, persistent overrides, voltage/chemistry/Ah warnings, motor surge, energy, must-run, all algorithms, unknown IDs, malformed filters and provenance.

`cd frontend && npm run build`: production bundle builds successfully.

React DOM interaction checks also passed for cascading selection, preset population, voltage warnings, preserving values on custom conversion, category selection, repeat addition, wattage override tracking and stale category reset. These checks used a temporary DOM harness without adding project dependencies.

Browser visual verification was unavailable: no browser binary was installed and the attempted download returned invalid archives. Do not interpret a successful bundle or DOM interaction test as a physical inverter test, visual QA, or verified real-world backup runtime.
