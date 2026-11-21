import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameSession } from '../logic/FrameSession.mjs';
import { createDiagnostics } from '../view/layout/LayoutDiagnostics.mjs';

const origin = { componentId: 'layout.orphanEdit', instanceId: 'orphanEdit', parentId: 'actionBar',
  filePath: 'action-bar/OrphanButton.jsx', configPath: 'instances[14]' };

test('opening Input calls only its transport and leaves photo/history state unchanged', async () => {
  let opens = 0;
  const session = createFrameSession({ limit: 2 }, { document: { rotation: 15 },
    transport: { openInputScreen: async () => { opens++; return { ok: true }; } } });
  const before = session.getSnapshot();
  let publications = 0;
  session.subscribe(() => publications++);
  assert.equal(await session.openInputScreen(origin), true);
  assert.equal(opens, 1);
  assert.strictEqual(session.getSnapshot(), before);
  assert.equal(publications, 0);
  session.dispose();
});

test('Input open failure is reported with button identity without changing the document', async () => {
  for (const openInputScreen of [async () => ({ ok: false, error: 'Invalid Input configuration' }),
    async () => { throw new Error('Input page could not load'); }]) {
    const diagnostics = createDiagnostics();
    const session = createFrameSession({ limit: 2 }, { document: { rotation: 15 },
      transport: { openInputScreen }, diagnostics });
    assert.equal(await session.openInputScreen(origin), false);
    assert.deepEqual(session.getSnapshot().document, { rotation: 15 });
    const issue = diagnostics.getSnapshot()[0];
    assert.equal(issue.code, 'INPUT_SCREEN_OPEN_FAILED');
    for (const [key, value] of Object.entries(origin)) assert.equal(issue[key], value);
    assert.match(issue.actual, /Input/);
    session.dispose();
  }
});

test('Input capability is absent when its host transport is unavailable', () => {
  const session = createFrameSession({ limit: 2 }, { document: { rotation: 15 } });
  assert.equal(session.openInputScreen, undefined);
  session.dispose();
});
