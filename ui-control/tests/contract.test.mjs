import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateInputConfig } from '../logic/InputConfig.mjs';
import { createInputSession } from '../logic/InputSession.mjs';
import { applyInputState, collectInputState } from '../logic/InputState.mjs';
import { ALPHABET, LENGTH, MAX_ENCODABLE, decode, encode, isValidCode, newCode } from '../logic/CodeGenerator.mjs';
import { DEFAULT_HOUR_FORMAT, HOUR_FORMATS, formatTime, fromMinutes, generateTime, isValidHourFormat,
  normalizeRange, parseTime, renderTime, toMinutes } from '../logic/TimeValue.mjs';
import { createDiagnostics } from '../../components/LayoutDiagnostics.mjs';
import { discoverComponents } from '../../components/ComponentDiscovery.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const catalog = [
  { componentId: 'input.placeholder', Component: function Placeholder() {},
    folder: 'placeholder', filePath: 'placeholder/Placeholder.jsx', stateKeys: [] },
  { componentId: 'input.language', Component: function Language() {},
    folder: 'language', filePath: 'language/Language.jsx', stateKeys: ['language'] },
  { componentId: 'input.code-generator', Component: function CodeGenerator() {},
    folder: 'code-generator', filePath: 'code-generator/CodeGenerator.jsx', stateKeys: [] },
  { componentId: 'input.time', Component: function Time() {},
    folder: 'time', filePath: 'time/Time.jsx', stateKeys: ['hourFormat'] },
];
const validate = (config = structuredClone(raw), entries = catalog) => {
  const diagnostics = createDiagnostics();
  return { plan: validateInputConfig(config, entries, diagnostics), issues: diagnostics.getSnapshot() };
};

test('baseline mounts the enabled language, code-generator and time cards, keeping the placeholder chassis disabled', () => {
  const { plan, issues } = validate();
  assert.deepEqual(issues, []);
  assert.deepEqual(plan.sections.map((node) => node.id), ['language', 'codeGenerator', 'time']);
  assert.deepEqual(plan.sections.map((node) => node.componentId),
    ['input.language', 'input.code-generator', 'input.time']);
  assert.deepEqual(plan.sections.map((node) => node.folder), ['language', 'code-generator', 'time']);
  for (const node of plan.sections) {
    assert.equal(node.expanded, true);
    assert.equal(node.sizing, 'content');
    assert.ok(node.parts.header.geometry.paddingY > 0, 'header height comes from configured paddingY');
    assert.ok(node.parts.body, `${node.id} body part resolves`);
  }
  const [language, generator, time] = plan.sections;
  assert.ok(language.parts.select, 'language select part resolves');
  assert.deepEqual(language.stateKeys, ['language'], 'the persisted selection travels with the discovered component');
  assert.ok(generator.parts.value, 'the code-generator value box resolves its own part');
  assert.ok(generator.parts.generate, 'the code-generator button resolves its own part');
  assert.deepEqual(generator.stateKeys, [], 'a generated code is an output, not a persisted selection');
  assert.equal(generator.parts.body.content.direction, 'row', 'the body lays the value box beside the button');
  assert.equal(generator.parts.body.content.verticalAlign, 'stretch', 'both controls share one row height');
  assert.ok(generator.parts.value.geometry.paddingY > 0 && generator.parts.generate.geometry.paddingY > 0,
    'control height comes from configured padding, not hardcoded pixels');
  assert.deepEqual(time.stateKeys, ['hourFormat'], 'the hour format is the only persisted time selection');
  for (const name of ['select', 'row', 'value', 'timeButton', 'range', 'from', 'to', 'generate', 'picker']) {
    assert.ok(time.parts[name], `the time section resolves its ${name} part`);
  }
  assert.deepEqual(time.parts.select, language.parts.select, 'the format dropdown reuses the language dropdown part');
  assert.equal(time.parts.body.content.direction, 'column', 'the time body stacks format, value row, range row and Generate');
  assert.equal(time.parts.row.content.direction, 'row', 'the main value box sits beside the Time button');
  assert.equal(time.parts.range.content.direction, 'row', 'the two range bounds sit side by side');
  assert.equal(time.parts.value.geometry.paddingY, time.parts.timeButton.geometry.paddingY,
    'value box and Time button derive one proportional height from the same configured padding');
  assert.equal(time.parts.picker.portal.placement, 'bottom-start', 'the picker uses the shared popup placement contract');
  assert.ok(Number.isFinite(time.parts.picker.size.width) && Number.isFinite(time.parts.picker.size.height),
    'the popup size is explicit viewport percentages in JSON');
  assert.equal(raw.sections[0].id, 'placeholder');
  assert.equal(raw.sections[0].enabled, false, 'the placeholder chassis stays configured but disabled');
  assert.deepEqual(raw.sections.map((section) => section.parts.header.geometry.paddingY),
    raw.sections.map(() => raw.sections[0].parts.header.geometry.paddingY),
    'every card shares the same header height');
  assert.deepEqual(plan.languages.map((language) => [language.id, language.label]),
    [['en', 'English'], ['id', 'Indonesian']]);
  assert.equal(plan.initialLanguage, 'en');
  assert.deepEqual(plan.layouts.en.sections.map((node) => [node.id, node.label]),
    [['language', 'Language'], ['codeGenerator', 'Code Generator'], ['time', 'Time']]);
  assert.deepEqual(plan.layouts.id.sections.map((node) => [node.id, node.label]),
    [['language', 'Bahasa'], ['codeGenerator', 'Generator Kode'], ['time', 'Waktu']]);
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
  assert.deepEqual(applyInputState({ time: { hourFormat: '12' } }, plan, diagnostics),
    { hourFormat: '12' }, 'the last chosen hour format is restored for its own section');
  assert.deepEqual(applyInputState({ time: { hourFormat: '13' } }, plan, diagnostics), {},
    'an unsupported hour format falls back to the configured default');
  assert.ok(diagnostics.getSnapshot().some((issue) => issue.code === 'INPUT_STATE_INVALID' && issue.instanceId === 'time'));
  assert.deepEqual(applyInputState({ time: { language: 'id' } }, plan, diagnostics), {},
    'a section cannot store a selection it did not declare');
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
  const live = { language: 'id', hourFormat: '12', expanded: { language: true }, inspection: false };
  assert.deepEqual(collectInputState(plan, live), { schemaVersion: 1,
    sections: { language: { language: 'id' }, time: { hourFormat: '12' } } },
  'each section owns its own bucket');
  assert.deepEqual(collectInputState(plan, { expanded: { language: true } }), { schemaVersion: 1, sections: {} },
    'transient expansion state is not a persisted selection');
  const { plan: disabled } = validate((() => { const config = structuredClone(raw); config.sections[1].enabled = false; return config; })());
  assert.deepEqual(collectInputState(disabled, live), { schemaVersion: 1, sections: { time: { hourFormat: '12' } } },
    'a disabled section leaves no stale bucket');
});

