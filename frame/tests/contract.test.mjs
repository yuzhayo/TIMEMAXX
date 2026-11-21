import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateFrameConfig, nativeWindowValid } from '../view/layout/ConfigValidation.mjs';
import { discoverComponents } from '../view/layout/ComponentDiscovery.mjs';
import { createDiagnostics } from '../view/layout/LayoutDiagnostics.mjs';
import { PhotoHistory } from '../logic/PhotoHistory.mjs';
import { createFrameSession } from '../logic/FrameSession.mjs';
import { configuredAppearance as appearance } from '../../components/appearance.mjs';
import { createWindowActions } from '../logic/WindowActions.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
// This fixture tests the history/layout slice; file-action behavior has a real Electron proof.
raw.instances = raw.instances.filter((node) => node.componentId.startsWith('history.'));
const entry = (id, filePath, configKeys = []) => ({ componentId: id, filePath, folder: filePath.slice(0, filePath.lastIndexOf('/')), Component() {}, configKeys });
const catalog = [entry('history.undo', 'windows-bar/UndoButton.jsx', ['icon']), entry('history.redo', 'windows-bar/RedoButton.jsx', ['icon'])];
const validate = (config = structuredClone(raw), files = catalog) => {
  const diagnostics = createDiagnostics();
  const plan = validateFrameConfig(config, files, diagnostics);
  return { plan, issues: diagnostics.getSnapshot() };
};

test('valid baseline resolves four sections and both controls, with no fabricated edit', () => {
  const { plan, issues } = validate();
  assert.deepEqual(issues, []);
  assert.equal(plan.sections.length, 4);
  assert.equal(plan.instances.length, 2);
  assert.equal(new PhotoHistory(raw.document, raw.history.limit).snapshot().canUndo, false);
});

test('discovery normalizes source identity once and ignores empty skeleton/helper modules', async () => {
  const diagnostics = createDiagnostics();
  const found = await discoverComponents({
    './window/action-bar/Renamed.jsx': async () => ({ componentId: 'history.undo', default() {} }),
    './window/action-bar/Empty.jsx': async () => ({}),
    './window/frame-body/Helper.jsx': async () => ({ helper() {} }),
  }, diagnostics);
  assert.equal(found.length, 1);
  assert.equal(found[0].componentId, 'history.undo');
  assert.equal(found[0].filePath, 'action-bar/Renamed.jsx');
  assert.equal(found[0].folder, 'action-bar');
  assert.deepEqual(diagnostics.getSnapshot(), []);
});

test('discovery diagnoses the actual malformed export and preserves other modules', async () => {
  for (const [name, value] of [['partKeys', ['thumb', 'thumb']], ['requires', [false]], ['validateConfig', 42]]) {
    const diagnostics = createDiagnostics();
    const found = await discoverComponents({
      './window/action-bar/Bad.jsx': async () => ({ componentId: 'bad.control', default() {}, [name]: value }),
      './window/action-bar/Good.jsx': async () => ({ componentId: 'good.control', default() {} }),
    }, diagnostics);
    assert.deepEqual(found.map((entry) => entry.componentId), ['good.control']);
    assert.match(diagnostics.getSnapshot()[0].expected, new RegExp(name));
    assert.equal(diagnostics.getSnapshot()[0].filePath, 'action-bar/Bad.jsx');
  }
});

test('file move plus parent JSON works; folder-only move isolates the mismatch', () => {
  const files = [entry('history.undo', 'action-bar/UndoButton.jsx', ['icon']), catalog[1]];
  const wrong = validate(structuredClone(raw), files);
  assert.deepEqual(wrong.plan.instances.map((node) => node.id), ['redo']);
  assert.equal(wrong.issues[0].code, 'FOLDER_PARENT_MISMATCH');
  assert.equal(wrong.issues[0].expected, 'windows-bar');
  const config = structuredClone(raw);
  config.instances[0].parentId = 'actionBar';
  config.instances[0].placement = { align: 'start', order: 4, allocation: 'controls' };
  config.instances[0].bounds = { width: 4.5 };
  assert.equal(validate(config, files).plan.instances.length, 2);
});

