// LOGIC — validate complete discovery/config facts before producing mountable nodes.
import { rotationSettingsProblem, sizeSettingsProblem } from '../../logic/PhotoOperations.mjs';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => object(value) && Object.hasOwn(value, key);
const allowed = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));
const duplicateValues = (values) => new Set(values.filter((value, index) => values.indexOf(value) !== index));
const isId = (value) => typeof value === 'string' && /^[A-Za-z][\w.-]*$/.test(value);
const explicitColor = (value) => typeof value === 'string' && (value === 'transparent' || /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value));
const nonnegative = (value) => Number.isFinite(value) && value >= 0;
const percent = (value) => nonnegative(value) && value <= 100;
const borderStyles = ['none', 'solid', 'dashed', 'dotted', 'double'];
const alignment = ['center', 'flex-start', 'flex-end', 'stretch', 'space-between'];
const enumeration = (values) => [(value) => values.includes(value), values.join(' | ')];

function shadowValid(value) {
  if (value === 'none') return true;
  const fields = ['x', 'y', 'blur', 'spread', 'color', 'inset'];
  return allowed(value, fields) && fields.every((key) => own(value, key))
    && ['x', 'y', 'spread'].every((key) => Number.isFinite(value[key]))
    && nonnegative(value.blur) && explicitColor(value.color) && typeof value.inset === 'boolean';
}

function transitionValid(value) {
  if (value === 'none') return true;
  const properties = ['all', 'background-color', 'border-color', 'color', 'opacity', 'box-shadow', 'transform'];
  return allowed(value, ['properties', 'durationMs', 'easing'])
    && Array.isArray(value.properties) && value.properties.length > 0 && value.properties.every((property) => properties.includes(property))
    && nonnegative(value.durationMs) && ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(value.easing);
}

const groups = {
  colors: Object.fromEntries(['background', 'foreground', 'border', 'outline'].map((key) => [key, [explicitColor, 'explicit hex color or transparent']])),
  geometry: {
    paddingX: [percent, '0–100 parent-width percent'], paddingY: [percent, '0–100 parent-height percent'],
    gap: [percent, '0–100 parent-width percent'], radius: [nonnegative, 'non-negative pixels'],
    borderWidth: [nonnegative, 'non-negative pixels'], borderStyle: enumeration(borderStyles),
    outlineWidth: [nonnegative, 'non-negative pixels'], outlineStyle: enumeration(borderStyles),
    outlineOffset: [Number.isFinite, 'finite pixels'], iconWidth: [percent, '0–100 parent-width percent'],
    iconHeight: [percent, '0–100 parent-height percent'], fontSize: [(value) => Number.isFinite(value) && value > 0, 'positive pixels'],
    lineHeight: [(value) => Number.isFinite(value) && value > 0, 'positive line-height multiplier'],
    letterSpacing: [Number.isFinite, 'finite pixels'], opacity: [(value) => nonnegative(value) && value <= 1, '0–1'],
    shadow: [shadowValid, 'none or {x,y,blur,spread,color,inset}'],
    transition: [transitionValid, 'none or {properties,durationMs,easing}'],
  },
  typography: {
    family: [(value) => typeof value === 'string' && value.trim().length > 0, 'nonempty font family'],
    weight: [(value) => Number.isFinite(value) && value >= 1 && value <= 1000, 'font weight 1–1000'],
  },
  content: {
    direction: enumeration(['row', 'column']), verticalAlign: enumeration(alignment), horizontalAlign: enumeration(alignment),
    textAlign: enumeration(['center', 'left', 'right']), whiteSpace: enumeration(['nowrap', 'normal']),
    overflow: enumeration(['hidden', 'visible', 'auto']), wrap: enumeration(['nowrap', 'wrap']),
  },
};
const groupKeys = Object.keys(groups);
const stateKeys = ['hover', 'focusVisible', 'active', 'disabled', 'selected', 'error'];
const visualKeys = ['preset', ...groupKeys, 'states'];
const sectionKeys = ['id', 'parentId', 'label', 'folder', 'enabled', 'nativeSafeArea', 'draggable', 'sizing', 'bounds', ...visualKeys];
const instanceKeys = ['id', 'componentId', 'parentId', 'enabled', 'label', 'bounds', 'aspectRatio', 'parts', 'interaction', ...visualKeys];

