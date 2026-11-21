// LOGIC — discover first, validate the complete catalog/config, mount valid results second.
const name = (value) => typeof value === 'string' && /^[A-Za-z][\w.-]*$/.test(value);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const percent = (value) => Number.isFinite(value) && value > 0 && value <= 100;
const color = (value) => typeof value === 'string' && /^(#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|transparent|currentColor)$/i.test(value);
const geometryKeys = ['paddingX', 'paddingY', 'gap', 'radius', 'borderWidth', 'borderStyle', 'outlineWidth', 'outlineStyle', 'outlineOffset', 'fontSize', 'lineHeight', 'letterSpacing', 'opacity', 'shadow', 'transition'];
const contentKeys = ['direction', 'verticalAlign', 'horizontalAlign', 'textAlign', 'whiteSpace', 'overflow', 'wrap', 'overflowWrap'];

export function mergeConfig(left, right) {
  const result = { ...left };
  for (const [key, value] of Object.entries(right ?? {})) result[key] = object(value) && object(result[key])
    ? mergeConfig(result[key], value) : structuredClone(value);
  return result;
}

export function validateInputConfig(raw, catalog, diagnostics) {
  const report = (code, path, expected, actual, origin = {}) => diagnostics.report({ code, configPath: path, expected, actual, ...origin,
    action: 'invalid Input entry skipped; valid sections retained' });
  const cache = new Map();
  const preset = (id, chain = []) => {
    if (cache.has(id)) return cache.get(id);
    if (chain.includes(id)) { report('INPUT_PRESET_CYCLE', `presets.${id}`, 'acyclic preset references', [...chain, id]); return null; }
    const source = raw?.presets?.[id];
    if (!object(source)) { report('INPUT_PRESET_MISSING', `presets.${id}`, 'defined preset', source); return null; }
    if (Object.keys(source).some((key) => !['preset', 'colors', 'geometry', 'typography', 'content', 'states', 'bounds', 'parts', 'animation', 'name', 'rotation', 'portal', 'zIndex'].includes(key))) {
      report('INPUT_PRESET_INVALID', `presets.${id}`, 'supported preset properties', Object.keys(source)); cache.set(id, null); return null;
    }
    const parent = source.preset === undefined ? {} : preset(source.preset, [...chain, id]);
    const result = parent === null ? null : mergeConfig(parent, source);
    cache.set(id, result);
    return result;
  };
  const visual = (source, path, origin = {}) => {
    if (!object(source)) { report('INPUT_VISUAL_INVALID', path, 'configured appearance', source, origin); return null; }
    const parent = source.preset === undefined ? {} : preset(source.preset);
    if (parent === null) return null;
    const node = mergeConfig(parent, source);
    let valid = true;
    const check = (ok, suffix, expected, actual) => { if (!ok) { valid = false; report('INPUT_VISUAL_INVALID', `${path}.${suffix}`, expected, actual, origin); } };
    check(object(node.colors) && ['background', 'foreground', 'border', 'outline'].every((key) => color(node.colors[key]))
      && Object.keys(node.colors).every((key) => ['background', 'foreground', 'border', 'outline'].includes(key)), 'colors', 'explicit supported colors', node.colors);
    const g = node.geometry;
    check(object(g) && geometryKeys.every((key) => Object.hasOwn(g, key)) && Object.keys(g).every((key) => geometryKeys.includes(key)), 'geometry', 'complete supported geometry', g);
    if (object(g)) {
      check(['paddingX', 'paddingY', 'gap', 'radius', 'borderWidth', 'outlineWidth', 'fontSize', 'lineHeight'].every((key) => Number.isFinite(g[key]) && g[key] >= 0)
        && g.fontSize > 0 && g.lineHeight > 0 && g.paddingX < 50 && g.paddingY < 50, 'geometry.values', 'positive font/line-height and contained finite geometry', g);
      check(Number.isFinite(g.outlineOffset) && Number.isFinite(g.letterSpacing) && Number.isFinite(g.opacity) && g.opacity >= 0 && g.opacity <= 1, 'geometry.units', 'finite pixel units and opacity 0–1', g);
      check(['solid', 'dashed', 'dotted', 'none'].includes(g.borderStyle) && ['solid', 'dashed', 'dotted', 'none'].includes(g.outlineStyle)
        && g.shadow === 'none' && g.transition === 'none', 'geometry.effects', 'supported border/outline styles; explicit none for shadow/transition', g);
    }
    check(object(node.typography) && Object.keys(node.typography).every((key) => ['family', 'weight'].includes(key)) && typeof node.typography.family === 'string' && node.typography.family.trim()
      && Number.isFinite(node.typography.weight) && node.typography.weight >= 100 && node.typography.weight <= 900, 'typography', 'explicit family and weight', node.typography);
    const c = node.content;
    check(object(c) && contentKeys.every((key) => Object.hasOwn(c, key)) && Object.keys(c).every((key) => contentKeys.includes(key)), 'content', 'complete content alignment', c);
    if (object(c)) check(['row', 'column'].includes(c.direction) && ['flex-start', 'flex-end', 'center', 'stretch', 'space-between', 'space-around', 'space-evenly'].includes(c.verticalAlign)
      && ['flex-start', 'flex-end', 'center', 'stretch', 'space-between', 'space-around', 'space-evenly'].includes(c.horizontalAlign)
      && ['left', 'right', 'center', 'start', 'end'].includes(c.textAlign) && ['normal', 'nowrap', 'pre-wrap'].includes(c.whiteSpace)
      && ['hidden', 'visible', 'auto', 'clip'].includes(c.overflow) && ['nowrap', 'wrap'].includes(c.wrap)
      && ['normal', 'anywhere', 'break-word'].includes(c.overflowWrap), 'content.values', 'supported flex/text values', c);
    check(object(node.states) && Object.keys(node.states).every((key) => ['hover', 'active', 'focusVisible', 'disabled', 'selected', 'error'].includes(key)), 'states', 'supported visual states', node.states);
    if (object(node.states)) for (const [state, patch] of Object.entries(node.states)) {
      check(object(patch) && Object.keys(patch).every((key) => ['colors', 'geometry', 'typography', 'content'].includes(key)), `states.${state}`, 'appearance patches only', patch);
      if (object(patch)) {
        const { parts, preset: _preset, ...base } = node;
        const effective = mergeConfig(base, patch);
        effective.states = {};
        if (!visual(effective, `${path}.states.${state}`, origin)) valid = false;
      }
    }
    if (node.parts !== undefined) {
      check(object(node.parts), 'parts', 'named part configuration', node.parts);
      if (object(node.parts)) for (const [part, value] of Object.entries(node.parts)) {
        const resolved = visual(value, `${path}.parts.${part}`, origin);
        if (!resolved) valid = false;
        else node.parts[part] = resolved;
      }
    }
    return valid ? node : null;
  };

  const root = visual(raw?.root, 'root');
  if (!name(root?.id)) report('INPUT_ROOT_INVALID', 'root.id', 'stable root ID', root?.id);
  const outlet = visual(raw?.diagnostics, 'diagnostics');
  if (outlet && !percent(outlet.height)) { report('INPUT_DIAGNOSTIC_INVALID', 'diagnostics.height', 'positive root-relative height', outlet.height); }
  const inspector = visual(raw?.development?.inspector, 'development.inspector');
  const entries = Array.isArray(raw?.sections) ? raw.sections : [];
  if (!Array.isArray(raw?.sections)) report('INPUT_SECTIONS_INVALID', 'sections', 'section array', raw?.sections);
  const counts = (items, key) => items.reduce((map, item) => map.set(item?.[key], (map.get(item?.[key]) ?? 0) + 1), new Map());
  const componentCounts = counts(catalog, 'componentId'), instanceCounts = counts(entries, 'id');
  for (const entry of catalog) {
    if (componentCounts.get(entry.componentId) > 1) report('INPUT_DUPLICATE_COMPONENT', 'catalog', 'unique component ID', entry.componentId, entry);
    if (!entries.some((node) => node?.componentId === entry.componentId)) report('INPUT_COMPONENT_UNCONFIGURED', 'sections', 'configured discovered component', entry.componentId, entry);
  }
  const base = [];
  for (const [index, source] of entries.entries()) {
    const path = `sections[${index}]`, origin = { componentId: source?.componentId, instanceId: source?.id, parentId: source?.parentId };
    if (instanceCounts.get(source?.id) > 1) { report('INPUT_DUPLICATE_INSTANCE', `${path}.id`, 'unique instance ID', source?.id, origin); continue; }
    if (!object(source) || !name(source.id) || source.id === root?.id || !name(source.componentId) || source.parentId !== root?.id
      || typeof source.folder !== 'string' || !source.folder || typeof source.enabled !== 'boolean' || typeof source.expanded !== 'boolean'
      || !percent(source.bounds?.width) || !percent(source.bounds?.height)) { report('INPUT_SECTION_INVALID', path, 'valid identity/parent/folder/enabling/bounds', source, origin); continue; }
    const matches = catalog.filter((entry) => entry.componentId === source.componentId);
    if (matches.length > 1) continue;
    const entry = matches[0];
    if (entry && entry.folder !== source.folder) { report('INPUT_FOLDER_MISMATCH', `${path}.folder`, source.folder, entry.folder, { ...origin, filePath: entry.filePath }); continue; }
    const node = visual(source, path, { ...origin, filePath: entry?.filePath });
    if (!node) continue;
    if (entry?.validateConfig && !entry.validateConfig(node, (suffix, expected, actual) => report('INPUT_SECTION_OPTIONS_INVALID', `${path}.${suffix}`, expected, actual, { ...origin, filePath: entry.filePath }))) continue;
    if (!source.enabled) continue;
    if (!entry) { report('INPUT_COMPONENT_MISSING', path, 'discovered component in assigned folder', source.componentId, origin); continue; }
    base.push({ ...node, Component: entry.Component, validateConfig: entry.validateConfig, filePath: entry.filePath, configPath: path });
  }
  const layouts = {};
  const identities = new Set(entries.filter((entry) => name(entry?.id)).map((entry) => entry.id));
  const languages = Array.isArray(raw?.languages) ? raw.languages : [];
  const languageCounts = counts(languages, 'id');
  for (const language of languages) {
    const source = raw?.layouts?.[language?.id], path = `layouts.${language?.id}`;
    if (!name(language?.id) || languageCounts.get(language.id) !== 1 || typeof language.label !== 'string' || !language.label.trim()
      || !object(source) || !Number.isFinite(source.gapY) || source.gapY < 0 || source.gapY > 100
      || !Array.isArray(source.order) || source.order.length !== identities.size || new Set(source.order).size !== identities.size
      || source.order.some((id) => !entries.some((entry) => entry?.id === id)) || !object(source.sections)) {
      report('INPUT_LOCALE_INVALID', path, 'independent ordered locale layout', source); continue;
    }
    const sections = [];
    for (const id of source.order) {
      const original = base.find((node) => node.id === id);
      if (!original) continue;
      const override = source.sections[id], origin = { componentId: original.componentId, instanceId: id, parentId: root?.id, filePath: original.filePath };
      if (!object(override) || typeof override.label !== 'string' || !override.label.trim()
        || Object.keys(override).some((key) => !['label', 'bounds', 'colors', 'geometry', 'typography', 'content', 'states', 'parts', 'animation'].includes(key))) {
        report('INPUT_LOCALE_SECTION_INVALID', `${path}.sections.${id}`, 'label/placement/appearance only; identity remains stable', override, origin); continue;
      }
      const { Component, validateConfig, ...data } = original;
      const node = visual(mergeConfig(data, override), `${path}.sections.${id}`, origin);
      if (!node || !percent(node.bounds?.width) || !percent(node.bounds?.height)) continue;
      if (validateConfig && !validateConfig(node, (suffix, expected, actual) => report('INPUT_SECTION_OPTIONS_INVALID', `${path}.sections.${id}.${suffix}`, expected, actual, origin))) continue;
      sections.push({ ...node, Component });
    }
    layouts[language.id] = { gapY: source.gapY, sections };
  }
  const initialLanguage = layouts[raw?.initialLanguage] ? raw.initialLanguage : null;
  if (!initialLanguage) report('INPUT_INITIAL_LANGUAGE_INVALID', 'initialLanguage', 'configured valid locale; no replacement locale invented', raw?.initialLanguage);
  return { root, layouts, initialLanguage, languages: languages.filter((language) => layouts[language.id]), sections: base,
    diagnostics: outlet && percent(outlet.height) ? outlet : null,
    development: inspector && Number.isFinite(inspector.zIndex) && typeof raw?.development?.inspectionEnabled === 'boolean'
      ? { inspector, enabled: raw.development.inspectionEnabled } : null };
}
