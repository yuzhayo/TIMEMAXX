import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInputConfig } from '../logic/InputConfig.mjs';
import { createInputSession } from '../logic/InputSession.mjs';
import { createDiagnostics } from '../../components/LayoutDiagnostics.mjs';
import { discoverComponents } from '../../components/ComponentDiscovery.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const validate = (config = structuredClone(raw), catalog = []) => {
  const diagnostics = createDiagnostics();
  return { plan: validateInputConfig(config, catalog, diagnostics), issues: diagnostics.getSnapshot() };
};

test('empty Input shell resolves without diagnostics or fabricated sections', () => {
  const { plan, issues } = validate();
  assert.deepEqual(issues, []);
  assert.deepEqual(plan.sections, []);
  assert.deepEqual(plan.layouts, {});
  assert.deepEqual(plan.languages, []);
  assert.equal(plan.initialLanguage, null);
  assert.equal(plan.root.id, 'inputRoot');
  assert.deepEqual(raw.sections, []);
  assert.deepEqual(raw.layouts, {});
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
  config.languages.push({ id: 'en', label: 'English' });
  config.layouts.en = { gapY: 1, order: ['later'], sections: { later: { label: 'Later' } } };
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.sections, []);
  assert.ok(issues.some((issue) => issue.code === 'INPUT_COMPONENT_MISSING' && issue.instanceId === 'later'));
});

test('empty session stays idle and rejects unknown state changes', () => {
  const session = createInputSession(validate().plan);
  assert.deepEqual(session.getSnapshot().expanded, {});
  assert.equal(session.getSnapshot().language, null);
  let events = 0;
  session.subscribe(() => events++);
  assert.equal(session.setLanguage('en'), false);
  assert.equal(session.setExpanded('missing', true), false);
  assert.equal(events, 0);
  session.dispose();
});
