import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const inputRoot = path.resolve(root, '../ui-control');
const inputConfigPath = path.join(inputRoot, 'config.json');
const config = JSON.parse(await fs.readFile(inputConfigPath, 'utf8'));
const artifacts = path.join(root, '.runtime/checks/input-screen');
await fs.mkdir(artifacts, { recursive: true });
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const app = await _electron.launch({ executablePath: require('electron'),
  args: [root, '--layout-proof', '--inspect-layout'], cwd: root, timeout: 20000 });
const child = app.process();
const errors = [];
const metrics = [];
let finished = false;

const inputCount = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
  .filter((win) => !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.getURL().includes('/InputScreen.html')).length);
const closeInput = async (page) => {
  const closed = page.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/InputScreen.html'));
    return new Promise((resolve) => { win.once('closed', resolve); win.close(); });
  });
  await closed;
};
const captureNative = async (page, name) => {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/InputScreen.html'));
    win.show(); win.focus();
  });
  // Allow the native show/resize animation to settle for visual evidence only.
  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const next = () => { if (++frames === 20) resolve(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }));
  // Windows omits owned child windows from window-source inventory. Retain only
  // Input's exact native rectangle; the rest of the monitor is never written.
  const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer, screen }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/InputScreen.html'));
    const bounds = win.getBounds(), display = screen.getDisplayMatching(bounds);
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {
      width: Math.round(display.bounds.width * display.scaleFactor), height: Math.round(display.bounds.height * display.scaleFactor) } });
    const source = sources.find((item) => item.display_id === String(display.id));
    if (!source) throw new Error('Input monitor is unavailable for native capture');
    const size = source.thumbnail.getSize(), xScale = size.width / display.bounds.width, yScale = size.height / display.bounds.height;
    const image = source.thumbnail.crop({ x: Math.round((bounds.x - display.bounds.x) * xScale),
      y: Math.round((bounds.y - display.bounds.y) * yScale), width: Math.round(bounds.width * xScale), height: Math.round(bounds.height * yScale) });
    return { png: image.toPNG().toString('base64'), visible: win.isVisible() };
  });
  assert.equal(native.visible, true);
  assert.ok(native.png, 'Native Input rectangle was captured');
  await fs.writeFile(path.join(artifacts, `${name}-native.png`), Buffer.from(native.png, 'base64'));
};
const checkInput = async (page, settings, name) => {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('main[aria-label="Input"]');
  assert.equal(await page.locator('main').textContent(), '');
  assert.equal(await page.locator('main > *').count(), 0);
  assert.equal(await page.locator('input, textarea, select, button, canvas, img, iframe').count(), 0);
  assert.deepEqual(await page.evaluate(() => ({ host: typeof window.frameHost, node: typeof require })),
    { host: 'undefined', node: 'undefined' });
  const native = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/InputScreen.html'));
    const preferences = win.webContents.getLastWebPreferences();
    const color = await win.webContents.capturePage({ x: 50, y: 50, width: 1, height: 1 });
    return { title: win.getTitle(), bounds: win.getBounds(), minimum: win.getMinimumSize(),
      area: screen.getDisplayMatching(win.getBounds()).workArea, parent: win.getParentWindow()?.id,
      modal: win.isModal(), color: [...color.toBitmap().subarray(0, 4)],
      isolation: preferences.contextIsolation, node: preferences.nodeIntegration, sandbox: preferences.sandbox };
  });
  assert.equal(native.title, settings.title);
  assert.equal(native.bounds.width, Math.min(settings.width, native.area.width));
  assert.equal(native.bounds.height, Math.min(settings.height, native.area.height));
  assert.deepEqual(native.minimum, [Math.min(settings.minWidth, native.area.width), Math.min(settings.minHeight, native.area.height)]);
  assert.equal(native.modal, false);
  assert.ok(native.parent);
  assert.equal(native.isolation, true); assert.equal(native.node, false); assert.equal(native.sandbox, true);
  const rgb = settings.background.slice(1).match(/../g).map((value) => parseInt(value, 16));
  assert.deepEqual(native.color, [rgb[2], rgb[1], rgb[0], 255], 'Input background consumes its JSON');
  for (const [sizeName, width, height] of [['startup', native.bounds.width, native.bounds.height], ['minimum', ...native.minimum]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()
      .find((win) => win.webContents.getURL().includes('/InputScreen.html')).setSize(...size), [width, height]);
    const geometry = await page.evaluate(() => {
      const box = document.querySelector('main').getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, viewport: [innerWidth, innerHeight],
        scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
    });
    assert.equal(geometry.x, 0); assert.equal(geometry.y, 0);
    assert.deepEqual([geometry.width, geometry.height], geometry.viewport);
    assert.deepEqual(geometry.scroll, geometry.viewport);
    await page.screenshot({ path: path.join(artifacts, `${name}-${sizeName}.png`) });
    if (name === 'default') await captureNative(page, `${name}-${sizeName}`);
    metrics.push({ name, sizeName, native, geometry });
  }
};