test('all duplicate component files and duplicate instances are isolated before mount', () => {
  const duplicate = validate(structuredClone(raw), [...catalog, entry('history.undo', 'action-bar/Copy.jsx')]);
  assert.deepEqual(duplicate.plan.instances.map((node) => node.id), ['redo']);
  assert.equal(duplicate.issues.filter((issue) => issue.code === 'DUPLICATE_COMPONENT_ID').length, 2);
  const config = structuredClone(raw);
  config.instances.push(structuredClone(config.instances[0]));
  assert.deepEqual(validate(config).plan.instances.map((node) => node.id), ['redo']);
});

test('enabled false suppresses intentional missing-component reports, not invalid config', () => {
  const config = structuredClone(raw);
  config.instances[0].enabled = false;
  let result = validate(config, [catalog[1]]);
  assert.equal(result.plan.instances.length, 1);
  assert.deepEqual(result.issues, []);
  config.instances[0].bounds.height = -1;
  result = validate(config, [catalog[1]]);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_INSTANCE'));
});

test('one config appearance change leaves the sibling untouched', () => {
  const config = structuredClone(raw);
  const before = validate().plan;
  config.instances[0].colors = { foreground: '#123456' };
  config.instances[0].bounds.height = 40;
  const { plan, issues } = validate(config);
  assert.deepEqual(issues, []);
  assert.equal(plan.instances[0].colors.foreground, '#123456');
  assert.equal(plan.instances[0].bounds.height, 40);
  assert.deepEqual(plan.instances[1], before.instances[1]);
});

test('missing config, unknown parent and invalid visuals produce specific issues and preserve siblings', () => {
  const missing = structuredClone(raw);
  missing.instances.pop();
  assert.ok(validate(missing).issues.some((issue) => issue.code === 'COMPONENT_WITHOUT_CONFIG'));
  const parent = structuredClone(raw);
  parent.instances[0].parentId = 'unknown';
  assert.deepEqual(validate(parent).plan.instances.map((node) => node.id), ['redo']);
  assert.ok(validate(parent).issues.some((issue) => issue.code === 'UNKNOWN_PARENT'));
  const badVisual = structuredClone(raw);
  badVisual.instances[0].colors = { foreground: 'made-up-color' };
  assert.deepEqual(validate(badVisual).plan.instances.map((node) => node.id), ['redo']);
  assert.ok(validate(badVisual).issues.some((issue) => issue.code === 'INVALID_VISUAL'));
});

test('real grouped history supports undo/redo and truncates future on a new edit', () => {
  const session = createFrameSession({ limit: 2 }, { document: { rotation: 0 } });
  let publications = 0;
  session.subscribe(() => publications++);
  session.commit({ rotation: 15 });
  session.commit({ rotation: 30 });
  session.undo();
  assert.deepEqual(session.getSnapshot(), { document: { rotation: 15 }, canUndo: true, canRedo: true, historyAvailable: true, rotationSettings: null });
  session.redo();
  assert.equal(session.getSnapshot().document.rotation, 30);
  session.undo();
  session.commit({ rotation: 45 });
  assert.equal(session.getSnapshot().canRedo, false);
  assert.equal(publications, 6);
});

