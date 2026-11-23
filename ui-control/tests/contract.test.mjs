import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInputConfig } from '../logic/InputConfig.mjs';
import { createInputSession } from '../logic/InputSession.mjs';
import { applyInputState, collectInputState } from '../logic/InputState.mjs';
import { createDiagnostics } from '../../components/LayoutDiagnostics.mjs';
import { discoverComponents } from '../../components/ComponentDiscovery.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const catalog = [
  { componentId: 'input.placeholder', Component: function Placeholder() {},
    folder: 'placeholder', filePath: 'placeholder/Placeholder.jsx', stateKeys: [] },
  { componentId: 'input.language', Component: function Language() {},
    folder: 'language', filePath: 'language/Language.jsx', stateKeys: ['language'] },
];
const validate = (config = structuredClone(raw), entries = catalog) => {
  const diagnostics = createDiagnostics();
  return { plan: validateInputConfig(config, entries, diagnostics), issues: diagnostics.getSnapshot() };
};

test('baseline mounts only the enabled language card and keeps the placeholder chassis disabled', () => {
  const { plan, issues } = validate();
  assert.deepEqual(issues, []);
  assert.deepEqual(plan.sections.map((node) => node.id), ['language']);
  assert.deepEqual(plan.sections.map((node) => node.componentId), ['input.language']);
  assert.deepEqual(plan.sections.map((node) => node.folder), ['language']);
  const node = plan.sections[0];
  assert.equal(node.expanded, true);
  assert.equal(node.sizing, 'content');
  assert.equal(node.parts.header.geometry.paddingY, 4, 'header height comes from configured paddingY');
  assert.ok(node.parts.body, 'language body part resolves');
  assert.ok(node.parts.select, 'language select part resolves');
  assert.deepEqual(node.stateKeys, ['language'], 'the persisted selection travels with the discovered component');
  assert.equal(raw.sections[0].id, 'placeholder');
  assert.equal(raw.sections[0].enabled, false, 'the placeholder chassis stays configured but disabled');
  assert.deepEqual(raw.sections.map((section) => section.parts.header.geometry.paddingY), [4, 4],
    'every card shares the raised header height');
  assert.deepEqual(plan.languages.map((language) => [language.id, language.label]),
    [['en', 'English'], ['id', 'Indonesian']]);
  assert.equal(plan.initialLanguage, 'en');
  assert.deepEqual(plan.layouts.en.sections.map((node) => [node.id, node.label]),
    [['language', 'Language']]);
  assert.deepEqual(plan.layouts.id.sections.map((node) => [node.id, node.label]),
    [['language', 'Bahasa']]);
  assert.deepEqual(plan.layouts.id.sections[0].parts.select, plan.sections[0].parts.select);
});

test('window contract still owns its native geometry', () => {
  assert.equal(raw.window.width.base, 'frame');
  assert.equal(raw.window.width.percent, 40);
  assert.equal(raw.window.height.base, 'workArea');
  assert.equal(raw.window.placement.x, 'beforeFrame');
  assert.equal(raw.window.frame, false);
  assert.equal(raw.window.thickFrame, false);
});

test('discovery ignores empty skeletons and normalizes assigned folders', async () => {
  const diagnostics = createDiagnostics();
  const found = await discoverComponents({ './sections/code/Renamed.jsx': async () => ({ componentId: 'input.code', default() {} }),
    './sections/code/Empty.jsx': async () => ({}) }, diagnostics, 'sections');
  assert.equal(found[0].filePath, 'code/Renamed.jsx');
  assert.equal(found[0].folder, 'code');
  assert.deepEqual(found[0].stateKeys, [], 'a section without selections declares no state keys');
  assert.deepEqual(diagnostics.getSnapshot(), []);
});

test('discovery carries declared state keys and rejects malformed ones', async () => {
  const diagnostics = createDiagnostics();
  const found = await discoverComponents({ './sections/code/Stated.jsx': async () => ({ componentId: 'input.stated', default() {},
    stateKeys: ['zoom'] }) }, diagnostics, 'sections');
  assert.deepEqual(found[0].stateKeys, ['zoom']);
  const rejected = await discoverComponents({ './sections/code/Bad.jsx': async () => ({ componentId: 'input.bad', default() {},
    stateKeys: ['zoom', 'zoom'] }) }, diagnostics, 'sections');
  assert.deepEqual(rejected, [], 'a duplicated state key is not a valid component contract');
  assert.ok(diagnostics.getSnapshot().some((issue) => issue.code === 'INVALID_COMPONENT_CONTRACT' && issue.componentId === 'input.bad'));
});

