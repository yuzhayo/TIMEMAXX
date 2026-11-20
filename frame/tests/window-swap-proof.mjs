import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const runtime = path.join(root, '.runtime');
const artifacts = path.join(runtime, 'checks/window-swap');
await fs.mkdir(artifacts, { recursive: true });
const sessionsBefore = new Set((await fs.readdir(runtime)).filter((name) => name.startsWith('image-session-')));
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
config.window.title = 'Frame window-swap proof';
const configPath = path.join(artifacts, 'proof-config.json');
await fs.writeFile(configPath, JSON.stringify(config, null, 2));
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout', `--config=${configPath}`], cwd: root, timeout: 20000 });
const errors = [];
const checked = [];
let closed = false;

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#windowClose');
  await page.evaluate(() => window.frameDev.inspect(false));
   assert.equal(await page.locator('#actionBar #fileControls #fileControls-load, #actionBar #fileControls #fileControls-save').count(), 2);
  assert.equal(await page.locator('#windowsBar #undo, #windowsBar #redo').count(), 2);
   assert.equal(await page.locator('#windowsBar #fileControls-load, #windowsBar #fileControls-save, #actionBar #undo, #actionBar #redo').count(), 0);
  assert.equal(await page.locator('#windowsBar #windowClose').count(), 1);
  assert.equal(await page.evaluate(() => Boolean(navigator.windowControlsOverlay?.visible)), false, 'Native overlay, including native X, is absent');
   for (const id of ['fileControls-load', 'fileControls-save', 'windowClose']) {
    assert.equal(await page.locator(`#${id}`).getAttribute('data-button-renderer'), 'shared-action');
   }
   assert.equal(await page.locator('#windowMinimize, #windowMaximize').count(), 0, 'Only X remains among window buttons');
   assert.equal(await page.evaluate(() => window.frameDev.catalog.filter((entry) => entry.componentId === 'file.controls').length), 1);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  checked.push('swapped folders/parents; one shared renderer across Action Bar and Windows Bar; native overlay hidden');

  const rejected = await page.evaluate(() => window.frameHost.windowAction('destroy'));
  assert.equal(rejected.ok, false);
   await page.evaluate(() => window.frameHost.windowAction('toggleMaximize'));
  await page.waitForFunction(() => window.frameDev.snapshot().windowState.maximized === true);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
   await page.evaluate(() => window.frameHost.windowAction('toggleMaximize'));
  await page.waitForFunction(() => window.frameDev.snapshot().windowState.maximized === false);
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    globalThis.minimizeProof = new Promise((resolve) => win.once('minimize', () => resolve(win.isMinimized())));
  });
   await page.evaluate(() => window.frameHost.windowAction('minimize'));
  assert.equal(await app.evaluate(() => globalThis.minimizeProof), true);
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.restore(); win.show(); win.focus(); });
  await page.waitForFunction(() => window.frameDev.snapshot().windowState.minimized === false);
   checked.push('Minimize/Maximize buttons hidden; underlying native operations retained; unsupported method rejected');

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#285776'; context.fillRect(0, 0, 300, 400);
    context.fillStyle = '#e9bc67'; context.fillRect(50, 50, 200, 150);
    context.fillStyle = '#26313c'; context.font = 'bold 24px sans-serif'; context.textAlign = 'center';
    context.fillText('FRAME', 150, 120);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = path.join(artifacts, 'source.png');
  await fs.writeFile(source, Buffer.from(png, 'base64'));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
   await page.click('#fileControls-load');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Loaded ') && !window.frameDev.snapshot().busy);
  const loaded = await page.evaluate(() => window.frameDev.snapshot().document);
  await page.evaluate((document) => window.frameDev.commit({ ...document, rotation: 15 }), loaded);
  await page.click('#undo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 0);
  await page.click('#redo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 15);
  await page.click('#undo');
  const destination = path.join(artifacts, 'export.png');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, destination);
   await page.click('#fileControls-save');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
  assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), destination), { width: 1200, height: 1600 });
  checked.push('real Load/Save after relocation; Undo/Redo act on the loaded photo document');

  for (const [name, width, height] of [['default', config.window.width, config.window.height], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.mouse.move(width / 2, height / 2);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => Object.fromEntries(['load', 'save', 'windowClose'].map((id) => {
      const element = document.getElementById(['load', 'save'].includes(id) ? `fileControls-${id}` : id), rect = element.getBoundingClientRect(), icon = element.querySelector('svg').getBoundingClientRect(), style = getComputedStyle(element);
      return [id, { text: element.innerText, parent: element.closest('[data-parent]').dataset.parent, background: style.backgroundColor, color: style.color, border: style.borderColor,
        x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom,
        dx: icon.x + icon.width / 2 - rect.x - rect.width / 2, dy: icon.y + icon.height / 2 - rect.y - rect.height / 2 }];
    })));
    for (const value of Object.values(metrics)) {
      assert.equal(value.text, '');
      assert.ok(value.x >= 0 && value.y >= 0 && value.right <= width && value.bottom <= height);
      assert.ok(Math.abs(value.dx) < 1 && Math.abs(value.dy) < 1);
    }
    assert.equal(metrics.load.parent, 'actionBar');
    assert.equal(metrics.windowClose.parent, 'windowsBar');
   for (const property of ['background', 'color', 'border']) {
      assert.equal(metrics.load[property], metrics.save[property]);
      assert.equal(metrics.load[property], metrics.windowClose[property]);
   }
   const edges = await page.evaluate(() => {
     const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
     const action = rect('#actionBar [data-section-content]'), windows = rect('#windowsBar [data-section-content]');
     const group = rect('#fileControls'), save = rect('#fileControls-save'), close = rect('#windowClose');
     return { group: (action.right - group.right) / action.width * 100, save: (action.right - save.right) / action.width * 100,
       close: (windows.right - close.right) / windows.width * 100 };
   });
   for (const gap of Object.values(edges)) assert.ok(Math.abs(gap - 1) < 0.02, 'Group, Save and X finish 1% from their bar edge');
    await page.screenshot({ path: path.join(artifacts, `swapped-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === win.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native);
    await fs.writeFile(path.join(artifacts, `swapped-${name}-native.png`), Buffer.from(native, 'base64'));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
   checked.push('same shared Load/Save/X rendering; baked file group, Save and X have 1% right margins at both sizes');

  const ownedSessions = (await fs.readdir(runtime)).filter((name) => name.startsWith('image-session-') && !sessionsBefore.has(name));
  assert.equal(ownedSessions.length, 1);
  const process = app.process();
  const exited = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Custom X did not finish normal process/worker cleanup')), 15000);
    process.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
  });
  await page.click('#windowClose').catch((error) => { if (!/closed/i.test(error.message)) throw error; });
  const result = await exited;
  closed = true;
  assert.equal(result.code, 0);
  for (const name of ownedSessions) await assert.rejects(fs.stat(path.join(runtime, name)), { code: 'ENOENT' });
  checked.push('custom X exits normally and completes worker/session-directory cleanup');
  console.log(JSON.stringify({ pass: true, checked, artifacts }, null, 2));
} finally {
  if (!closed) await app.close();
}
