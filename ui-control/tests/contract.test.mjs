import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInputConfig } from '../logic/InputConfig.mjs';
import { createInputSession } from '../logic/InputSession.mjs';
import { createDiagnostics } from '../../components/LayoutDiagnostics.mjs';
import { discoverComponents } from '../../components/ComponentDiscovery.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const catalog = [{ componentId: 'input.placeholder', Component: function Placeholder() {},
  folder: 'placeholder', filePath: 'placeholder/Placeholder.jsx' }];
const validate = (config = structuredClone(raw), entries = catalog) => {
  const diagnostics = createDiagnostics();
  return { plan: validateInputConfig(config, entries, diagnostics), issues: diagnostics.getSnapshot() };
};

test('baseline resolves the baked placeholder with header/body parts and its locale layout', () => {
  const { plan, issues } = validate();
  assert.deepEqual(issues, []);
  assert.deepEqual(plan.sections.map((node) => node.id), ['placeholder']);
  assert.equal(plan.sections[0].componentId, 'input.placeholder');
  assert.equal(plan.sections[0].folder, 'placeholder');
  assert.equal(plan.sections[0].expanded, true);
  assert.equal(plan.sections[0].sizing, 'content');
  assert.ok(plan.sections[0].parts.header, 'header part resolves');
  assert.ok(plan.sections[0].parts.body, 'body part resolves');
  assert.deepEqual(plan.languages.map((language) => language.id), ['en']);
  assert.equal(plan.initialLanguage, 'en');
  assert.deepEqual(plan.layouts.en.sections.map((node) => [node.id, node.label]), [['placeholder', 'Placeholder']]);
  assert.deepEqual(plan.layouts.en.sections[0].parts.header, plan.sections[0].parts.header);
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
  config.layouts.en.order = ['placeholder', 'later'];
  config.layouts.en.sections.later = { label: 'Later' };
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.sections.map((node) => node.id), ['placeholder']);
  assert.ok(issues.some((issue) => issue.code === 'INPUT_COMPONENT_MISSING' && issue.instanceId === 'later'));
  assert.deepEqual(plan.layouts.en.sections.map((node) => node.id), ['placeholder']);
  assert.equal(plan.initialLanguage, 'en');
});

test('session owns language and expand/collapse state and rejects unknown changes', () => {
  const { plan } = validate();
  const session = createInputSession(plan);
  assert.deepEqual(session.getSnapshot().expanded, { placeholder: true });
  assert.equal(session.getSnapshot().language, 'en');
  let events = 0;
  session.subscribe(() => events++);
  assert.equal(session.setExpanded('placeholder', false), true);
  assert.equal(session.getSnapshot().expanded.placeholder, false);
  assert.equal(session.setExpanded('placeholder', false), false);
  assert.equal(session.setExpanded('missing', true), false);
  assert.equal(session.setLanguage('en'), false);
  assert.equal(session.setLanguage('xx'), false);
  assert.equal(events, 1);
  session.dispose();
});
