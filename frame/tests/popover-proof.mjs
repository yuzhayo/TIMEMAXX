import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const artifacts = path.join(root, '.runtime/checks/popover');
await fs.mkdir(artifacts, { recursive: true });
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
config.window.title = 'Frame popover proof';
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
  await page.waitForSelector('#rotationControls-input');
  const startupSize = await app.evaluate(({ BrowserWindow }) => { const bounds = BrowserWindow.getAllWindows()[0].getBounds(); return [bounds.width, bounds.height]; });
  await page.evaluate(() => window.frameDev.inspect(false));
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);

  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
    const context = canvas.getContext('2d');
    context.fillStyle = '#285776'; context.fillRect(0, 0, 600, 800);
    context.fillStyle = '#e9bc67'; context.fillRect(80, 120, 440, 320);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = path.join(artifacts, 'source.png');
  await fs.writeFile(source, Buffer.from(fixture, 'base64'));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
  await page.click('#fileControls-load');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Loaded ') && !window.frameDev.snapshot().busy);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const surfaceCount = () => page.locator('[data-popover-surface]').count();
  assert.equal(await surfaceCount(), 0, 'No slider surface exists before a trigger is clicked');

  const bars = await page.evaluate(() => {
    const rect = (id) => document.getElementById(id).getBoundingClientRect();
    return { rotation: rect('rotationControls').width, size: rect('sizeControls').width, files: rect('fileControls').width,
      action: rect('actionBar').width, sliderVisible: document.getElementById('rotationControls-slider')?.getBoundingClientRect().width ?? 0 };
  });
  assert.ok(bars.rotation < bars.action * 0.25, 'Rotation no longer reserves slider width');
  assert.ok(bars.size < bars.action * 0.16, 'Size no longer reserves slider width');
  checked.push(`Action Bar stays compact without inline sliders (rotation ${Math.round(bars.rotation)}px, size ${Math.round(bars.size)}px)`);

  // LOGIC — row slots stay proportional; popup ownership does not impose square/frozen pixels.
  const boxes = await page.evaluate(() => {
    const rect = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { w: b.width, h: b.height }; };
    return { left: rect('rotationControls-left'), right: rect('rotationControls-right'),
      decrease: rect('sizeControls-decrease'), increase: rect('sizeControls-increase'),
      load: rect('fileControls-load'), save: rect('fileControls-save'), reset: rect('fileControls-reset'),
      rotationRow: rect('rotationControls'), sizeRow: rect('sizeControls'), fileRow: rect('fileControls') };
  });
  const rotationConfig = config.instances.find((node) => node.id === 'rotationControls');
  const sizeConfig = config.instances.find((node) => node.id === 'sizeControls');
  const fileConfig = config.instances.find((node) => node.id === 'fileControls');
  for (const [id, row, part] of [['left', 'rotationRow', rotationConfig.parts.decrease], ['right', 'rotationRow', rotationConfig.parts.increase],
    ['decrease', 'sizeRow', sizeConfig.parts.decrease], ['increase', 'sizeRow', sizeConfig.parts.increase],
    ['load', 'fileRow', fileConfig.parts.load], ['save', 'fileRow', fileConfig.parts.save], ['reset', 'fileRow', fileConfig.parts.reset]]) {
    assert.ok(Math.abs(boxes[id].w - boxes[row].w * part.size.width / 100) < 1, `${id} width follows its row percentage`);
    assert.ok(Math.abs(boxes[id].h - boxes[row].h * part.size.height / 100) < 1, `${id} height follows its row percentage`);
  }
  assert.ok(Math.abs(boxes.right.w - boxes.left.w) < 0.5, 'Both rotate buttons match');
  assert.ok(Math.abs(boxes.increase.w - boxes.decrease.w) < 0.5, 'Both size buttons match');
  checked.push('row buttons consume configured percentages without square or frozen-pixel assumptions');

  // LOGIC — the whole visible value control opens the rotation slider popup.
  await page.click('#rotationControls-field');
  await page.waitForSelector('#rotationControls-slider', { state: 'attached' });
  assert.equal(await surfaceCount(), 1);
  assert.ok(await page.locator('#rotationControls-slider').isVisible(), 'The rotation slider is visible only inside the popup');
  checked.push('clicking the whole rotation value opens the rotation slider popup');

  const rail = await page.locator('#rotationControls-slider [data-part="rail"]').boundingBox();
  await page.mouse.move(rail.x + rail.width * 0.4, rail.y + rail.height / 2);
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * 0.6, rail.y + rail.height / 2, { steps: 8 });
  const during = await page.evaluate(() => window.frameDev.snapshot().document.rotation);
  assert.ok(during > 20, 'The drag changes the rotation while the popup stays open');
  assert.equal(await surfaceCount(), 1, 'The popup stays open during the drag');
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll('[data-popover-surface]').length === 0);
  assert.equal(await surfaceCount(), 0, 'The popup closes when the drag commits');
  const field = await page.locator('#rotationControls-input').inputValue();
  assert.equal(Number(field), during, 'The numeric field receives the committed rotation');
  await page.click('#undo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 0);
  checked.push('popup drag previews live, commits on release, closes, and stays one Undo step');

  // LOGIC — Escape inside the popup cancels the whole drag.
  await page.click('#rotationControls-field');
  await page.waitForSelector('#rotationControls-slider', { state: 'attached' });
  const rail2 = await page.locator('#rotationControls-slider [data-part="rail"]').boundingBox();
  await page.mouse.move(rail2.x + rail2.width * 0.6, rail2.y + rail2.height / 2);
  await page.mouse.down();
  await page.mouse.move(rail2.x + rail2.width * 0.3, rail2.y + rail2.height / 2, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 0, 'Escape cancels the popup drag');
  checked.push('Escape cancels the popup drag and restores the previous rotation');

  // LOGIC — the size value opens the size slider popup.
  await page.click('#sizeControls-value');
  await page.waitForSelector('#sizeControls-slider', { state: 'attached' });
  assert.equal(await surfaceCount(), 1);
  assert.ok(await page.locator('#sizeControls-slider').isVisible());
  const sizeRail = await page.locator('#sizeControls-slider [data-part="rail"]').boundingBox();
  await page.mouse.move(sizeRail.x + sizeRail.width * 0.3, sizeRail.y + sizeRail.height / 2);
  await page.mouse.down();
  await page.mouse.move(sizeRail.x + sizeRail.width * 0.7, sizeRail.y + sizeRail.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll('[data-popover-surface]').length === 0);
  const percent = await page.evaluate(() => window.frameDev.snapshot().sizePercent);
  assert.ok(percent > 150, 'The size popup drag enlarges the photo');
  assert.equal(await page.locator('#sizeControls-value').textContent(), `${percent}%`);
  await page.click('#undo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().sizePercent), 100);
  checked.push('the size value opens its own slider popup and the drag commits as one Undo step');

  // LOGIC — an outside press closes the popup without changing anything.
  await page.click('#sizeControls-value');
  await page.waitForSelector('#sizeControls-slider', { state: 'attached' });
  await page.mouse.click(5, 300);
  await page.waitForFunction(() => document.querySelectorAll('[data-popover-surface]').length === 0);
  assert.equal(await surfaceCount(), 0, 'An outside press closes the popup');
  checked.push('an outside press closes the popup');

  for (const [name, width, height] of [['startup', ...startupSize], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(...size); win.focus(); }, [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.evaluate(() => {
      const rect = (id) => document.getElementById(id).getBoundingClientRect();
      const action = rect('actionBar'), rotation = rect('rotationControls'), size = rect('sizeControls'), files = rect('fileControls');
      return { inside: rotation.left >= action.left && rotation.right < size.left && size.right < files.left && files.right <= action.right,
        rotationWidth: rotation.width, sizeWidth: size.width, filesWidth: files.width };
    });
    assert.equal(layout.inside, true, 'The three groups stay in one row without overlapping');
    await page.screenshot({ path: path.join(artifacts, `popover-${name}.png`) });
    await page.click('#rotationControls-field');
    await page.waitForSelector('#rotationControls-slider', { state: 'attached' });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === win.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native);
    await fs.writeFile(path.join(artifacts, `popover-${name}-native.png`), Buffer.from(native, 'base64'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('[data-popover-surface]').length === 0);
  }
  checked.push('one row with an open popup at startup/minimum sizes');

  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  console.log(JSON.stringify({ pass: true, checked, artifacts }, null, 2));
} finally {
  await app.close();
}
