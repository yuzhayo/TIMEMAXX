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
  .filter((win) => !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.getURL().includes('/ui-control/view-built/index.html')).length);
const closeInput = async (page) => {
  const closed = page.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    return new Promise((resolve) => { win.once('closed', resolve); win.close(); });
  });
  await closed;
};
const captureNative = async (page, name, pair = false) => {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
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
  const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer, screen }, includeFrame) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    let bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    if (includeFrame) {
      const frame = win.getParentWindow().getBounds();
      bounds = { x: bounds.x, y: Math.min(bounds.y, frame.y), width: frame.x + frame.width - bounds.x,
        height: Math.max(bounds.y + bounds.height, frame.y + frame.height) - Math.min(bounds.y, frame.y) };
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {
      width: Math.round(display.bounds.width * display.scaleFactor), height: Math.round(display.bounds.height * display.scaleFactor) } });
    const source = sources.find((item) => item.display_id === String(display.id));
    if (!source) throw new Error('Input monitor is unavailable for native capture');
    const size = source.thumbnail.getSize(), xScale = size.width / display.bounds.width, yScale = size.height / display.bounds.height;
    const image = source.thumbnail.crop({ x: Math.round((bounds.x - display.bounds.x) * xScale),
      y: Math.round((bounds.y - display.bounds.y) * yScale), width: Math.round(bounds.width * xScale), height: Math.round(bounds.height * yScale) });
    return { png: image.toPNG().toString('base64'), visible: win.isVisible() };
  }, pair);
  assert.equal(native.visible, true);
  assert.ok(native.png, 'Native Input rectangle was captured');
  await fs.writeFile(path.join(artifacts, `${name}-native.png`), Buffer.from(native.png, 'base64'));
};
const checkInput = async (page, settings, name) => {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('main[aria-label="Input"]');
  await page.evaluate(() => window.inputDev?.inspect(false));
  await page.waitForFunction(() => document.querySelector('[data-input-stack]') !== null);
  assert.equal(await page.locator('[data-section-card]').count(), 2, 'Input renders the placeholder and language cards');
  assert.equal(await page.locator('[data-input-stack] > *').count(), 2, 'Input content area holds only configured section slots');
  assert.equal(await page.getByRole('combobox').count(), 1, 'the language section owns the only combobox');
  assert.equal(await page.locator('canvas, img, iframe').count(), 0);
  assert.deepEqual(await page.evaluate(() => ({ host: typeof window.frameHost, node: typeof require })),
    { host: 'undefined', node: 'undefined' });
  assert.deepEqual(await page.evaluate(() => Object.keys(window.inputHost).sort()), ['bootstrap', 'diagnostics']);
  const native = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    const preferences = win.webContents.getLastWebPreferences();
    const color = await win.webContents.capturePage({ x: 2, y: 50, width: 1, height: 1 });
    const frame = win.getParentWindow();
    return { title: win.getTitle(), bounds: win.getBounds(), contentBounds: win.getContentBounds(),
      area: screen.getDisplayMatching(frame.getBounds()).workArea, parent: frame.id, frame: frame.getBounds(),
      modal: win.isModal(), color: [...color.toBitmap().subarray(0, 4)],
      isolation: preferences.contextIsolation, node: preferences.nodeIntegration, sandbox: preferences.sandbox };
  });
  assert.equal(native.title, settings.title);
  assert.equal(native.bounds.width, Math.round(native.frame.width * settings.width.percent / 100));
  assert.equal(native.bounds.height, Math.round(native.area.height * settings.height.percent / 100));
  assert.equal(native.bounds.x + native.bounds.width, native.frame.x, 'Input touches the left boundary of Frame');
  assert.equal(native.bounds.y, native.area.y);
  assert.deepEqual(native.contentBounds, native.bounds, 'No native caption, border or Windows-Bar area is reserved');
  assert.equal(native.modal, false);
  assert.ok(native.parent);
  assert.equal(native.isolation, true); assert.equal(native.node, false); assert.equal(native.sandbox, true);
  const rgb = settings.background.slice(1).match(/../g).map((value) => parseInt(value, 16));
  assert.deepEqual(native.color, [rgb[2], rgb[1], rgb[0], 255], 'Input background consumes its JSON');
  const geometry = await page.evaluate(() => {
    const box = document.querySelector('main').getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
  });
  assert.equal(geometry.x, 0); assert.equal(geometry.y, 0);
  assert.deepEqual([geometry.width, geometry.height], geometry.viewport);
  assert.deepEqual(geometry.viewport, [native.bounds.width, native.bounds.height]);
  assert.deepEqual(geometry.scroll, geometry.viewport);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
  await captureNative(page, name);
  if (name === 'startup') await captureNative(page, 'input-beside-frame', true);
  metrics.push({ name, native, geometry });
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
  await checkInput(input, config.window, 'startup');
  assert.equal(await inputCount(), 1);

  // The baked placeholder: header toggles expand/collapse, body mounts inside, card stays compact.
  const cardGeometry = () => input.evaluate(() => {
    const card = document.querySelector('[data-instance="placeholder"] [data-section-card]');
    const body = document.querySelector('[data-instance="placeholder"] [data-section-body]');
    return { slot: card.parentElement.getBoundingClientRect().height, card: card.getBoundingClientRect().height,
      body: body ? body.getBoundingClientRect().height : 0,
      expanded: document.querySelector('[data-section-header]').getAttribute('aria-expanded') };
  });
  const open = await cardGeometry();
  assert.equal(open.expanded, 'true');
  assert.ok(open.body > 0, 'expanded body mounts inside the card');
  assert.ok(open.card < open.slot, 'card auto-compacts below its configured slot');
  await input.locator('[data-instance="placeholder"] [data-section-header]').click();
  const shut = await cardGeometry();
  assert.equal(shut.expanded, 'false', 'header click collapses the card');
  assert.equal(shut.body, 0, 'collapsed card removes the body');
  assert.ok(shut.card < open.card, 'collapsed card is shorter than expanded');
  await input.locator('[data-instance="placeholder"] [data-section-header]').click();
  assert.equal((await cardGeometry()).expanded, 'true', 'second click expands the card again');

  // The language section: its body hosts the global language dropdown.
  const select = input.locator('[data-instance="language"] [data-language-select]');
  assert.deepEqual(await select.locator('option').evaluateAll((options) => options.map((option) => option.value)),
    ['en', 'id'], 'the dropdown lists English and Indonesian');
  assert.equal(await select.evaluate((element) => element.value), 'en');
  const headerText = () => input.locator('[data-instance="language"] [data-section-header]').textContent();
  await select.selectOption('id');
  await input.waitForFunction(() => document.querySelector('[data-instance="language"] [data-section-header]')?.textContent === 'Bahasa');
  assert.equal(await input.evaluate(() => document.querySelector('main').getAttribute('lang')), 'id',
    'switching the dropdown swaps the whole locale layout');
  assert.equal((await input.evaluate(() => window.inputDev.snapshot())).language, 'id');
  await select.selectOption('en');
  assert.equal(await headerText(), 'Language', 'switching back restores the English layout');
  assert.equal((await input.evaluate(() => window.inputDev.snapshot())).expanded.language, true,
    'expand/collapse state survives a language switch');

  const firstId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/ui-control/view-built/index.html')).id);
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);
  assert.equal(await inputCount(), 1);
  const firstClosed = input.waitForEvent('close');
  await frame.click('#orphanEdit');
  await firstClosed;
  assert.equal(await inputCount(), 0);
  assert.equal(await frame.locator('#fileControls-save').isEnabled(), true);

  const frameConfig = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
  await app.evaluate(({ BrowserWindow }, settings) => BrowserWindow.getAllWindows()[0]
    .setSize(settings.minWidth, settings.minHeight), frameConfig.window);
  await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  [input] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  await checkInput(input, config.window, 'frame-minimum');
  assert.notEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/ui-control/view-built/index.html')).id), firstId);
  const minimumClosed = input.waitForEvent('close');
  await frame.click('#orphanEdit');
  await minimumClosed;
  await app.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds), frameBounds);
  await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);

  // Five simultaneous commands must finish open, preserving toggle parity and one live Input.
  const rapid = await frame.evaluate(() => Promise.all(Array.from({ length: 5 }, () => window.frameHost.toggleInputScreen())));
  assert.deepEqual(rapid, Array.from({ length: 5 }, (_, index) => ({ ok: true, visible: index % 2 === 0 })));
  assert.equal(await inputCount(), 1);
  input = app.windows().find((page) => !page.isClosed() && page.url().includes('/ui-control/view-built/index.html'));
  assert.ok(input);
  await checkInput(input, config.window, 'rapid-reopened');
  const rapidClosed = input.waitForEvent('close');
  await frame.click('#orphanEdit');
  await rapidClosed;
  assert.equal(await inputCount(), 0);

  // Alternate JSON proves Input geometry/color consumption without editing source config or siblings.
  const variant = structuredClone(config);
  variant.window.width.percent = 35;
  variant.window.background = '#285776';
  variant.root.colors = { background: '#285776' };
  const variantPath = path.join(artifacts, 'variant.json');
  await fs.writeFile(variantPath, JSON.stringify(variant));
  [input] = await Promise.all([app.waitForEvent('window'), app.evaluate(async ({ BrowserWindow, screen, ipcMain }, options) => {
    const require = process.getBuiltinModule('module').createRequire(options.modulePath);
    const { createInputScreen } = require(options.modulePath);
    globalThis.inputProofVariant = createInputScreen({ BrowserWindow, screen, ipcMain, development: true, inspectionRequested: true,
      parent: BrowserWindow.getAllWindows()[0], configPath: options.configPath });
    await globalThis.inputProofVariant.toggle();
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
    await frame.waitForFunction(() => window.frameDev.records().some((issue) => issue.code === 'INPUT_SCREEN_TOGGLE_FAILED'));
    assert.equal(await inputCount(), 0);
    assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot().document), before.document);
    assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot().view), before.view);
    assert.equal(await frame.locator('#fileControls-load').isEnabled(), true);
    const failure = await frame.evaluate(() => window.frameDev.records().find((issue) => issue.code === 'INPUT_SCREEN_TOGGLE_FAILED'));
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

  const [reopened] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  input = reopened;
  await input.waitForSelector('main[aria-label="Input"]');
  assert.equal(await inputCount(), 1, 'Input reopens after the isolated failure');
  assert.notEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/ui-control/view-built/index.html')).id), firstId);
  const records = await frame.evaluate(() => window.frameDev.records());
  assert.deepEqual(records.map((issue) => issue.code), ['INPUT_SCREEN_TOGGLE_FAILED']);
  assert.deepEqual(errors, []);
  await captureNative(input, 'reopened');
  const pencil = await frame.locator('#orphanEdit').evaluate((button) => {
    const box = button.getBoundingClientRect();
    return { fractionX: (box.x + box.width / 2) / innerWidth, fractionY: (box.y + box.height / 2) / innerHeight };
  });
  await fs.writeFile(path.join(artifacts, 'metrics.json'), JSON.stringify({ metrics, records, pencil }, null, 2));
  const inputClosed = input.waitForEvent('close');
  const frameClosed = frame.waitForEvent('close');
  const processExited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
  await frame.click('#windowClose');
  await Promise.all([inputClosed, frameClosed, processExited]);
  assert.equal(child.exitCode, 0);
  finished = true;
  console.log(JSON.stringify({ pass: true, checked: ['real pencil toggles frameless Input with the baked placeholder card',
    'header expands/collapses the card and mounts the body inside', 'card auto-compacts below its configured slot',
    'language section hosts a global English/Indonesian dropdown that swaps the locale layout',
    'expand/collapse state survives language switching',
    'scoped Input bootstrap and no Frame/file/data/preview bridge', 'rapid-click parity with one live window',
    '40% Frame width at startup/minimum', 'full work-area height', 'Input right edge touches Frame left edge',
    'no native caption or Windows-Bar space', 'JSON geometry/background without sibling changes', 'isolated Input configuration failure',
    'black export with invalid Input', 'no Frame/file/data/preview bridge', 'Input close leaves Frame alive', 'Frame close closes Input'], artifacts }, null, 2));
} finally {
  if (!finished) await app.close();
}