try {
  const frame = await app.firstWindow();
  frame.on('pageerror', (error) => errors.push(error.message));
  await frame.waitForSelector('#orphanEdit');
  await frame.evaluate(() => window.frameDev.inspect(false));
  assert.equal(await inputCount(), 0, 'Input is not created at Frame startup');
  const before = await frame.evaluate(() => window.frameDev.snapshot());
  const frameBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  let [input] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  await checkInput(input, config.window, 'default');
  const firstId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/InputScreen.html')).id);
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);
  assert.equal(await inputCount(), 1);
  await frame.click('#orphanEdit');
  assert.deepEqual(await frame.evaluate(() => Promise.all(Array.from({ length: 8 }, () => window.frameHost.openInputScreen()))),
    Array.from({ length: 8 }, () => ({ ok: true })));
  assert.equal(await inputCount(), 1);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/InputScreen.html')).id), firstId);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/InputScreen.html')).isVisible()), true);
  await closeInput(input);
  assert.equal(await inputCount(), 0);
  assert.equal(await frame.locator('#fileControls-save').isEnabled(), true);

  // Alternate JSON proves Input geometry/color consumption without editing source config or siblings.
  const variant = structuredClone(config);
  Object.assign(variant.window, { title: 'Input JSON proof', width: 640, height: 640, minWidth: 320, minHeight: 320, background: '#285776' });
  const variantPath = path.join(artifacts, 'variant.json');
  await fs.writeFile(variantPath, JSON.stringify(variant));
  [input] = await Promise.all([app.waitForEvent('window'), app.evaluate(async ({ BrowserWindow, screen }, options) => {
    const require = process.getBuiltinModule('module').createRequire(options.modulePath);
    const { createInputScreen } = require(options.modulePath);
    globalThis.inputProofVariant = createInputScreen({ BrowserWindow, screen,
      parent: BrowserWindow.getAllWindows()[0], configPath: options.configPath });
    await globalThis.inputProofVariant.open();
  }, { modulePath: path.join(inputRoot, 'screen.cjs'), configPath: variantPath })]);
  await checkInput(input, variant.window, 'config-variation');
  await closeInput(input);
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()), frameBounds);
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);

  // Fault only the Input JSON read at the native I/O boundary. Never modify the real file.
  await app.evaluate((_, configPath) => {
    const fs = process.getBuiltinModule('fs');
    globalThis.inputProofRead = fs.readFileSync;
    fs.readFileSync = function (file, ...args) {
      return String(file) === configPath ? '{"schemaVersion":1,"window":{"width":-1}}' : globalThis.inputProofRead.call(this, file, ...args);
    };
  }, inputConfigPath);
  try {
    await frame.click('#orphanEdit');
    await frame.waitForFunction(() => window.frameDev.records().some((issue) => issue.code === 'INPUT_SCREEN_OPEN_FAILED'));
    assert.equal(await inputCount(), 0);
    assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot().document), before.document);
    assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot().view), before.view);
    assert.equal(await frame.locator('#fileControls-load').isEnabled(), true);
    const failure = await frame.evaluate(() => window.frameDev.records().find((issue) => issue.code === 'INPUT_SCREEN_OPEN_FAILED'));
    assert.equal(failure.instanceId, 'orphanEdit');
    assert.match(failure.actual, /invalid Input window settings/);
    assert.match(await frame.locator('#fileStatus').textContent(), /Input/);
    const destination = path.join(artifacts, 'black-with-invalid-input.png');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, destination);
    await frame.click('#fileControls-save');
    await frame.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
    assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), destination), { width: 1200, height: 1600 });
  } finally {
    await app.evaluate(() => { const fs = process.getBuiltinModule('fs'); fs.readFileSync = globalThis.inputProofRead; delete globalThis.inputProofRead; });
  }

  const [reopened, results] = await Promise.all([app.waitForEvent('window'),
    frame.evaluate(() => Promise.all(Array.from({ length: 8 }, () => window.frameHost.openInputScreen())))]);
  assert.deepEqual(results, Array.from({ length: 8 }, () => ({ ok: true })));
  input = reopened;
  await input.waitForSelector('main[aria-label="Input"]');
  assert.equal(await inputCount(), 1, 'Concurrent reopening creates only one window');
  assert.notEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/InputScreen.html')).id), firstId);
  const records = await frame.evaluate(() => window.frameDev.records());
  assert.deepEqual(records.map((issue) => issue.code), ['INPUT_SCREEN_OPEN_FAILED']);
  assert.deepEqual(errors, []);
  await captureNative(input, 'reopened');
  await fs.writeFile(path.join(artifacts, 'metrics.json'), JSON.stringify({ metrics, records }, null, 2));
  const inputClosed = input.waitForEvent('close');
  const frameClosed = frame.waitForEvent('close');
  const processExited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
  await frame.click('#windowClose');
  await Promise.all([inputClosed, frameClosed, processExited]);
  assert.equal(child.exitCode, 0);
  finished = true;
  console.log(JSON.stringify({ pass: true, checked: ['real pencil opens empty Input', 'single-window reuse and concurrent reopening',
    'startup/minimum fill', 'JSON geometry/background without sibling changes', 'isolated Input configuration failure',
    'black export with invalid Input', 'no renderer bridge/data/preview', 'Input close leaves Frame alive', 'Frame close closes Input'], artifacts }, null, 2));
} finally {
  if (!finished) await app.close();
}
