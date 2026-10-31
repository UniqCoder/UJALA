// Shared by the API algorithms and live browser indicators.
export const DOD = { flat: 0.5, tubular: 0.7, lithium: 0.9 };

// O(1). A documented running watt rating takes precedence over estimated VA × PF.
export function capacities(s) {
  const health = s.health > 1 ? s.health / 100 : (s.health ?? 1);
  const maxW = s.ratedOutputW ?? s.inverterVA * (s.powerFactor ?? 0.8);
  return {
    maxW,
    peakW: maxW * (s.surgeTolerance ?? 1.5),
    usableWh: s.batteryAh * s.batteryV * (DOD[s.batteryType] ?? 0.7) * health * (s.efficiency ?? 0.85),
  };
}

// O(1). Only explicit model selection applies inverter defaults; never assumes battery Ah.
export function selectInverter(setup, model) {
  return { ...setup, inverterId: model.id, inverterVA: model.vaRating,
    ratedOutputW: model.ratedOutputW, batteryV: model.batterySystemV,
    powerFactor: model.powerFactor ?? setup.powerFactor,
    efficiency: model.efficiency ?? setup.efficiency };
}

// O(1). Map specification records to the unchanged algorithm input contract.
export function applianceDefaults(item) {
  return { specificationId: item.id, name: item.name, category: item.category,
    watts: item.ratedOperatingW, surgeFactor: item.surgeFactor,
    dutyCycle: item.dutyCycle, room: item.room, classification: item.classification,
    sourceUrl: item.sourceUrl, sourceNotes: item.notes, wattsOverridden: false };
}

// O(1). Preserve the source reference while clearly marking a user wattage override.
export function editAppliance(item, patch) {
  return { ...item, ...patch, wattsOverridden: item.wattsOverridden ||
    (Object.hasOwn(patch, 'watts') && patch.watts !== item.watts) };
}

// O(k), k = documented battery types. Unknown is always reported, never confirmed.
export function compatibilityWarnings(s, model) {
  if (!model) return ['Custom inverter: battery compatibility has not been manufacturer-verified.'];
  const warnings = [];
  if (s.batteryV !== model.batterySystemV) warnings.push(`Battery bank voltage mismatch: this inverter requires ${model.batterySystemV} V, selected ${s.batteryV} V.`);
  if (!model.supportedBatteryTypes?.length) warnings.push('Battery chemistry compatibility is unknown; check the inverter manual.');
  else if (!model.supportedBatteryTypes.includes(s.batteryType)) warnings.push(`Selected ${s.batteryType} battery is not listed as supported by this model; do not assume compatibility.`);
  if (model.minBatteryAh == null || model.maxBatteryAh == null) warnings.push('Supported battery Ah range is undocumented; confirm it with the manufacturer.');
  if (model.minBatteryAh != null && s.batteryAh < model.minBatteryAh) warnings.push(`Battery capacity is below the supported minimum of ${model.minBatteryAh} Ah.`);
  if (model.maxBatteryAh != null && s.batteryAh > model.maxBatteryAh) warnings.push(`Battery capacity exceeds the supported maximum of ${model.maxBatteryAh} Ah.`);
  return warnings;
}
