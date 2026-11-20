import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const directory = path.join(root, '.runtime/checks/files');
await fs.mkdir(directory, { recursive: true });
const originalConfig = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
const hash = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout'], cwd: root, timeout: 20000 });
const errors = [];
const checked = [];

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#fileControls-save');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setTitle('Frame file-action proof'));
  await page.evaluate(() => window.frameDev.inspect(false));
  assert.equal(await page.locator('[data-component="file.controls"]').count(), 1);
  assert.equal(await page.evaluate(() => window.frameDev.catalog.filter((entry) => entry.componentId === 'file.controls').length), 1);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);

  const waitIdle = () => page.waitForFunction(() => !window.frameDev.snapshot().busy);
  const chooseSave = (filePath) => app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, filePath);
  const save = async (name) => {
    const destination = path.join(directory, name);
    await chooseSave(destination);
    await page.click('#fileControls-save');
    await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
    return destination;
  };
  const size = (filePath) => app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), filePath);
  const black = await save('black.png');
  assert.deepEqual(await size(black), { width: 1200, height: 1600 });
  assert.equal(await app.evaluate(({ nativeImage }, file) => {
    const bytes = nativeImage.createFromPath(file).toBitmap();
    return bytes.every((value, index) => index % 4 === 3 || value === 0);
  }, black), true);
  checked.push('real black-frame PNG export');

  const makeFixture = async (name, replacement) => {
    const bytes = await page.evaluate((different) => {
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = different ? '#284e78' : '#c79337'; ctx.fillRect(0, 0, 600, 800);
      ctx.fillStyle = different ? '#c7555a' : '#285171'; ctx.fillRect(0, 400, 600, 400);
      ctx.fillStyle = '#f0e9db'; ctx.fillRect(100, 100, 400, 250);
      ctx.fillStyle = '#26313c'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(different ? 'REPLACEMENT' : 'FRAME', 300, 200);
      ctx.font = '24px sans-serif'; ctx.fillText('Standalone file slice', 300, 250);
      return canvas.toDataURL('image/png').split(',')[1];
    }, replacement);
    const filePath = path.join(directory, name);
    await fs.writeFile(filePath, Buffer.from(bytes, 'base64'));
    return filePath;
  };
  const source = await makeFixture('source.png', false);
  const replacement = await makeFixture('replacement.png', true);
  const sourceHash = await hash(source), replacementHash = await hash(replacement);
  const load = async (filePath) => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, filePath);
    await page.click('#fileControls-load');
    await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Loaded ') && !window.frameDev.snapshot().busy);
    await page.waitForFunction(() => {
      const canvas = document.getElementById('photoPreview');
      if (!canvas?.width) return false;
      const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 0; index < bytes.length; index += 4) if (bytes[index] || bytes[index + 1] || bytes[index + 2]) return true;
      return false;
    });
  };
  await load(source);
  assert.equal(await page.locator('#fileName').textContent(), 'source.png');
  assert.equal(await page.locator('#fileControls-load').isEnabled(), true);
  assert.equal(await page.locator('#undo').isDisabled(), true);
  const png = await save('loaded.png');
  assert.notEqual(await hash(png), await hash(black));
  assert.deepEqual(await size(png), { width: 1200, height: 1600 });
  checked.push('native Load, actual preview, full-resolution PNG and reset photo history');

  await page.evaluate(() => window.frameDev.setOutputWidth(2400));
  const jpeg = await save('loaded.jpg');
  assert.deepEqual(await size(jpeg), { width: 2400, height: 3200 });
  await page.evaluate(() => window.frameDev.setOutputWidth(3024));
  const full = await save('full.png');
  assert.deepEqual(await size(full), { width: 3024, height: 4032 });
  checked.push('JPEG and exact 2400×3200 / 3024×4032 export presets');

  const beforeCancel = await page.evaluate(() => window.frameDev.snapshot().photo.photoId);
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
  await page.click('#fileControls-load'); await waitIdle();
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().photo.photoId), beforeCancel);
  assert.match(await page.locator('#fileStatus').textContent(), /Load canceled/);
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
  await page.click('#fileControls-save'); await waitIdle();
  assert.match(await page.locator('#fileStatus').textContent(), /Save canceled/);
  await load(replacement);
  assert.equal(await page.locator('#fileName').textContent(), 'replacement.png');
  await chooseSave(source);
  await page.click('#fileControls-save'); await waitIdle();
  assert.match(await page.locator('#fileStatus').textContent(), /original photo cannot be overwritten/);
  const failure = (await page.evaluate(() => window.frameDev.records())).find((issue) => issue.code === 'IMAGE_FILE_OPERATION_FAILED');
  assert.equal(failure.instanceId, 'fileControls');
  assert.equal(failure.filePath, 'action-bar/FileControls.jsx');
  assert.equal(failure.configPath, `instances[${originalConfig.instances.findIndex((node) => node.id === 'fileControls')}].parts.save`);
  assert.equal(await hash(source), sourceHash);
  assert.equal(await hash(replacement), replacementHash);
  checked.push('cancellation, replacement, original protection and grouped Save error provenance');

  const configure = async (config) => {
    await page.evaluate((next) => window.frameDev.reconfigure(next), config);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const colors = () => page.locator('#fileControls-load, #fileControls-save').evaluateAll((elements) => elements.map((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor, border: getComputedStyle(element).borderColor })));
  await page.mouse.move(400, 400);
  const initialColors = await colors();
  assert.deepEqual(initialColors[0], initialColors[1]);
  const shared = structuredClone(originalConfig);
  shared.presets.fileAction.colors.foreground = '#91e4c3';
  await configure(shared);
  assert.deepEqual((await colors()).map((value) => value.color), ['rgb(145, 228, 195)', 'rgb(145, 228, 195)']);
  const independent = structuredClone(originalConfig);
  independent.instances.find((node) => node.id === 'fileControls').parts.save.colors = { background: '#28303b' };
  await configure(independent);
  assert.equal((await colors())[0].background, initialColors[0].background);
  assert.equal((await colors())[1].background, 'rgb(40, 48, 59)');
  const disabled = structuredClone(originalConfig);
  disabled.instances.find((node) => node.id === 'fileControls').enabled = false;
  await configure(disabled);
  assert.equal(await page.locator('#fileControls-save, #fileControls-load').count(), 0);
  assert.equal(await page.locator('#windowClose').isEnabled(), true);
  const mismatch = structuredClone(originalConfig);
  mismatch.instances.find((node) => node.id === 'fileControls').parentId = 'windowsBar';
  await configure(mismatch);
  assert.equal(await page.locator('#fileControls-save, #fileControls-load').count(), 0);
  assert.equal(await page.locator('#windowClose').isEnabled(), true);
  assert.ok((await page.evaluate(() => window.frameDev.records())).some((issue) => issue.instanceId === 'fileControls' && issue.code === 'FOLDER_PARENT_MISMATCH'));
  const badIcon = structuredClone(originalConfig);
  badIcon.instances.find((node) => node.id === 'fileControls').icons.save = 'unregistered';
  await configure(badIcon);
  assert.equal(await page.locator('#fileControls-save, #fileControls-load').count(), 0);
  assert.ok((await page.evaluate(() => window.frameDev.records())).some((issue) => issue.code === 'INVALID_COMPONENT_CONFIG' && issue.configPath.endsWith('.icons.save')));
  checked.push('shared preset, per-part appearance, group enabling, parent mismatch and component-owned icon validation');

  await configure(originalConfig);
  await page.evaluate(() => window.frameDev.setOutputWidth(1200));
  await save('replacement-export.png');
  for (const [name, width, height] of [['default', originalConfig.window.width, originalConfig.window.height], ['minimum', originalConfig.window.minWidth, originalConfig.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const id of ['load', 'save']) {
      const metric = await page.locator(`#fileControls-${id}`).evaluate((element) => {
        const rect = element.getBoundingClientRect(), icon = element.querySelector('svg').getBoundingClientRect();
        const safe = element.closest('.frame-section').querySelector('[data-section-content]').getBoundingClientRect();
        return { text: element.innerText, right: rect.right, safeRight: safe.right, dx: icon.x + icon.width / 2 - rect.x - rect.width / 2, dy: icon.y + icon.height / 2 - rect.y - rect.height / 2 };
      });
      assert.equal(metric.text, '');
      assert.ok(Math.abs(metric.dx) < 1 && Math.abs(metric.dy) < 1);
      assert.ok(metric.right <= metric.safeRight + 1);
    }
    await page.screenshot({ path: path.join(directory, `files-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === window.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native);
    await fs.writeFile(path.join(directory, `files-${name}-native.png`), Buffer.from(native, 'base64'));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, checked, artifacts: directory }, null, 2));
} finally {
  await app.close();
}
