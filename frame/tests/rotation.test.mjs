import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PhotoHistory } from '../logic/PhotoHistory.mjs';
import { createFrameSession } from '../logic/FrameSession.mjs';
import { normalizeRotation, parseRotationDraft, rotationSettingsProblem } from '../logic/PhotoOperations.mjs';
import { validateFrameConfig } from '../view/layout/ConfigValidation.mjs';
import { createDiagnostics } from '../view/layout/LayoutDiagnostics.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const makeSession = async (history = raw.history) => {
  let saved;
  const session = createFrameSession(history, {
    document: raw.document, output: raw.output, rotation: raw.rotation,
    transport: {
      openImage: async () => ({ ok: true, result: { photoId: 'photo', name: 'test.png', width: 600, height: 800, preview: new Uint8Array() } }),
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
  session.updateRotation(10); session.updateRotation(20); session.updateRotation(30);
  assert.equal(session.getSnapshot().document.rotation, 30);
  assert.equal(session.getSnapshot().canUndo, true, 'Undo is usable during a first live edit');
  session.finishRotation(); session.undo();
  assert.equal(session.getSnapshot().document.rotation, 0);
  assert.equal(session.getSnapshot().canUndo, false);
  session.updateRotation(40); assert.equal(session.getSnapshot().canRedo, false);
  session.cancelRotation(); assert.equal(session.getSnapshot().canRedo, true);
  session.redo(); assert.equal(session.getSnapshot().document.rotation, 30);
  session.updateRotation(50); session.updateRotation(30); session.finishRotation();
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 0, 'No-op gesture adds no extra undo step');
  session.dispose();
});

test('buttons finish a pending edit separately; Undo/Redo and save/load settle edits', async () => {
  const { session, saved } = await makeSession();
  session.updateRotation(12.3); session.rotateBy(90);
  assert.equal(session.getSnapshot().document.rotation, 102.3);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 12.3);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 0);
  session.redo(); assert.equal(session.getSnapshot().document.rotation, 12.3);
  session.updateRotation(22.4); session.undo(); assert.equal(session.getSnapshot().document.rotation, 12.3);
  session.redo(); assert.equal(session.getSnapshot().document.rotation, 22.4);
  session.updateRotation(35.6); await session.save();
  assert.equal(saved().transform.rotation, 35.6);
  session.undo(); assert.equal(session.getSnapshot().document.rotation, 22.4);
  session.updateRotation(18); await session.load();
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
  session.updateRotation(24.5); session.finishRotation(); await session.save();
  assert.equal(saved().transform.rotation, 24.5);
  assert.equal(session.getSnapshot().canUndo, false);
  session.dispose();
});

const catalog = raw.instances.map((node) => ({ componentId: node.componentId, filePath: `${node.parentId === 'actionBar' ? 'action-bar' : node.parentId === 'windowsBar' ? 'windows-bar' : node.parentId === 'frameBody' ? 'frame-body' : 'bottom-bar'}/${node.id}.jsx`,
  folder: node.parentId === 'actionBar' ? 'action-bar' : node.parentId === 'windowsBar' ? 'windows-bar' : node.parentId === 'frameBody' ? 'frame-body' : 'bottom-bar', Component() {},
  configKeys: ['icon', 'action', 'maximizedIcon', 'unit', 'textSizing', 'presentation'], partKeys: Object.keys(node.parts ?? {}),
  requires: node.componentId.startsWith('photo.rot') ? ['rotation'] : [],
})).filter((node, index, nodes) => nodes.findIndex((other) => other.componentId === node.componentId) === index);
const validate = (config) => {
  const diagnostics = createDiagnostics();
  return { plan: validateFrameConfig(config, catalog, diagnostics), issues: diagnostics.getSnapshot() };
};
test('named parts/active state/ratio validate and failures isolate exact owners', () => {
  assert.deepEqual(validate(raw).issues, []);
  for (const [mutate, path] of [
    [(node) => { node.aspectRatio = 0; }, '.aspectRatio'],
    [(node) => { node.parts.input.colors = { foreground: 'red' }; }, '.parts.input.colors.foreground'],
    [(node) => { node.parts.typo = {}; }, '.parts.typo'],
    [(node) => { delete node.parts.input; }, '.parts.input'],
  ]) {
    const config = structuredClone(raw), node = config.instances.find((value) => value.id === 'rotationInput');
    mutate(node);
    const { plan, issues } = validate(config);
    assert.ok(!plan.instances.some((value) => value.id === node.id));
    assert.ok(plan.instances.some((value) => value.id === 'save'));
    assert.ok(issues.some((issue) => issue.instanceId === node.id && issue.configPath.endsWith(path) && issue.filePath));
  }
  const invalid = structuredClone(raw); invalid.rotation.step = 0;
  const { plan, issues } = validate(invalid);
  assert.equal(plan.rotation, null);
  assert.ok(plan.instances.some((node) => node.id === 'load'));
  assert.ok(!plan.instances.some((node) => node.componentId.startsWith('photo.rot')));
  assert.ok(issues.some((issue) => issue.configPath === 'rotation.step'));
});
