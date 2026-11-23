import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInputConfig } from '../logic/InputConfig.mjs';
import { createInputSession } from '../logic/InputSession.mjs';
import { createDiagnostics } from '../../components/LayoutDiagnostics.mjs';
import { discoverComponents } from '../../components/ComponentDiscovery.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const catalog = [
  { componentId: 'input.placeholder', Component: function Placeholder() {},
    folder: 'placeholder', filePath: 'placeholder/Placeholder.jsx' },
  { componentId: 'input.language', Component: function Language() {},
    folder: 'language', filePath: 'language/Language.jsx' },
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
  assert.deepEqual(diagnostics.getSnapshot(), []);
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
