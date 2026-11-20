import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
const folder = path.join(root, '.runtime/checks/bottom-bar');
await fs.mkdir(folder, { recursive: true });
const filename = `${'Bottom Bar multiline photo message '.repeat(5).trim()}.png`;
const photo = path.join(folder, filename);
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout'], cwd: root });
const errors = [], checked = [];

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('#fileStatus');
  await page.evaluate(() => window.frameDev.inspect(false));
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
    const context = canvas.getContext('2d'); context.fillStyle = '#285776'; context.fillRect(0, 0, 600, 800);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await fs.writeFile(photo, Buffer.from(fixture, 'base64'));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setTitle('Bottom Bar native proof'); win.focus(); });
  const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const metrics = () => page.evaluate(() => {
    const rect = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, bottom: b.bottom }; };
    const output = document.getElementById('fileStatus'), style = getComputedStyle(output);
    const text = output.querySelector('[data-message-text]').getBoundingClientRect();
    return { bar: rect('bottomBar'), body: rect('frameBody'), preview: rect('photoPreview'), windows: rect('windowsBar'), action: rect('actionBar'),
      outputHeight: output.getBoundingClientRect().height, padding: parseFloat(style.paddingTop), bottomPadding: parseFloat(style.paddingBottom),
      lineHeight: parseFloat(style.lineHeight), textHeight: text.height, clipped: output.scrollHeight > output.clientHeight || output.scrollWidth > output.clientWidth,
      overlays: document.querySelectorAll('.diagnostic-summary, .MuiSnackbar-root').length, issues: window.frameDev.records().length,
    };
  });
  const capture = async (name) => {
    const bytes = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === win.getTitle()).thumbnail.toPNG().toString('base64');
    });
    await fs.writeFile(path.join(folder, `${name}-native.png`), Buffer.from(bytes, 'base64'));
  };
  const fits = (m, paddingPercent) => {
    assert.equal(m.clipped, false);
    assert.equal(m.overlays, 0);
    assert.ok(Math.abs(m.padding / m.outputHeight * 100 - paddingPercent) < 0.05);
    assert.equal(m.padding, m.bottomPadding);
    assert.ok(Math.abs(m.body.bottom - m.bar.y) < 0.1, 'Preview region ends at the bar, not under it');
    assert.ok(Math.abs(m.preview.bottom - m.bar.y) < 1.1);
    assert.ok(m.bar.height < 100, 'Representative messages stay compact');
  };
  const cancelLoad = async () => {
    await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
    await page.click('#fileControls-load');
    await page.waitForFunction(() => !window.frameDev.snapshot().busy && window.frameDev.snapshot().message.includes('Load canceled'));
    await settle();
  };
  const loadPhoto = async () => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, photo);
    await page.click('#fileControls-load');
    await page.waitForFunction(() => !window.frameDev.snapshot().busy && window.frameDev.snapshot().message.startsWith('Loaded '));
    await settle();
  };

  for (const [name, width, height] of [['default', 960, 960], ['minimum', 760, 700]]) {
    await app.evaluate(({ BrowserWindow }, size) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(...size); win.focus(); }, [width, height]);
    await cancelLoad();
    const compact = await metrics();
    fits(compact, 1);
    assert.ok(Math.abs(compact.textHeight - compact.lineHeight) < 0.1, 'Short message is one line');
    assert.equal(compact.issues, 0);
    await capture(`${name}-one-line`);
    await loadPhoto();
    const expanded = await metrics();
    fits(expanded, 1);
    assert.ok(expanded.textHeight > compact.textHeight * 1.9, 'Long success message wraps and expands');
    assert.ok(expanded.bar.y < compact.bar.y, 'Expansion goes upward');
    assert.deepEqual(expanded.windows, compact.windows);
    assert.deepEqual(expanded.action, compact.action);
    await capture(`${name}-multiline`);
    await cancelLoad();
    const shrunk = await metrics();
    assert.ok(Math.abs(shrunk.bar.height - compact.bar.height) < 0.1, 'Short message returns to one-line height');
    checked.push({ size: name, compactHeight: compact.bar.height, expandedHeight: expanded.bar.height, paddingPercent: compact.padding / compact.outputHeight * 100 });
  }

  const twoPercent = structuredClone(config);
  twoPercent.presets.status.geometry.paddingY = 2;
  await page.evaluate((raw) => window.frameDev.reconfigure(raw), twoPercent);
  await settle();
  fits(await metrics(), 2);
  await page.evaluate((raw) => window.frameDev.reconfigure(raw), config);
  await settle();
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => { throw new Error('Bottom Bar controlled dialog failure'); }; });
  await page.click('#fileControls-load');
  await page.waitForFunction(() => !window.frameDev.snapshot().busy && window.frameDev.records().length > 0);
  await settle();
  const text = await page.locator('#fileStatus').textContent();
  assert.match(text, /Bottom Bar controlled dialog failure/);
  assert.match(text, /IMAGE_FILE_OPERATION_FAILED/);
  fits(await metrics(), 1);
  await capture('minimum-diagnostics');
  await page.evaluate(() => window.frameDev.flush());
  const logPath = await page.evaluate(() => window.frameDev.logPath);
  const records = JSON.parse(await fs.readFile(logPath, 'utf8'));
  assert.ok(records.some((record) => record.actual.includes('Bottom Bar controlled dialog failure')));
  const invalidPadding = structuredClone(config);
  invalidPadding.presets.status.geometry.paddingY = 50;
  await page.evaluate((raw) => window.frameDev.reconfigure(raw), invalidPadding);
  await settle();
  assert.equal(await page.locator('#fileStatus').count(), 0, 'Invalid padding isolates its message control before rendering');
  assert.equal(await page.locator('#fileControls-load').count(), 1, 'Other controls survive invalid message configuration');
  assert.ok((await page.evaluate(() => window.frameDev.records())).some((issue) => issue.instanceId === 'fileStatus' && issue.configPath.endsWith('geometry.paddingY')));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, checked, jsonPadding2Percent: true, failuresAndDiagnosticsInBar: true, logPath, captures: folder }, null, 2));
} finally {
  await app.close();
}
