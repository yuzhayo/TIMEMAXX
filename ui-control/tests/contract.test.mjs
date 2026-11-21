import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInputConfig } from '../logic/InputConfig.mjs';
import { createInputSession } from '../logic/InputSession.mjs';
import { createDiagnostics } from '../../components/LayoutDiagnostics.mjs';
import { discoverComponents } from '../../components/ComponentDiscovery.mjs';
import { validateSectionCard } from '../../components/SectionCardConfig.mjs';
import { validateLanguageConfig } from '../view/sections/language/LanguageConfig.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const catalog = raw.sections.map((node) => ({ componentId: node.componentId, folder: node.folder,
  filePath: `${node.folder}/${node.id}Section.jsx`, Component() {},
  validateConfig: node.id === 'language' ? validateLanguageConfig : validateSectionCard }));
const validate = (config = structuredClone(raw), modules = catalog) => {
  const diagnostics = createDiagnostics();
  return { plan: validateInputConfig(config, modules, diagnostics), issues: diagnostics.getSnapshot() };
};

test('baseline resolves four cards and two independent locale layouts without diagnostics', () => {
  const { plan, issues } = validate();
  assert.deepEqual(issues, []);
  assert.equal(plan.initialLanguage, 'en');
  assert.deepEqual(plan.layouts.en.sections.map((node) => node.id), ['language', 'code', 'date', 'time']);
  assert.deepEqual(plan.layouts.id.sections.map((node) => node.label), ['Bahasa', 'Kode', 'Tanggal', 'Waktu']);
  for (const node of plan.sections) assert.equal(node.parts.header.parts.icon.name, 'expandMore');
});

test('one card preset changes every section; one instance/locale override leaves siblings untouched', () => {
  const before = validate().plan;
  const config = structuredClone(raw);
  config.presets.sectionHeader.colors.background = '#285776';
  for (const node of validate(config).plan.layouts.en.sections) assert.equal(node.parts.header.colors.background, '#285776');
  config.layouts.id.sections.code = { label: 'Kode', parts: { header: { colors: { background: '#123456' } } } };
  const { plan, issues } = validate(config);
  assert.deepEqual(issues, []);
  assert.equal(plan.layouts.id.sections.find((node) => node.id === 'code').parts.header.colors.background, '#123456');
  assert.equal(plan.layouts.en.sections.find((node) => node.id === 'code').parts.header.colors.background, '#285776');
  assert.deepEqual(plan.layouts.id.sections.find((node) => node.id === 'date').bounds, before.layouts.id.sections.find((node) => node.id === 'date').bounds);
});

test('locale order is configuration, never a hand-maintained component registry', () => {
  const config = structuredClone(raw);
  config.layouts.id.order = ['language', 'time', 'date', 'code'];
  const { plan, issues } = validate(config);
  assert.deepEqual(issues, []);
  assert.deepEqual(plan.layouts.id.sections.map((node) => node.id), config.layouts.id.order);
  assert.deepEqual(plan.layouts.en.sections.map((node) => node.id), raw.layouts.en.order);
});

test('Input discovery normalizes assigned folder paths and ignores empty skeletons', async () => {
  const diagnostics = createDiagnostics();
  const found = await discoverComponents({ './sections/code/Renamed.jsx': async () => ({ componentId: 'input.code', default() {} }),
    './sections/code/Empty.jsx': async () => ({}) }, diagnostics, 'sections');
  assert.equal(found[0].filePath, 'code/Renamed.jsx');
  assert.equal(found[0].folder, 'code');
  assert.deepEqual(diagnostics.getSnapshot(), []);
});

test('filename-independent IDs survive rename; folder/config relocation requires no assembly edits', () => {
  const moved = catalog.map((node) => node.componentId === 'input.code' ? { ...node, folder: 'other', filePath: 'other/Renamed.jsx' } : node);
  assert.equal(validate(raw, moved).plan.layouts.en.sections.length, 3);
  const config = structuredClone(raw);
  config.sections.find((node) => node.id === 'code').folder = 'other';
  const { plan, issues } = validate(config, moved);
  assert.deepEqual(issues, []);
  assert.equal(plan.layouts.en.sections.find((node) => node.id === 'code').filePath, 'other/Renamed.jsx');
});

test('duplicate component IDs and duplicate instance IDs are rejected before mounting valid siblings', () => {
  const duplicated = [...catalog, { ...catalog[1], filePath: 'code/Duplicate.jsx' }];
  const modules = validate(raw, duplicated);
  assert.deepEqual(modules.plan.layouts.en.sections.map((node) => node.id), ['language', 'date', 'time']);
  assert.equal(modules.issues.filter((issue) => issue.code === 'INPUT_DUPLICATE_COMPONENT').length, 2);
  const config = structuredClone(raw); config.sections.push(structuredClone(config.sections[1]));
  const instances = validate(config);
  assert.deepEqual(instances.plan.layouts.en.sections.map((node) => node.id), ['language', 'date', 'time']);
  assert.equal(instances.issues.filter((issue) => issue.code === 'INPUT_DUPLICATE_INSTANCE').length, 2);
});

test('disabled absent sections are intentional, while malformed disabled entries are still diagnosed', () => {
  const config = structuredClone(raw); config.sections[2].enabled = false;
  const modules = catalog.filter((node) => node.componentId !== 'input.date');
  assert.deepEqual(validate(config, modules).issues, []);
  config.sections[2].bounds.height = -1;
  assert.ok(validate(config, modules).issues.some((issue) => issue.code === 'INPUT_SECTION_INVALID'));
});

test('malformed visuals/state patches and preset cycles isolate only dependent sections', () => {
  for (const change of [(config) => { config.sections[1].colors = { border: 'not-a-color' }; },
    (config) => { config.sections[1].states = { hover: { geometry: { opacity: 2 } } }; },
    (config) => { config.presets.bad = { preset: 'loop' }; config.presets.loop = { preset: 'bad' }; config.sections[1].preset = 'bad'; }]) {
    const config = structuredClone(raw); change(config);
    const { plan, issues } = validate(config);
    assert.deepEqual(plan.layouts.en.sections.map((node) => node.id), ['language', 'date', 'time']);
    assert.ok(issues.length > 0);
  }
});

test('one global language and independent expansion retain selection across collapse', () => {
  const session = createInputSession(validate().plan);
  session.setLanguage('id'); session.setExpanded('language', false); session.setExpanded('code', false);
  assert.equal(session.getSnapshot().language, 'id');
  assert.equal(session.getSnapshot().expanded.time, true);
  session.setExpanded('language', true);
  assert.equal(session.getSnapshot().language, 'id');
  assert.equal(session.getSnapshot().expanded.code, false);
  let events = 0; session.subscribe(() => events++);
  assert.equal(session.setLanguage('unknown'), false);
  assert.equal(session.setExpanded('missing', true), false);
  assert.equal(events, 0);
  session.dispose();
});

test('initial expansion is configured, and invalid initial language is never replaced silently', () => {
  const config = structuredClone(raw); config.sections[1].expanded = false;
  assert.equal(createInputSession(validate(config).plan).getSnapshot().expanded.code, false);
  config.initialLanguage = 'unknown';
  const { plan, issues } = validate(config);
  assert.equal(plan.initialLanguage, null);
  assert.ok(issues.some((issue) => issue.code === 'INPUT_INITIAL_LANGUAGE_INVALID'));
});