test('persisted state applies only declared selections and never invents a fallback', () => {
  const { plan } = validate();
  const diagnostics = createDiagnostics();
  assert.deepEqual(applyInputState({ language: { language: 'id' } }, plan, diagnostics),
    { language: 'id' }, 'the last chosen language is restored');
  assert.deepEqual(diagnostics.getSnapshot(), []);
  assert.deepEqual(applyInputState({ language: { language: 'xx' } }, plan, diagnostics), {},
    'an unknown locale falls back to the configured default');
  assert.ok(diagnostics.getSnapshot().some((issue) => issue.code === 'INPUT_STATE_INVALID' && issue.instanceId === 'language'));
  assert.deepEqual(applyInputState({ language: { zoom: 3 } }, plan, diagnostics), {},
    'an undeclared key is rejected, not stored');
  assert.deepEqual(applyInputState({ placeholder: { language: 'id' } }, plan, diagnostics), {},
    'a disabled instance applies no persisted state');
  assert.deepEqual(applyInputState([], plan, diagnostics), {}, 'a malformed sections list is ignored');
  assert.deepEqual(applyInputState(undefined, plan, diagnostics), {}, 'a first run has no state to apply');
});

test('collect writes one bucket per section and drops empty or disabled ones', () => {
  const { plan } = validate();
  const live = { language: 'id', expanded: { language: true }, inspection: false };
  assert.deepEqual(collectInputState(plan, live), { schemaVersion: 1, sections: { language: { language: 'id' } } },
    'each section owns its own bucket');
  assert.deepEqual(collectInputState(plan, { expanded: { language: true } }), { schemaVersion: 1, sections: {} },
    'transient expansion state is not a persisted selection');
  const { plan: disabled } = validate((() => { const config = structuredClone(raw); config.sections[1].enabled = false; return config; })());
  assert.deepEqual(collectInputState(disabled, live), { schemaVersion: 1, sections: {} },
    'a disabled section leaves no stale bucket');
});

test('a configured section without an implementation is reported, never invented', () => {
  const config = structuredClone(raw);
  config.sections.push({ id: 'later', componentId: 'input.later', parentId: 'inputRoot', folder: 'later', enabled: true,
    expanded: true, bounds: { width: 100, height: 24 }, preset: 'root' });
  config.layouts.en.order = ['placeholder', 'language', 'later'];
  config.layouts.en.sections.later = { label: 'Later' };
  config.layouts.id.order = ['placeholder', 'language', 'later'];
  config.layouts.id.sections.later = { label: 'Terlambat' };
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.sections.map((node) => node.id), ['language']);
  assert.ok(issues.some((issue) => issue.code === 'INPUT_COMPONENT_MISSING' && issue.instanceId === 'later'));
  assert.deepEqual(plan.layouts.en.sections.map((node) => node.id), ['language']);
  assert.equal(plan.initialLanguage, 'en');
});

test('session owns language and expand/collapse state and rejects unknown changes', () => {
  const { plan } = validate();
  const restored = createInputSession(plan, false, { language: 'id' });
  assert.equal(restored.getSnapshot().language, 'id', 'a persisted selection seeds the session');
  restored.dispose();
  assert.equal(createInputSession(plan).getSnapshot().language, 'en', 'without persisted state the configured default applies');
  const session = createInputSession(plan);
  assert.deepEqual(session.getSnapshot().expanded, { language: true });
  assert.equal(session.getSnapshot().language, 'en');
  let events = 0;
  session.subscribe(() => events++);
  assert.equal(session.setExpanded('language', false), true);
  assert.equal(session.getSnapshot().expanded.language, false);
  assert.equal(session.setExpanded('language', false), false);
  assert.equal(session.setExpanded('placeholder', true), false, 'a disabled instance owns no session state');
  assert.equal(session.setLanguage('id'), true);
  assert.equal(session.getSnapshot().language, 'id');
  assert.equal(session.setLanguage('id'), false);
  assert.equal(session.setLanguage('xx'), false);
  assert.equal(events, 2);
  session.dispose();
});