function boundsProblem(bounds, path) {
  if (!object(bounds)) return { path, expected: 'parent-relative bounds object', actual: bounds };
  for (const key of Object.keys(bounds)) {
    if (!['x', 'y', 'width', 'height'].includes(key)) return { path: `${path}.${key}`, expected: 'supported bounds property', actual: bounds[key] };
  }
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!percent(bounds[key]) || (['width', 'height'].includes(key) && bounds[key] === 0)) return { path: `${path}.${key}`, expected: 'valid parent percentage; dimensions must be positive', actual: bounds[key] };
  }
  if (bounds.x + bounds.width > 100.00001 || bounds.y + bounds.height > 100.00001) return { path, expected: 'bounds contained in parent', actual: bounds };
  return null;
}

export const boundsValid = (bounds) => boundsProblem(bounds, 'bounds') === null;

export function outputSettingsValid(output) {
  const dimensions = (value) => allowed(value, ['width', 'height']) && Number.isInteger(value.width) && value.width > 0 && Number.isInteger(value.height) && value.height > 0;
  return allowed(output, ['frame', 'exports', 'defaultWidth', 'previewMaxEdge', 'jpegQuality', 'matte'])
    && dimensions(output.frame) && Array.isArray(output.exports) && output.exports.length > 0
    && output.exports.every((size) => dimensions(size) && size.width * output.frame.height === size.height * output.frame.width)
    && new Set(output.exports.map((size) => size.width)).size === output.exports.length
    && output.exports.some((size) => size.width === output.defaultWidth)
    && Number.isInteger(output.previewMaxEdge) && output.previewMaxEdge > 0
    && Number.isInteger(output.jpegQuality) && output.jpegQuality >= 1 && output.jpegQuality <= 100
    && Array.isArray(output.matte) && output.matte.length === 3 && output.matte.every((value) => value === 0);
}

// Shared desktop/renderer native settings check; no invented alternate window.
export function nativeWindowValid(window) {
  const caption = window?.caption;
  const captionValid = caption?.mode === 'custom'
    ? allowed(caption, ['mode'])
    : caption?.mode === 'native' && allowed(caption, ['mode', 'height', 'background', 'foreground'])
      && Number.isInteger(caption.height) && caption.height > 0 && caption.height < window.minHeight
      && explicitColor(caption.background) && explicitColor(caption.foreground);
  return allowed(window, ['title', 'width', 'height', 'minWidth', 'minHeight', 'background', 'caption'])
    && typeof window.title === 'string' && window.title.trim().length > 0
    && ['width', 'height', 'minWidth', 'minHeight'].every((key) => Number.isInteger(window[key]) && window[key] > 0)
    && window.minWidth <= window.width && window.minHeight <= window.height && explicitColor(window.background)
    && Boolean(captionValid);
}

function mergeGroups(base, patch) {
  return Object.fromEntries(groupKeys.map((key) => [key, { ...base[key], ...patch[key] }]));
}

function mergeVisual(base, patch) {
  const result = { ...mergeGroups(base, patch), states: { ...base.states } };
  for (const [name, state] of Object.entries(patch.states ?? {})) result.states[name] = mergeGroups(base.states?.[name] ?? {}, state);
  return result;
}

