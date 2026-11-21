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
  await page.waitForFunction(() => document.querySelectorAll('[data-section-card]').length === 4);
  assert.equal(await page.locator('[data-section-card]').count(), 4, 'Input renders the four approved foundation sections');
  assert.deepEqual(await page.locator('[data-section-title]').allTextContents(), ['Language', 'Code', 'Date', 'Time']);
  assert.equal(await page.locator('[data-card-renderer="shared-mui"]').count(), 4);
  assert.equal(await page.getByRole('combobox').count(), 1);
  for (const id of ['code', 'date', 'time']) assert.equal(await page.locator(`#${id} [data-card-content] > *`).count(), 0, `${id} business content remains deferred`);
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

const checkFoundation = async (page) => {
  const baseline = await page.evaluate(() => structuredClone(window.inputDev.config));
  const headers = () => page.locator('[data-section-title]').allTextContents();
  const blurHeaders = () => page.mouse.move(2, 1000);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Indonesia', exact: true }).click();
  await page.waitForFunction(() => window.inputDev.snapshot().language === 'id');
  assert.deepEqual(await headers(), ['Bahasa', 'Kode', 'Tanggal', 'Waktu']);
  await page.evaluate(() => { window.inputProofContent = document.querySelector('#language [data-card-content]'); });
  const expandedHeight = (await page.locator('[data-instance="code"]').boundingBox()).height;
  await page.locator('#code-heading').click();
  await page.waitForFunction(() => document.getElementById('code-heading').getAttribute('aria-expanded') === 'false');
  assert.ok((await page.locator('[data-instance="code"]').boundingBox()).height < expandedHeight / 2);
  assert.equal(await page.locator('#date-heading').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#time-heading').getAttribute('aria-expanded'), 'true');
  await page.locator('#language-heading').click();
  await page.waitForFunction(() => document.getElementById('language-heading').getAttribute('aria-expanded') === 'false');
  assert.equal(await page.evaluate(() => window.inputDev.snapshot().language), 'id');
  assert.equal(await page.evaluate(() => window.inputProofContent === document.querySelector('#language [data-card-content]')), true, 'Collapse keeps content mounted');
  await page.locator('#language-heading').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('language-heading').getAttribute('aria-expanded') === 'true');
  assert.equal(await page.getByRole('combobox').textContent(), 'Indonesia');
  assert.equal(await page.locator('#code-heading').getAttribute('aria-expanded'), 'false');
  await page.locator('#code-heading').click();
  await blurHeaders();

  const variant = structuredClone(baseline);
  variant.layouts.id.order = ['language', 'time', 'date', 'code'];
  variant.layouts.id.sections.code = { label: 'Kode', bounds: { width: 80, height: 16 }, parts: { header: { colors: { background: '#285776' } } } };
  await page.evaluate((config) => window.inputDev.reconfigure(config), variant);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('code-heading')).backgroundColor === 'rgb(40, 87, 118)');
  assert.deepEqual(await page.locator('[data-instance]').evaluateAll((nodes) => nodes.map((node) => node.dataset.instance)), variant.layouts.id.order);
  const parentWidth = (await page.locator('[data-input-stack]').boundingBox()).width;
  assert.ok(Math.abs((await page.locator('[data-instance="code"]').boundingBox()).width - parentWidth * 0.8) < 1, 'Section width is parent relative');
  assert.equal(await page.locator('#date-heading').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(29, 37, 47)');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  assert.deepEqual(await headers(), ['Language', 'Code', 'Date', 'Time']);
  assert.equal(await page.locator('#code-heading').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(29, 37, 47)', 'Indonesian layout override does not alter English');

  const shared = structuredClone(baseline);
  shared.presets.sectionHeader.colors.background = '#2c6180';
  await page.evaluate((config) => window.inputDev.reconfigure(config), shared);
  await blurHeaders();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-section-card] button')].every((node) => getComputedStyle(node).backgroundColor === 'rgb(44, 97, 128)'));
  assert.equal(await page.locator('[data-section-card]').count(), 4);
  await page.screenshot({ path: path.join(artifacts, 'shared-card-preset.png') });
  await page.evaluate((config) => window.inputDev.reconfigure(config), baseline);
  await page.evaluate(() => window.inputDev.inspect(true));
  assert.equal(await page.locator('[data-inspection]').count(), 4);
  assert.match(await page.locator('[data-inspection="code"]').textContent(), /input.code.*code.*inputRoot.*code\/CodeSection.jsx/);
  assert.equal(await page.locator('[data-inspection="code"]').evaluate((node) => getComputedStyle(node).pointerEvents), 'none');
  await page.evaluate(() => window.inputDev.inspect(false));

  const invalid = structuredClone(baseline);
  invalid.sections[1].parts = { header: { colors: { background: 'not-a-color' } } };
  await page.evaluate((config) => window.inputDev.reconfigure(config), invalid);
  await page.waitForFunction(() => document.querySelectorAll('[data-section-card]').length === 3);
  assert.equal(await page.locator('#language-heading').isEnabled(), true);
  assert.equal(await page.locator('#date-heading').isEnabled(), true);
  const records = await page.evaluate(() => window.inputDev.records());
  assert.ok(records.some((issue) => issue.code === 'INPUT_VISUAL_INVALID' && issue.instanceId === 'code' && issue.filePath === 'code/CodeSection.jsx'));
  assert.ok(records.every((issue) => issue.code === 'INPUT_VISUAL_INVALID'));
  assert.match(await page.locator('[data-input-diagnostics]').textContent(), /code/i);
  assert.equal(await page.locator('[data-input-diagnostics]').evaluate((node) => node.scrollWidth <= node.clientWidth), true, 'Diagnostics wrap without horizontal scrolling');
  await page.evaluate(() => window.inputDev.flush());
  const logPath = await page.evaluate(() => window.inputDev.logPath);
  const persisted = JSON.parse(await fs.readFile(logPath, 'utf8'));
  assert.ok(persisted.some((issue) => issue.instanceId === 'code'));
  await page.evaluate((config) => window.inputDev.reconfigure(config), baseline);
  await page.waitForFunction(() => document.querySelectorAll('[data-section-card]').length === 4);
  await page.screenshot({ path: path.join(artifacts, 'foundation-en-restored.png') });
  await page.evaluate(() => window.inputDev.setLanguage('id'));
  await page.screenshot({ path: path.join(artifacts, 'foundation-id.png') });
  await page.evaluate(() => window.inputDev.setLanguage('en'));
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
  await checkFoundation(input);
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
  console.log(JSON.stringify({ pass: true, checked: ['real pencil toggles four-section frameless Input', 'shared MUI cards and scoped Input bootstrap',
    'global language dropdown and independent locale layouts', 'keyboard/click collapse preserves selection and mounted content',
    'shared card preset updates all four headers', 'section parent percentages and sibling isolation', 'invalid UI section logged and isolated', 'development inspection', 'rapid-click parity with one live window',
    '25% Frame width at startup/minimum', 'full work-area height', 'Input right edge touches Frame left edge',
    'no native caption or Windows-Bar space', 'JSON geometry/background without sibling changes', 'isolated Input configuration failure',
    'black export with invalid Input', 'no Frame/file/data/preview bridge', 'Input close leaves Frame alive', 'Frame close closes Input'], artifacts }, null, 2));
} finally {
  if (!finished) await app.close();
}
