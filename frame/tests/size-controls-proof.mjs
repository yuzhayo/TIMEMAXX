import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const artifacts = path.join(root, '.runtime/checks/size-controls');
await fs.mkdir(artifacts, { recursive: true });
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
config.window.title = 'Frame size-controls proof';
const configPath = path.join(artifacts, 'config.json');
await fs.writeFile(configPath, JSON.stringify(config, null, 2));
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout', `--config=${configPath}`], cwd: root, timeout: 20000 });
const errors = [];
const checked = [];

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#sizeControls-value', { state: 'attached' });
  await page.evaluate(() => window.frameDev.inspect(false));
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  assert.equal(await page.locator('[data-component="photo.sizeControls"]').count(), 1);
  assert.equal(await page.locator('#fileControls-reset').count(), 1);
  assert.equal(await page.locator('#sizeControls-decrease, #sizeControls-increase').count(), 2);
  assert.equal(await page.locator('#sizeControls-value').count(), 1);
  assert.equal(await page.locator('#sizeControls-slider').count(), 0, 'No slider is mounted until its popup opens');
  checked.push('one baked size group with decrease/value/increase and a third file part; the slider lives in a popup');

  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
    const context = canvas.getContext('2d');
    context.fillStyle = '#285776'; context.fillRect(0, 0, 600, 800);
    context.fillStyle = '#e9bc67'; context.fillRect(80, 120, 440, 320);
    context.fillStyle = '#d54c51'; context.fillRect(400, 560, 160, 200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = path.join(artifacts, 'source.png');
  await fs.writeFile(source, Buffer.from(fixture, 'base64'));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
  await page.click('#fileControls-load');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Loaded ') && !window.frameDev.snapshot().busy);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const snapshot = () => page.evaluate(() => window.frameDev.snapshot());
  assert.equal((await snapshot()).sizePercent, 100, 'A loaded photo starts at its fitted 100%');
  assert.equal(await page.locator('#sizeControls-value').textContent(), '100%');
  checked.push('loaded photo reports its fitted 100% size');

  const increase = await page.locator('#sizeControls-increase').boundingBox();
  await page.click('#sizeControls-increase');
  assert.equal((await snapshot()).sizePercent, 105, 'Increase applies the configured step');
  assert.equal(await page.locator('#sizeControls-value').textContent(), '105%');
  await page.click('#sizeControls-decrease');
  assert.equal((await snapshot()).sizePercent, 100);
  checked.push('increase/decrease buttons change the shared size by the configured step');

  // The slider lives in a popup opened from the value.
  await page.click('#sizeControls-value');
  await page.waitForSelector('#sizeControls-slider', { state: 'attached' });
  const rail = await page.locator('#sizeControls-slider [data-part="rail"]').boundingBox();
  await page.mouse.move(rail.x + rail.width * 0.6, rail.y + rail.height / 2);
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * 0.8, rail.y + rail.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dragged = (await snapshot()).sizePercent;
  assert.ok(dragged > 150, 'Slider drag enlarges the photo');
  assert.equal(await page.locator('#sizeControls-value').textContent(), `${dragged}%`);
  checked.push('popup slider drag updates the shared size and the value readout');

  const preview = await page.evaluate(() => {
    const canvas = document.getElementById('photoPreview');
    const context = canvas.getContext('2d');
    const pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return { red: pixel[0], green: pixel[1], blue: pixel[2] };
  });
  assert.ok(preview.red > 150 || preview.green > 100, 'The enlarged photo is visible in the preview');
  checked.push('preview reflects the scaled photo');

  const beforeUndo = (await snapshot()).sizePercent;
  await page.click('#undo');
  assert.equal((await snapshot()).sizePercent, 100, 'One Undo returns the value before the drag');
  assert.ok(beforeUndo > 150);
  await page.click('#redo');
  assert.equal((await snapshot()).sizePercent, beforeUndo, 'Redo restores the dragged size');
  await page.click('#undo');
  assert.equal((await snapshot()).sizePercent, 100);
  checked.push('a slider drag is one grouped history step');

  await page.click('#sizeControls-increase');
  await page.click('#sizeControls-increase');
  assert.equal((await snapshot()).sizePercent, 110);
  await page.click('#fileControls-reset');
  assert.equal((await snapshot()).sizePercent, 100, 'Reset restores the fitted photo');
  assert.equal((await snapshot()).document.rotation, 0);
  checked.push('Reset restores the fitted document');

  const exported = path.join(artifacts, 'sized.png');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.click('#fileControls-save');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
  assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), exported), { width: 1200, height: 1600 });
  checked.push('a reset photo still exports at the exact output size');

  for (const [name, width, height] of [['default', config.window.width, config.window.height], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(...size); win.focus(); }, [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => {
      const rect = (id) => document.getElementById(id).getBoundingClientRect();
      const action = rect('actionBar'), group = rect('sizeControls'), files = rect('fileControls'), rotation = rect('rotationControls');
      const value = rect('sizeControls-value');
      return { groupInside: group.left >= action.left && group.right <= action.right,
        filesInside: files.left >= action.left && files.right <= action.right,
        rotationInside: rotation.left >= action.left && rotation.right <= action.right,
        order: rotation.right < group.left && group.right < files.left,
        valueVisible: value.width > 0 && value.height > 0, groupWidth: group.width, actionWidth: action.width,
        buttons: ['sizeControls-decrease', 'sizeControls-increase', 'fileControls-load', 'fileControls-save', 'fileControls-reset'].map((id) => {
          const element = document.getElementById(id), bounds = element.getBoundingClientRect();
          const icon = element.querySelector('svg').getBoundingClientRect();
          return { id, centered: Math.abs(icon.x + icon.width / 2 - bounds.x - bounds.width / 2) < 1 && Math.abs(icon.y + icon.height / 2 - bounds.y - bounds.height / 2) < 1 };
        }),
      };
    });
    assert.equal(metrics.groupInside, true);
    assert.equal(metrics.filesInside, true);
    assert.equal(metrics.rotationInside, true);
    assert.equal(metrics.order, true, 'Rotation, Size and File groups keep their left-to-right order');
    assert.equal(metrics.valueVisible, true);
    assert.ok(metrics.groupWidth < metrics.actionWidth * 0.16, 'The size group no longer reserves slider width');
    for (const button of metrics.buttons) {
      assert.equal(button.centered, true, `${button.id} keeps a centered icon`);
    }
    await page.screenshot({ path: path.join(artifacts, `size-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === win.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native);
    await fs.writeFile(path.join(artifacts, `size-${name}-native.png`), Buffer.from(native, 'base64'));
  }
  checked.push('both bars keep one row with square, centered buttons at default/minimum sizes');

  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  console.log(JSON.stringify({ pass: true, checked, artifacts }, null, 2));
} finally {
  await app.close();
}