export function validateFrameConfig(raw, catalog, diagnostics) {
  const report = (code, path, expected, actual, meta = {}) => diagnostics.report({ code, configPath: path, expected, actual, ...meta });
  const result = { sections: [], instances: [], development: null, window: null, document: null, history: null, output: null, rotation: null, size: null };

  function checkKeys(value, keys, path, meta, code = 'INVALID_VISUAL') {
    if (!object(value)) { report(code, path, 'object', value, meta); return false; }
    let valid = true;
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) { report(code, `${path}.${key}`, 'supported property', value[key], meta); valid = false; }
    }
    return valid;
  }

  function checkBounds(bounds, path, meta, code) {
    const problem = boundsProblem(bounds, path);
    if (!problem) return true;
    report(code, problem.path, problem.expected, problem.actual, meta);
    return false;
  }

  function checkPatch(patch, path, meta) {
    let valid = checkKeys(patch, groupKeys, path, meta);
    if (!object(patch)) return false;
    for (const group of groupKeys) {
      if (!own(patch, group)) continue;
      const values = patch[group];
      if (!checkKeys(values, Object.keys(groups[group]), `${path}.${group}`, meta)) { valid = false; if (!object(values)) continue; }
      for (const [key, value] of Object.entries(values)) {
        const rule = groups[group][key];
        if (rule && !rule[0](value)) { report('INVALID_VISUAL', `${path}.${group}.${key}`, rule[1], value, meta); valid = false; }
      }
    }
    return valid;
  }

  function checkAxes(visual, path, meta) {
    const { direction, horizontalAlign, verticalAlign } = visual.content;
    const cross = direction === 'row' ? 'verticalAlign' : 'horizontalAlign';
    const main = direction === 'row' ? 'horizontalAlign' : 'verticalAlign';
    if (visual.content[cross] === 'space-between' || visual.content[main] === 'stretch') {
      report('INVALID_VISUAL', `${path}.content`, 'physical alignment supported on the configured flex axes', { direction, horizontalAlign, verticalAlign }, meta);
      return false;
    }
    return true;
  }

  function completeVisual(visual, path, meta) {
    let valid = true;
    for (const group of groupKeys) {
      for (const [key, rule] of Object.entries(groups[group])) {
        if (!own(visual[group], key)) { report('INCOMPLETE_VISUAL', `${path}.${group}.${key}`, rule[1], undefined, meta); valid = false; }
      }
    }
    if (!valid) return false;
    valid = checkAxes(visual, path, meta);
    for (const [state, patch] of Object.entries(visual.states)) valid = checkAxes(mergeVisual(visual, patch), `${path}.states.${state}`, meta) && valid;
    return valid;
  }

  if (!checkKeys(raw, ['schemaVersion', 'window', 'document', 'history', 'output', 'rotation', 'size', 'presets', 'sections', 'instances', 'development'], 'config', { action: 'layout isolated' }, 'INVALID_CONFIG_ROOT') || raw.schemaVersion !== 1) {
    if (object(raw) && raw.schemaVersion !== 1) report('INVALID_CONFIG_ROOT', 'schemaVersion', 1, raw.schemaVersion, { action: 'layout isolated' });
    return result;
  }
  if (nativeWindowValid(raw.window)) result.window = raw.window;
  else report('INVALID_WINDOW_CONFIG', 'window', 'valid native settings', raw.window, { action: 'native settings unavailable' });
  if (allowed(raw.document, ['scale', 'x', 'y', 'rotation']) && ['scale', 'x', 'y', 'rotation'].every((key) => Number.isFinite(raw.document[key])) && raw.document.scale > 0) result.document = raw.document;
  else report('INVALID_DOCUMENT', 'document', 'finite photo transform with positive scale', raw.document, { action: 'save unavailable until a valid photo document is loaded' });
  if (allowed(raw.history, ['limit']) && Number.isInteger(raw.history.limit) && raw.history.limit > 0) result.history = raw.history;
  else report('INVALID_HISTORY_CONFIG', 'history', 'positive integer history limit', raw.history, { action: 'undo/redo tracking unavailable; other controls preserved' });
  if (outputSettingsValid(raw.output)) result.output = raw.output;
  else report('INVALID_OUTPUT_SETTINGS', 'output', 'consistent frame/export/preview settings and black matte', raw.output, { action: 'file actions unavailable' });
  if (own(raw, 'rotation')) {
    const problem = rotationSettingsProblem(raw.rotation);
    if (!problem) result.rotation = raw.rotation;
    else report('INVALID_ROTATION_SETTINGS', `rotation${problem.property ? `.${problem.property}` : ''}`, problem.expected, problem.actual, { action: 'rotation controls unavailable; other controls preserved' });
  }
  if (own(raw, 'size')) {
    const problem = sizeSettingsProblem(raw.size);
    if (!problem) result.size = raw.size;
    else report('INVALID_SIZE_SETTINGS', `size${problem.property ? `.${problem.property}` : ''}`, problem.expected, problem.actual, { action: 'size controls unavailable; other controls preserved' });
  }

  // Each preset has one explicit resolution state. Failure never means “try again”.
  const presetStatus = new Map();
  const presets = new Map();
  const presetDefinitions = object(raw.presets) ? raw.presets : {};
  if (!object(raw.presets)) report('INVALID_PRESET', 'presets', 'named preset definitions', raw.presets);

  function resolvePreset(name, edgePath) {
    const status = presetStatus.get(name);
    if (status === 'resolved') return presets.get(name);
    if (status === 'invalid') return null;
    if (status === 'visiting') {
      report('PRESET_CYCLE', edgePath, 'acyclic preset inheritance', name, { action: 'dependent nodes skipped' });
      return null;
    }
    if (!isId(name) || !own(presetDefinitions, name)) {
      report('INVALID_PRESET', edgePath, 'existing named preset', name, { action: 'dependent nodes skipped' });
      presetStatus.set(name, 'invalid');
      return null;
    }
    presetStatus.set(name, 'visiting');
    const definition = presetDefinitions[name];
    const path = `presets.${name}`;
    const value = checkKeys(definition, visualKeys, path, { action: 'dependent nodes skipped' }, 'UNSUPPORTED_PRESET_PROPERTY')
      ? resolveVisual(definition, path, {}, false) : null;
    presetStatus.set(name, value ? 'resolved' : 'invalid');
    presets.set(name, value);
    return value;
  }

  function resolveVisual(node, path, meta = {}, complete = true) {
    if (!object(node)) { report('INVALID_VISUAL', path, 'configured visual object', node, meta); return null; }
    const patch = Object.fromEntries(groupKeys.filter((key) => own(node, key)).map((key) => [key, node[key]]));
    let valid = checkPatch(patch, path, meta);
    if (own(node, 'states')) {
      if (!checkKeys(node.states, stateKeys, `${path}.states`, meta)) valid = false;
      if (object(node.states)) {
        patch.states = node.states;
        for (const [state, statePatch] of Object.entries(node.states)) valid = checkPatch(statePatch, `${path}.states.${state}`, meta) && valid;
      }
    }
    if (!valid) return null;
    let base = {};
    if (own(node, 'preset')) {
      base = resolvePreset(node.preset, `${path}.preset`);
      if (!base) { report('UNRESOLVED_PRESET', `${path}.preset`, 'valid resolved preset', node.preset, meta); return null; }
    }
    const visual = mergeVisual(base, patch);
    return !complete || completeVisual(visual, path, meta) ? visual : null;
  }

  for (const name of Object.keys(presetDefinitions)) resolvePreset(name, `presets.${name}`);
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  const instances = Array.isArray(raw.instances) ? raw.instances : [];
  if (!Array.isArray(raw.sections)) report('INVALID_NODE_LIST', 'sections', 'section array', raw.sections);
  if (!Array.isArray(raw.instances)) report('INVALID_NODE_LIST', 'instances', 'instance array', raw.instances);
  const duplicateIds = duplicateValues([...sections, ...instances].map((node) => node?.id));
  const duplicateFolders = duplicateValues(sections.map((node) => node?.folder));
  const duplicateComponents = duplicateValues(catalog.map((node) => node.componentId));
  const byComponent = new Map();
  for (const entry of catalog) {
    if (duplicateComponents.has(entry.componentId)) report('DUPLICATE_COMPONENT_ID', null, 'one file per component ID', entry.componentId, { componentId: entry.componentId, filePath: entry.filePath });
    else byComponent.set(entry.componentId, entry);
  }

  sections.forEach((node, index) => {
    const path = `sections[${index}]`;
    const meta = { sectionId: node?.id, action: 'section subtree skipped' };
    if (!checkKeys(node, sectionKeys, path, meta, 'INVALID_SECTION')) return;
    if (!isId(node.id) || node.parentId !== 'window' || typeof node.enabled !== 'boolean'
      || typeof node.draggable !== 'boolean' || typeof node.nativeSafeArea !== 'boolean'
      || typeof node.label !== 'string' || !/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(node.folder)) {
      report('INVALID_SECTION', path, 'valid section identity, folder and flags', node, meta); return;
    }
    if (!checkBounds(node.bounds, `${path}.bounds`, meta, 'INVALID_SECTION')) return;
    if (own(node, 'sizing') && !['content', 'remaining'].includes(node.sizing)) {
      report('INVALID_SECTION', `${path}.sizing`, 'content | remaining; omit for fixed percentage height', node.sizing, meta); return;
    }
    if (duplicateIds.has(node.id) || duplicateFolders.has(node.folder)) { report('DUPLICATE_SECTION', path, 'unique section ID/folder', node.id, meta); return; }
    const visual = resolveVisual(node, path, meta);
    if (visual && node.enabled) result.sections.push({ ...node, ...visual, configPath: path });
  });

  // Symmetric isolation: every conflicting sibling is blocked, never first/last wins.
  const overlaps = new Set();
  for (let i = 0; i < result.sections.length; i++) {
    for (let j = i + 1; j < result.sections.length; j++) {
      const a = result.sections[i], b = result.sections[j];
      const x = Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width) - Math.max(a.bounds.x, b.bounds.x);
      const y = Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height) - Math.max(a.bounds.y, b.bounds.y);
      if (x <= 0.00001 || y <= 0.00001) continue;
      for (const [node, other] of [[a, b], [b, a]]) {
        overlaps.add(node.id);
        report('SECTION_OVERLAP', `${node.configPath}.bounds`, 'non-overlapping sibling section', { with: other.id, bounds: node.bounds }, { sectionId: node.id, action: 'section subtree skipped' });
      }
    }
  }
  result.sections = result.sections.filter((node) => !overlaps.has(node.id));

  instances.forEach((node, index) => {
    const path = `instances[${index}]`;
    const entry = byComponent.get(node?.componentId);
    const meta = { instanceId: node?.id, componentId: node?.componentId, parentId: node?.parentId, filePath: entry?.filePath };
    // Without an implementation, custom fields have no authoritative schema.
    // Validate common fields; diagnose a missing enabled component, not guessed options.
    const keys = entry ? [...instanceKeys, ...(entry.configKeys ?? [])] : object(node) ? Object.keys(node) : instanceKeys;
    if (!checkKeys(node, keys, path, meta, 'INVALID_INSTANCE')) return;
    if (!isId(node.id) || !isId(node.componentId) || !isId(node.parentId) || typeof node.enabled !== 'boolean' || typeof node.label !== 'string' || !node.label.trim()) {
      report('INVALID_INSTANCE', path, 'valid instance identity, label and enabling', node, meta); return;
    }
    if (!checkBounds(node.bounds, `${path}.bounds`, meta, 'INVALID_INSTANCE')) return;
    if (own(node, 'aspectRatio') && (!Number.isFinite(node.aspectRatio) || node.aspectRatio <= 0)) {
      report('INVALID_INSTANCE', `${path}.aspectRatio`, 'positive finite width/height ratio', node.aspectRatio, meta); return;
    }
    if (own(node, 'interaction')) {
      if (!checkKeys(node.interaction, ['pointerEvents', 'dragRegion'], `${path}.interaction`, meta, 'INVALID_INTERACTION')) return;
      let valid = true;
      for (const [key, values] of Object.entries({ pointerEvents: ['auto', 'none'], dragRegion: ['drag', 'no-drag', 'inherit'] })) {
        if (!values.includes(node.interaction[key])) { report('INVALID_INTERACTION', `${path}.interaction.${key}`, values.join(' | '), node.interaction[key], meta); valid = false; }
      }
      if (!valid) return;
    }
    if (duplicateIds.has(node.id)) { report('DUPLICATE_INSTANCE_ID', `${path}.id`, 'unique instance ID', node.id, meta); return; }
    const visual = resolveVisual(node, path, meta);
    if (!visual) return;
    const parts = {};
    if (entry) {
      const names = entry.partKeys ?? [];
      if (names.length || own(node, 'parts')) {
        if (!checkKeys(node.parts, names, `${path}.parts`, meta, 'INVALID_PART')) return;
        for (const name of names) {
          const partPath = `${path}.parts.${name}`, part = node.parts[name];
          if (!checkKeys(part, [...visualKeys, 'bounds', 'size', 'aspectRatio', 'surfaceWidth', 'surfacePadding'], partPath, meta, 'INVALID_PART')) return;
          if (own(part, 'aspectRatio') && (!Number.isFinite(part.aspectRatio) || part.aspectRatio <= 0)) {
            report('INVALID_PART', `${partPath}.aspectRatio`, 'positive finite width/height ratio', part.aspectRatio, meta); return;
          }
          if (own(part, 'bounds') && !checkBounds(part.bounds, `${partPath}.bounds`, meta, 'INVALID_PART')) return;
          if (own(part, 'size')) {
            if (!checkKeys(part.size, ['width', 'height'], `${partPath}.size`, meta, 'INVALID_PART')) return;
            for (const axis of ['width', 'height']) if (!percent(part.size[axis]) || part.size[axis] === 0) {
              report('INVALID_PART', `${partPath}.size.${axis}`, 'positive immediate-parent percentage', part.size[axis], meta); return;
            }
          }
          if (own(part, 'surfaceWidth') && (typeof part.surfaceWidth !== 'string' || !part.surfaceWidth.trim())) {
            report('INVALID_PART', `${partPath}.surfaceWidth`, 'nonempty CSS width for a popup surface', part.surfaceWidth, meta); return;
          }
          if (own(part, 'surfacePadding') && (typeof part.surfacePadding !== 'string' || !part.surfacePadding.trim())) {
            report('INVALID_PART', `${partPath}.surfacePadding`, 'nonempty CSS padding for a popup surface', part.surfacePadding, meta); return;
          }
          const resolved = resolveVisual(part, partPath, meta);
          if (!resolved) return;
          parts[name] = { ...part, ...resolved };
        }
      }
    }
    const configuredParent = sections.find((section) => section?.id === node.parentId);
    if (!configuredParent) { report('UNKNOWN_PARENT', `${path}.parentId`, 'configured section ID', node.parentId, meta); return; }
    if (duplicateComponents.has(node.componentId)) return;
    if (entry?.validateConfig) {
      try {
        if (entry.validateConfig({ ...node, ...visual, parts }, (property, expected, actual) => report('INVALID_COMPONENT_CONFIG', `${path}.${property}`, expected, actual, meta)) !== true) return;
      } catch (error) { report('COMPONENT_CONFIG_FAILED', path, 'valid component-owned config contract', error.message, meta); return; }
    }
    if (entry && entry.folder !== configuredParent.folder) { report('FOLDER_PARENT_MISMATCH', `${path}.parentId`, configuredParent.folder, entry.folder, meta); return; }
    if (!node.enabled || configuredParent.enabled === false) return;
    const section = result.sections.find((parent) => parent.id === node.parentId);
    if (!section) return;
    if (!entry) { report('MISSING_COMPONENT', `${path}.componentId`, `component in ${section.folder}/`, node.componentId, meta); return; }
    for (const capability of entry.requires ?? []) if (!Object.hasOwn(result, capability) || result[capability] === null) {
      report('MISSING_CAPABILITY', path, `valid ${capability} settings`, null, { ...meta, action: 'dependent control skipped; other controls preserved' }); return;
    }
    result.instances.push({ ...node, ...visual, parts, ...entry, configPath: path });
  });
  const referenced = new Set(instances.map((node) => node?.componentId));
  for (const entry of catalog) if (!referenced.has(entry.componentId)) report('COMPONENT_WITHOUT_CONFIG', null, 'configured or intentionally disabled instance', null, entry);

  function auxiliary(node, path, needsBounds, action) {
    const meta = { action };
    if (!checkKeys(node, [...visualKeys, ...(needsBounds ? ['bounds'] : [])], path, meta)) return null;
    if (needsBounds && !checkBounds(node.bounds, `${path}.bounds`, meta, 'INVALID_VISUAL')) return null;
    const visual = resolveVisual(node, path, meta);
    return visual ? { ...node, ...visual } : null;
  }

  const dev = raw.development;
  if (checkKeys(dev, ['inspectionEnabled', 'inspector', 'label', 'summary'], 'development', { action: 'inspection unavailable' }, 'INVALID_INSPECTION_CONFIG')) {
    if (typeof dev.inspectionEnabled !== 'boolean') report('INVALID_INSPECTION_CONFIG', 'development.inspectionEnabled', 'boolean', dev.inspectionEnabled, { action: 'inspection unavailable' });
    const inspector = auxiliary(dev.inspector, 'development.inspector', false, 'inspection unavailable');
    const label = auxiliary(dev.label, 'development.label', true, 'inspection unavailable');
    const summary = auxiliary(dev.summary, 'development.summary', true, 'inspection unavailable');
    if (typeof dev.inspectionEnabled === 'boolean' && inspector && label && summary) result.development = { ...dev, inspector, label, summary };
  }
  return result;
}
