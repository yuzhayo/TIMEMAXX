import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameSession } from '../logic/FrameSession.mjs';
import { createDiagnostics } from '../view/layout/LayoutDiagnostics.mjs';
import { EventEmitter } from 'node:events';
import inputScreen from '../../ui-control/screen.cjs';

const origin = { componentId: 'layout.orphanEdit', instanceId: 'orphanEdit', parentId: 'actionBar',
  filePath: 'action-bar/OrphanButton.jsx', configPath: 'instances[14]' };

test('toggling Input calls only its transport and leaves photo/history state unchanged', async () => {
  let opens = 0;
  const session = createFrameSession({ limit: 2 }, { document: { rotation: 15 },
    transport: { toggleInputScreen: async () => { opens++; return { ok: true }; } } });
  const before = session.getSnapshot();
  let publications = 0;
  session.subscribe(() => publications++);
  assert.equal(await session.toggleInputScreen(origin), true);
  assert.equal(opens, 1);
  assert.strictEqual(session.getSnapshot(), before);
  assert.equal(publications, 0);
  session.dispose();
});

test('Input toggle failure is reported with button identity without changing the document', async () => {
  for (const toggleInputScreen of [async () => ({ ok: false, error: 'Invalid Input configuration' }),
    async () => { throw new Error('Input page could not load'); }]) {
    const diagnostics = createDiagnostics();
    const session = createFrameSession({ limit: 2 }, { document: { rotation: 15 },
      transport: { toggleInputScreen }, diagnostics });
    assert.equal(await session.toggleInputScreen(origin), false);
    assert.deepEqual(session.getSnapshot().document, { rotation: 15 });
    const issue = diagnostics.getSnapshot()[0];
    assert.equal(issue.code, 'INPUT_SCREEN_TOGGLE_FAILED');
    for (const [key, value] of Object.entries(origin)) assert.equal(issue[key], value);
    assert.match(issue.actual, /Input/);
    session.dispose();
  }
});

test('Input capability is absent when its host transport is unavailable', () => {
  const session = createFrameSession({ limit: 2 }, { document: { rotation: 15 } });
  assert.equal(session.toggleInputScreen, undefined);
  session.dispose();
});

test('Input bounds use Frame width and monitor work area, adjoining its left boundary', () => {
  const settings = { width: { base: 'frame', percent: 40 }, height: { base: 'workArea', percent: 100 },
    placement: { x: 'beforeFrame', y: 'workAreaStart' } };
  const frame = { x: 1626, y: 240, width: 934, height: 960 };
  const area = { x: 0, y: 0, width: 2560, height: 1366 };
  assert.deepEqual(inputScreen.inputWindowBounds(frame, area, settings), { x: 1252, y: 0, width: 374, height: 1366 });
  assert.deepEqual(inputScreen.inputWindowBounds({ ...frame, x: 1800, width: 760 }, area, settings),
    { x: 1496, y: 0, width: 304, height: 1366 });
  assert.deepEqual(inputScreen.inputWindowBounds({ x: -934, y: 40, width: 934, height: 960 },
    { x: -2560, y: -40, width: 2560, height: 1400 }, settings), { x: -1308, y: -40, width: 374, height: 1400 });
});

test('Input never invents another position when there is no room beside Frame', () => {
  assert.throws(() => inputScreen.inputWindowBounds({ x: 100, y: 0, width: 934, height: 960 },
    { x: 0, y: 0, width: 2560, height: 1366 }, { width: { base: 'frame', percent: 40 },
      height: { base: 'workArea', percent: 100 }, placement: { x: 'beforeFrame', y: 'workAreaStart' } }), /room.*left.*Frame/i);
});

test('rapid open/close toggles serialize loading, preserve parity and recover after a load failure', async () => {
  let finishLoad, loaded;
  const loading = new Promise((resolve) => { loaded = resolve; });
  let live = 0, peak = 0, fail = false;
  class NativeWindow extends EventEmitter {
    constructor() {
      super(); live++; peak = Math.max(peak, live);
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = () => {};
    }
    isDestroyed() { return Boolean(this.destroyed); }
    setMenu() {}
    loadFile() {
      if (fail) return Promise.reject(new Error('Input load failed'));
      if (finishLoad) return Promise.resolve();
      loaded();
      return new Promise((resolve) => { finishLoad = resolve; });
    }
    show() {}
    focus() {}
    close() { this.destroyed = true; live--; this.emit('closed'); }
  }
  const controller = inputScreen.createInputScreen({ BrowserWindow: NativeWindow,
    ipcMain: { handle() {}, removeHandler() {} },
    screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) },
    parent: { isDestroyed: () => false, getBounds: () => ({ x: 1120, y: 0, width: 800, height: 1040 }) } });
  const toggles = Promise.all([controller.toggle(), controller.toggle()]);
  await loading;
  finishLoad();
  assert.deepEqual(await toggles, [{ visible: true }, { visible: false }]);
  assert.equal(live, 0); assert.equal(peak, 1);
  assert.deepEqual(await Promise.all(Array.from({ length: 3 }, () => controller.toggle())),
    [{ visible: true }, { visible: false }, { visible: true }]);
  assert.equal(live, 1); assert.equal(peak, 1);
  controller.close();
  fail = true;
  await assert.rejects(controller.toggle(), /Input load failed/);
  assert.equal(live, 0);
  fail = false;
  assert.deepEqual(await controller.toggle(), { visible: true });
  controller.close();
  assert.equal(live, 0);
});