test('a configured section without an implementation is reported, never invented', () => {
  const config = structuredClone(raw);
  config.sections.push({ id: 'later', componentId: 'input.later', parentId: 'inputRoot', folder: 'later', enabled: true,
    expanded: true, bounds: { width: 100, height: 24 }, preset: 'root' });
  config.layouts.en.order = ['placeholder', 'language', 'codeGenerator', 'time', 'later'];
  config.layouts.en.sections.later = { label: 'Later' };
  config.layouts.id.order = ['placeholder', 'language', 'codeGenerator', 'time', 'later'];
  config.layouts.id.sections.later = { label: 'Terlambat' };
  const { plan, issues } = validate(config);
  assert.deepEqual(plan.sections.map((node) => node.id), ['language', 'codeGenerator', 'time']);
  assert.ok(issues.some((issue) => issue.code === 'INPUT_COMPONENT_MISSING' && issue.instanceId === 'later'));
  assert.deepEqual(plan.layouts.en.sections.map((node) => node.id), ['language', 'codeGenerator', 'time']);
  assert.equal(plan.initialLanguage, 'en');
});

test('session owns language, hour format and expand/collapse state and rejects unknown changes', () => {
  const { plan } = validate();
  const restored = createInputSession(plan, false, { language: 'id', hourFormat: '12' });
  assert.equal(restored.getSnapshot().language, 'id', 'a persisted selection seeds the session');
  assert.equal(restored.getSnapshot().hourFormat, '12', 'the persisted hour format seeds the session');
  restored.dispose();
  assert.equal(createInputSession(plan).getSnapshot().language, 'en', 'without persisted state the configured default applies');
  const session = createInputSession(plan);
  assert.deepEqual(session.getSnapshot().expanded, { language: true, codeGenerator: true, time: true });
  assert.equal(session.getSnapshot().language, 'en');
  assert.equal(session.getSnapshot().hourFormat, '24', 'the time format defaults to 24 hour');
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
  assert.equal(session.setHourFormat('12'), true);
  assert.equal(session.getSnapshot().hourFormat, '12');
  assert.equal(session.setHourFormat('12'), false);
  assert.equal(session.setHourFormat('13'), false);
  assert.equal(events, 3);
  session.dispose();
});

