import { readFileSync } from 'node:fs';
import { InputError } from './model.js';
import { selectInverter, applianceDefaults, compatibilityWarnings } from '../../shared/power.js';
const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
export const inverters = read('inverter-catalogue');
export const specifications = read('appliance-specifications');
export const sources = read('data-sources');

// O(n). Resolve trusted technical fields from the server catalogue; battery Ah stays user supplied.
export function resolveSetup(setup) {
  if (!setup?.inverterId) return setup;
  const model = inverters.models.find((m) => m.id === setup.inverterId);
  if (!model) throw new InputError('Unknown inverter ID. Select a listed model or use custom configuration.');
  // Preserve actual battery voltage so mismatches are detected, not silently corrected.
  return { ...selectInverter(setup, model), batteryV: setup.batteryV };
}

// O(n). Warnings are included in plans, alongside live client warnings.
export function setupWarnings(setup) {
  return compatibilityWarnings(setup, inverters.models.find((m) => m.id === setup.inverterId));
}

// O(n). Insert mapped defaults into the existing AVL catalogue without editing its JSON file.
export function algorithmCatalogue() {
  return specifications.items.map(applianceDefaults);
}
