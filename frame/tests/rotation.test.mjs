import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PhotoHistory } from '../logic/PhotoHistory.mjs';
import { createFrameSession } from '../logic/FrameSession.mjs';
import { normalizeRotation, parseRotationDraft, rotationSettingsProblem } from '../logic/PhotoOperations.mjs';
import { validateFrameConfig } from '../view/layout/ConfigValidation.mjs';
import { createDiagnostics } from '../view/layout/LayoutDiagnostics.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
globalThis.Image ??= class {
  naturalWidth = 600; naturalHeight = 800;
  async decode() {}
};
const makeSession = async (history = raw.history) => {
  let saved;
  let photoId = 0;
  let activeId = null;
  let pending = null;
  const session = createFrameSession(history, {
    document: raw.document, output: raw.output, rotation: raw.rotation,
    transport: {
      openImage: async (current) => {
        assert.equal(current, activeId);
        pending = { photoId: ++photoId, previous: activeId };
        return { ok: true, result: { photoId, name: 'test.png', path: 'C:/fixture/test.png', width: 600, height: 800, preview: new Uint8Array([1]) } };
      },
      acceptImage: async (next) => { assert.equal(next, pending.photoId); activeId = next; return { ok: true, result: { photoId: next } }; },
      finalizeImage: async (next) => { assert.equal(next, pending.photoId); pending = null; return { ok: true, result: { photoId: next } }; },
      discardImage: async (next) => { assert.equal(next, pending.photoId); activeId = pending.previous; pending = null; return { ok: true }; },
      saveImage: async (value) => { saved = value; return { ok: true, result: null }; },
    },
  });
  await session.load();
  return { session, saved: () => saved };
};

test('rotation policy, decimal draft grammar, precision and wrap have one owner', () => {
  assert.equal(rotationSettingsProblem(raw.rotation), null);
  for (const [value, expected] of [[12.34, 12.3], [270, -90], [-270, 90], [540, -180], [-0, 0], [180, 180]]) assert.equal(normalizeRotation(value, raw.rotation), expected);
  for (const text of ['', '-', '.', '12x', 'Infinity', '0x12', '1e2']) assert.ok(Number.isNaN(parseRotationDraft(text)));
  assert.equal(parseRotationDraft('-12.3'), -12.3);
  assert.equal(rotationSettingsProblem({ ...raw.rotation, step: 0 }).property, 'step');
  assert.equal(rotationSettingsProblem({ ...raw.rotation, precision: -1 }).property, 'precision');
  assert.equal(rotationSettingsProblem({ ...raw.rotation, extra: true }).property, 'extra');
});

test('live updates are one history step, cancellation preserves redo, no-op adds nothing', async () => {
  const { session } = await makeSession();
  let edit = session.beginRotation();
  session.updateRotation(10, edit); session.updateRotation(20, edit); session.updateRotation(30, edit);
  assert.equal(session.getSnapshot().document.rotation, 30);
  assert.equal(session.getSnapshot().canUndo, true, 'Undo is usable during a first live edit');
  session.finishRotation(edit); session.undo();
  assert.equal(session.getSnapshot().document.rotation, 0);
  assert.equal(session.getSnapshot().canUndo, false);
  edit = session.beginRotation(); session.updateRotation(40, edit); assert.equal(session.getSnapshot().canRedo, false);
  session.cancelRotation(edit); assert.equal(session.getSnapshot().canRedo, true);
  session.redo(); assert.equal(session.getSnapshot().document.rotation, 30);
  edit = session.beginRotation(); session.updateRotation(50, edit); session.updateRotation(30, edit); session.finishRotation(edit);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 0, 'No-op gesture adds no extra undo step');
  session.dispose();
});