test('diagnostics deduplicate with counts, persist summaries, and survive a write failure', async () => {
  let persisted;
  const diagnostics = createDiagnostics(async (records) => { persisted = records; return { ok: true }; });
  const issue = { code: 'FOLDER_PARENT_MISMATCH', instanceId: 'undo', configPath: 'instances[0].parentId', filePath: 'windows-bar/UndoButton.jsx', expected: 'action-bar', actual: 'windows-bar' };
  diagnostics.report(issue);
  diagnostics.report(issue);
  await diagnostics.flush();
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].repeatCount, 2);
  assert.match(persisted[0].message, /undo.*action-bar.*windows-bar.*skipped/);
  const failure = createDiagnostics(async () => ({ ok: false, error: 'read-only log' }));
  failure.report(issue);
  await failure.flush();
  assert.equal(failure.getSnapshot().length, 2);
  assert.ok(failure.getSnapshot().some((record) => record.code === 'LOG_WRITE_FAILED'));
});

test('preset cycles terminate and isolate only the dependent controls', () => {
  for (const indirect of [false, true]) {
    const config = structuredClone(raw);
    config.presets.broken = { preset: indirect ? 'other' : 'broken' };
    if (indirect) config.presets.other = { preset: 'broken' };
    config.instances[0].preset = 'broken';
    const issues = [];
    const plan = validateFrameConfig(config, catalog, { report: (issue) => issues.push(issue) });
    assert.deepEqual(plan.instances.map((node) => node.id), ['redo']);
    assert.ok(issues.some((issue) => issue.code === 'PRESET_CYCLE'));
    assert.ok(issues.length < 10, 'A cycle is diagnosed once, not recursively retried');
  }
});

test('explicit null groups and invalid shadow values are rejected rather than inherited', () => {
  for (const group of ['colors', 'geometry', 'typography', 'content']) {
    const config = structuredClone(raw);
    config.instances[0][group] = null;
    const { plan, issues } = validate(config);
    assert.deepEqual(plan.instances.map((node) => node.id), ['redo']);
    assert.ok(issues.some((issue) => issue.configPath === `instances[0].${group}`));
  }
  const config = structuredClone(raw);
  config.instances[0].geometry = { shadow: 'not-a-shadow' };
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.instances.map((node) => node.id), ['redo']);
  assert.ok(issues.some((issue) => issue.configPath === 'instances[0].geometry.shadow'));
});

test('unsupported preset properties invalidate dependents, not unrelated controls', () => {
  const config = structuredClone(raw);
  config.presets.broken = { preset: 'button', typoRadius: 123 };
  config.instances[0].preset = 'broken';
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.instances.map((node) => node.id), ['redo']);
  assert.ok(issues.some((issue) => issue.configPath === 'presets.broken.typoRadius'));
});

test('overlapping sibling sections and their children are isolated without choosing a winner', () => {
  const config = structuredClone(raw);
  config.sections[1].bounds.y = 0;
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.sections.map((section) => section.id), ['frameBody', 'bottomBar']);
  assert.equal(plan.instances.length, 0);
  assert.ok(issues.some((issue) => issue.code === 'SECTION_FLOW_OVERLAP'));
  assert.equal(validate().plan.sections.length, 4, 'Touching edges are valid');
});

test('missing inspector visuals and invalid label bounds are logged while controls remain', () => {
  const missing = structuredClone(raw);
  delete missing.development.inspector;
  let result = validate(missing);
  assert.equal(result.plan.instances.length, 2);
  assert.equal(result.plan.development, null);
  assert.ok(result.issues.some((issue) => issue.configPath === 'development.inspector'));
  const bounds = structuredClone(raw);
  bounds.development.label.bounds.height = -1;
  result = validate(bounds);
  assert.equal(result.plan.instances.length, 2);
  assert.equal(result.plan.development, null);
  assert.ok(result.issues.some((issue) => issue.configPath === 'development.label.bounds.height'));
});

test('a visual diagnostic identifies the instance, file and exact invalid property', () => {
  const config = structuredClone(raw);
  config.instances[0].geometry = { fontSize: 'wrong' };
  const { issues } = validate(config);
  const issue = issues.find((item) => item.configPath === 'instances[0].geometry.fontSize');
  assert.ok(issue);
  assert.equal(issue.instanceId, 'undo');
  assert.equal(issue.componentId, 'history.undo');
  assert.equal(issue.filePath, 'windows-bar/UndoButton.jsx');
});