test('the ported generator keeps the reference format rules', () => {
  assert.equal(ALPHABET, 'ABCDEGHKLMNPRTUWXY123469');
  assert.equal(ALPHABET.length, 24);
  assert.equal(LENGTH, 14);
  assert.equal(MAX_ENCODABLE, 18406255107772514304n, '21 * 24^13, the reference cap');
  assert.equal(21n * 24n ** 13n, MAX_ENCODABLE);
  assert.equal(encode(12312059506235497154n), 'UBDCEAAU9R2PAC', 'the reference encode example');
  assert.equal(decode('UBDCEAAU9R2PAC'), 12312059506235497154n, 'the reference decode example');
  for (const sample of [0n, 1n, 12345678901234n, MAX_ENCODABLE - 1n]) {
    assert.equal(decode(encode(sample)), sample, 'round-trip is exact');
  }
  assert.throws(() => encode(2n ** 64n), /unsigned 64-bit/);
  assert.throws(() => encode(-1n), /unsigned 64-bit/);
  assert.throws(() => decode('UBDCEAAU9R2PA'), /exactly 14/);
  assert.throws(() => decode('UBDCEAAU9R2PAZ'), /unsupported symbol/);
});

test('generated codes satisfy all three rules and never lead with an unreachable symbol', () => {
  for (let index = 0; index < 2000; index++) {
    const code = newCode();
    assert.equal(code.length, LENGTH);
    assert.ok(isValidCode(code), `${code} must satisfy the format rules`);
    assert.ok(!'469'.includes(code[0]), `${code} must not lead with an unreachable symbol`);
    assert.ok(decode(code) < MAX_ENCODABLE);
  }
  // An injected source makes generation reproducible and proves the rejection path.
  assert.equal(newCode(() => 0n), 'A'.repeat(14), 'zero encodes as the padded alphabet head');
  assert.equal(newCode(() => MAX_ENCODABLE - 1n), `3${'9'.repeat(13)}`,
    'the highest encodable value leads with index 20, never 4, 6 or 9');
  const sequence = [MAX_ENCODABLE, 0n];
  let drawn = 0;
  assert.equal(newCode(() => sequence[drawn++]), 'A'.repeat(14), 'a draw at or above the cap is rejected');
  assert.equal(drawn, 2, 'the rejected draw is retried, never encoded');
  assert.equal(isValidCode('469AAAAAAAAAAA'), false, 'a leading 4, 6 or 9 is not a valid code');
  assert.equal(isValidCode('ABCDEGHKLMNP'), false, '13 characters is not a code');
  assert.equal(isValidCode('ABCDEGHKLMNPRF'), false, 'a symbol outside the alphabet is not a code');
  assert.equal(isValidCode(null), false);
});

test('time values keep a colon separator and the reference 12/24-hour rules', () => {
  assert.deepEqual(HOUR_FORMATS, ['24', '12']);
  assert.equal(DEFAULT_HOUR_FORMAT, '24', '24 hour is the configured default');
  assert.equal(isValidHourFormat('24'), true);
  assert.equal(isValidHourFormat('12'), true);
  assert.equal(isValidHourFormat('13'), false);
  assert.equal(isValidHourFormat(24), false);
  assert.deepEqual(parseTime('14:30'), { hour: 14, minute: 30 });
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('14.30'), null, 'a dotted time mark is never a valid time');
  assert.equal(parseTime('2:30'), null, 'the stored mask is zero-padded');
  assert.equal(formatTime(8, 5), '08:05');
  assert.equal(renderTime('14:30', '24'), '14:30');
  assert.equal(renderTime('14:30', '12'), '02:30 PM');
  assert.equal(renderTime('00:05', '12'), '12:05 AM');
  assert.equal(renderTime('12:05', '12'), '12:05 PM');
  assert.equal(renderTime('00:00', '24'), '00:00');
  assert.equal(renderTime('23:59', '24'), '23:59');
  assert.ok(!renderTime('14:30', '24').includes('.') && !renderTime('14:30', '12').includes('.'),
    'the time mark never uses a dot');
  assert.equal(renderTime('not a time', '24'), '--:--');
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('23:59'), 1439);
  assert.equal(fromMinutes(0), '00:00');
  assert.equal(fromMinutes(1439), '23:59');
  assert.equal(fromMinutes(1440), null);
  assert.deepEqual(normalizeRange('17:00', '08:00'), { start: 480, end: 1020 },
    'a reversed range is normalized, not rejected');
  assert.equal(generateTime('08:00', '17:00', () => 0), '08:00', 'the range start is inclusive');
  assert.equal(generateTime('08:00', '17:00', () => 540), '17:00', 'the range end is inclusive');
  assert.equal(generateTime('17:00', '08:00', () => 1), '08:01', 'a reversed range still generates inside its bounds');
  assert.equal(generateTime('08:00', '08:00', () => 99), '08:00', 'a one-minute range is stable');
  assert.equal(generateTime('bad', '17:00'), null, 'an invalid bound generates nothing');
  for (let index = 0; index < 500; index++) {
    const value = generateTime('08:00', '17:00');
    assert.ok(toMinutes(value) >= 480 && toMinutes(value) <= 1020, `${value} stays inside the range`);
  }
});