test('buttons finish a pending edit separately; Undo/Redo and save/load settle edits', async () => {
  const { session, saved } = await makeSession();
  let edit = session.beginRotation(); session.updateRotation(12.3, edit); session.rotateBy(90);
  assert.equal(session.getSnapshot().document.rotation, 102.3);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 12.3);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 0);
  session.redo(); assert.equal(session.getSnapshot().document.rotation, 12.3);
  edit = session.beginRotation(); session.updateRotation(22.4, edit); session.undo(); assert.equal(session.getSnapshot().document.rotation, 12.3);
  session.redo(); assert.equal(session.getSnapshot().document.rotation, 22.4);
  edit = session.beginRotation(); session.updateRotation(35.6, edit); await session.save();
  assert.equal(saved().transform.rotation, 35.6);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 22.4);
  edit = session.beginRotation(); session.updateRotation(18, edit); await session.load();
  assert.equal(session.getSnapshot().document.rotation, 0);
  assert.equal(session.getSnapshot().canUndo, false);
  session.dispose();
});

test('history reset, pending undo, disabled tracking and bounded history remain coherent', async () => {
  const history = new PhotoHistory({ rotation: 0 }, 1);
  history.updateEdit({ rotation: 10 }); history.undo();
  assert.equal(history.snapshot().document.rotation, 0);
  history.redo(); history.updateEdit({ rotation: 20 }); history.reset({ rotation: 0 });
  assert.deepEqual(history.snapshot(), { document: { rotation: 0 }, canUndo: false, canRedo: false });
  const { session, saved } = await makeSession(null);
  const edit = session.beginRotation(); session.updateRotation(24.5, edit); session.finishRotation(edit); await session.save();
  assert.equal(saved().transform.rotation, 24.5);
  assert.equal(session.getSnapshot().canUndo, false);
  session.dispose();
});

const validationRaw = structuredClone(raw);
validationRaw.instances = validationRaw.instances.filter((node) => ['fileControls', 'rotationControls'].includes(node.id));
const rotationNode = validationRaw.instances.find((node) => node.id === 'rotationControls');
const catalog = [
  { componentId: 'file.controls', filePath: 'action-bar/FileControls.jsx', folder: 'action-bar', Component() {},
    configKeys: ['labels', 'icons', 'order'], partKeys: ['load', 'reset', 'save'] },
  { componentId: 'photo.rotationControls', filePath: 'action-bar/RotationControls.jsx', folder: 'action-bar', Component() {},
    configKeys: ['unit', 'labels', 'icons', 'order'], partKeys: Object.keys(rotationNode.parts), partConfigKeys: { popup: ['portal'] }, requires: ['rotation', 'output'] },
];
const validate = (config) => {
  const diagnostics = createDiagnostics();
  return { plan: validateFrameConfig(config, catalog, diagnostics), issues: diagnostics.getSnapshot() };
};
test('current named parts/options validate and failures isolate exact owners', () => {
  assert.deepEqual(validate(validationRaw).issues, []);
  for (const [mutate, path] of [
    [(node) => { node.aspectRatio = 0; }, '.aspectRatio'],
    [(node) => { node.parts.value.colors = { foreground: 'red' }; }, '.parts.value.colors.foreground'],
    [(node) => { node.parts.typo = {}; }, '.parts.typo'],
    [(node) => { delete node.parts.value; }, '.parts.value'],
  ]) {
    const config = structuredClone(validationRaw), node = config.instances.find((value) => value.id === 'rotationControls');
    mutate(node);
    const { plan, issues } = validate(config);
    assert.ok(!plan.instances.some((value) => value.id === node.id));
    assert.ok(plan.instances.some((value) => value.id === 'fileControls'));
    assert.ok(issues.some((issue) => issue.instanceId === node.id && issue.configPath.endsWith(path) && issue.filePath));
  }
  const invalid = structuredClone(validationRaw); invalid.rotation.step = 0;
  const { plan, issues } = validate(invalid);
  assert.equal(plan.rotation, null);
  assert.ok(plan.instances.some((node) => node.id === 'fileControls'));
  assert.ok(!plan.instances.some((node) => node.componentId.startsWith('photo.rot')));
  assert.ok(issues.some((issue) => issue.configPath === 'rotation.step'));
});