test('configured physical alignment is correct for columns and border style comes from JSON', () => {
  const node = validate().plan.instances[0];
  node.content = { ...node.content, direction: 'column', horizontalAlign: 'flex-end', verticalAlign: 'flex-start' };
  node.geometry.borderStyle = 'dashed';
  const style = appearance(node);
  assert.equal(style.alignItems, 'flex-end');
  assert.equal(style.justifyContent, 'flex-start');
  assert.equal(style.borderStyle, 'dashed');
  assert.equal(style.transition, 'none');
});

test('one component can validate its own options for two independently configured instances', () => {
  const config = structuredClone(raw);
  const file = {
    ...entry('file.action', 'windows-bar/FileActionButton.jsx'), configKeys: ['action', 'icon'],
    validateConfig(node, report) { if (['load', 'save'].includes(node.action)) return true; report('action', 'load | save', node.action); return false; },
  };
  for (const [index, action] of ['load', 'save'].entries()) config.instances.push({ ...structuredClone(config.instances[0]), id: action,
    componentId: 'file.action', parentId: 'windowsBar', placement: { align: 'start', order: 4 + index }, action });
  let result = validate(config, [...catalog, file]);
  assert.equal(result.plan.instances.length, 4);
  assert.deepEqual(result.issues, []);
  config.instances[3].action = 'delete';
  result = validate(config, [...catalog, file]);
  assert.deepEqual(result.plan.instances.map((node) => node.id), ['undo', 'redo', 'load']);
  assert.ok(result.issues.some((issue) => issue.configPath === 'instances[3].action' && issue.instanceId === 'save'));
});

test('new photo history reset discards the previous image edits', () => {
  const history = new PhotoHistory({ rotation: 0 }, 10);
  history.commit({ rotation: 30 });
  history.reset({ rotation: 0, scale: 2 });
  assert.deepEqual(history.snapshot(), { document: { rotation: 0, scale: 2 }, canUndo: false, canRedo: false });
});

test('invalid history policy preserves the document, file actions and all valid instances', async () => {
  const config = structuredClone(raw);
  config.history.limit = 0;
  const diagnostics = createDiagnostics();
  const plan = validateFrameConfig(config, catalog, diagnostics);
  assert.equal(plan.history, null);
  assert.deepEqual(plan.document, config.document);
  assert.equal(plan.instances.length, 2, 'Validation does not delete valid controls');
  let exported;
  const session = createFrameSession(plan.history, {
    document: plan.document, output: plan.output, diagnostics,
    transport: {
      openImage: async () => ({ ok: true, result: null }),
      saveImage: async (snapshot) => { exported = snapshot; return { ok: true, result: { width: snapshot.width, height: 1600, path: 'proof.png' } }; },
    },
  });
  assert.equal(session.getSnapshot().historyAvailable, false);
  session.commit({ ...plan.document, rotation: 30 });
  assert.equal(session.getSnapshot().canUndo, false);
  await session.save();
  assert.equal(exported.transform.rotation, 30, 'Untracked document edits still export');
  assert.ok(diagnostics.getSnapshot().some((issue) => issue.code === 'INVALID_HISTORY_CONFIG'));
  session.dispose();
});

