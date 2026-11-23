import { isValidHourFormat } from './TimeValue.mjs';

// LOGIC — per-section persisted selections. One bucket per section instance, so
// each section owns its own choices in state.json and never another's.
// Pure rules only: file I/O belongs to the Input window owner (screen.cjs).
// Transport shape is the sections map; the {schemaVersion, sections} wrapper is
// the file shape, validated by the file owner on read and built by collectInputState.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const name = (value) => typeof value === 'string' && /^[A-Za-z][\w.-]*$/.test(value);

// Each declared state key needs a validator; a selection that fails it is dropped,
// never silently coerced, so the configured default applies instead.
const selections = {
  language: (value, plan) => (typeof value === 'string' && Object.hasOwn(plan.layouts ?? {}, value) ? value : null),
  hourFormat: (value) => (isValidHourFormat(value) ? value : null),
};

export function applyInputState(sections, plan, diagnostics) {
  const report = (expected, actual, origin = {}) => diagnostics?.report?.({
    code: 'INPUT_STATE_INVALID', configPath: 'state.json', expected, actual,
    action: 'invalid persisted selection ignored; configured default applies', ...origin });
  if (sections === undefined || sections === null) return {};
  if (!object(sections) || Object.keys(sections).length > 64
    || Object.entries(sections).some(([id, bucket]) => !name(id) || !object(bucket) || Object.keys(bucket).length > 16)) {
    report('sections mapped to per-instance selection objects', sections);
    return {};
  }
  const applied = {};
  for (const node of plan?.sections ?? []) {
    const bucket = sections[node.id];
    if (!bucket) continue;
    const declared = node.stateKeys ?? [];
    if (Object.keys(bucket).some((key) => !declared.includes(key))) {
      report(`only declared state keys: ${declared.join(', ') || 'none'}`, Object.keys(bucket),
        { instanceId: node.id, componentId: node.componentId, filePath: node.filePath });
      continue;
    }
    for (const key of declared) {
      if (!Object.hasOwn(bucket, key)) continue;
      const value = selections[key]?.(bucket[key], plan);
      if (value === null || value === undefined) {
        report(`a valid ${key} selection`, bucket[key],
          { instanceId: node.id, componentId: node.componentId, filePath: node.filePath });
        continue;
      }
      applied[key] = value;
    }
  }
  return applied;
}

// LOGIC — build the file shape from live session state: only declared keys, only
// enabled sections, so a disabled or removed section leaves no stale bucket.
export function collectInputState(plan, sessionState) {
  const sections = {};
  for (const node of plan?.sections ?? []) {
    const bucket = {};
    for (const key of node.stateKeys ?? []) {
      if (sessionState?.[key] !== undefined) bucket[key] = sessionState[key];
    }
    if (Object.keys(bucket).length > 0) sections[node.id] = bucket;
  }
  return { schemaVersion: 1, sections };
}