test('disabled components run their available option validator, while absent ones keep options opaque', () => {
  const config = structuredClone(raw);
  config.instances = [{ ...config.instances[0], id: 'save', componentId: 'file.action', parentId: 'windowsBar', enabled: false, action: 'delete', icon: 'save' }];
  let calls = 0;
  const file = {
    ...entry('file.action', 'windows-bar/FileActionButton.jsx'), configKeys: ['action', 'icon'],
    validateConfig(node, report) { calls++; if (['load', 'save'].includes(node.action)) return true; report('action', 'load | save', node.action); return false; },
  };
  let result = validate(config, [file]);
  assert.equal(calls, 1);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_COMPONENT_CONFIG' && issue.configPath === 'instances[0].action'));
  config.instances[0].action = 'save';
  result = validate(config, []);
  assert.equal(result.plan.instances.length, 0);
  assert.deepEqual(result.issues, [], 'No false unknown-option/missing-file error for an intentional exclusion');
  config.instances[0].bounds.height = -1;
  assert.ok(validate(config, []).issues.some((issue) => issue.code === 'INVALID_INSTANCE'));
});

test('file failures retain operation and initiating component/config/source identity', async () => {
  const diagnostics = createDiagnostics();
  const session = createFrameSession(raw.history, {
    document: raw.document, output: raw.output, diagnostics,
    transport: { openImage: async () => ({ ok: false, error: 'Access denied' }) },
  });
  const origin = { componentId: 'file.action', instanceId: 'customLoad', parentId: 'windowsBar', filePath: 'windows-bar/RenamedFileAction.jsx', configPath: 'instances[5]' };
  await session.load(origin);
  await diagnostics.flush();
  const record = diagnostics.getSnapshot()[0];
  assert.equal(record.operation, 'load');
  for (const key of Object.keys(origin)) assert.equal(record[key], origin[key]);
  assert.equal(session.getSnapshot().busy, false);
  session.dispose();
});

test('native window actions publish OS state and retain failed-action origin', async () => {
  let listener;
  let disposed = false;
  let publications = 0;
  const diagnostics = createDiagnostics();
  const operations = [];
  const actions = createWindowActions({
    initialState: { maximized: false, minimized: false, verticalMaximized: false }, diagnostics,
    publish: () => publications++,
    transport: {
      onWindowState(callback) { listener = callback; return () => { disposed = true; }; },
      async windowAction(operation) { operations.push(operation); return operation === 'destroy' ? { ok: false, error: 'Unsupported operation' } : { ok: true }; },
    },
  });
  await actions.activate('toggleVerticalMaximize');
  listener({ maximized: false, minimized: false, verticalMaximized: true });
  assert.deepEqual(actions.snapshot(), { maximized: false, minimized: false, verticalMaximized: true });
  assert.equal(publications, 1);
  await actions.activate('destroy', { componentId: 'window.action', instanceId: 'windowClose', filePath: 'windows-bar/WindowActionButton.jsx', configPath: 'instances[9]' });
  assert.equal(diagnostics.getSnapshot()[0].instanceId, 'windowClose');
  assert.equal(diagnostics.getSnapshot()[0].operation, 'destroy');
  assert.deepEqual(operations, ['toggleVerticalMaximize', 'destroy']);
  actions.dispose();
  assert.equal(disposed, true);
});

test('custom caption is explicit and rejects unused native-overlay properties', () => {
  assert.equal(nativeWindowValid(raw.window), true);
  const native = { ...raw.window, caption: { mode: 'native', height: 34, background: '#171c22', foreground: '#c6d0dc' } };
  assert.equal(nativeWindowValid(native), true);
  assert.equal(nativeWindowValid({ ...raw.window, caption: { mode: 'custom', height: 34 } }), false);
  assert.equal(nativeWindowValid({ ...raw.window, caption: { mode: 'unsupported' } }), false);
});

test('interaction settings are explicit, validated and retained for the generic slot', () => {
  const config = structuredClone(raw);
  config.instances[0].interaction = { pointerEvents: 'none', dragRegion: 'inherit' };
  let result = validate(config);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.plan.instances[0].interaction, config.instances[0].interaction);
  config.instances[0].interaction.pointerEvents = 'guess';
  result = validate(config);
  assert.deepEqual(result.plan.instances.map((node) => node.id), ['redo']);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_INTERACTION' && issue.configPath === 'instances[0].interaction.pointerEvents'));
});
