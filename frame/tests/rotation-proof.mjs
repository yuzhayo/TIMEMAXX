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
const artifacts = path.join(root, '.runtime/checks/rotation');
await fs.mkdir(artifacts, { recursive: true });
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
config.window.title = 'Frame Rotation proof';
const configPath = path.join(artifacts, 'config.json');
await fs.writeFile(configPath, JSON.stringify(config));
const hash = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout', `--config=${configPath}`], cwd: root, timeout: 20000 });
const errors = [], checked = [], metrics = [];
try {
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#rotationControls-input');
  const startupSize = await app.evaluate(({ BrowserWindow }) => { const bounds = BrowserWindow.getAllWindows()[0].getBounds(); return [bounds.width, bounds.height]; });
  await page.evaluate(() => window.frameDev.inspect(false));
  const input = page.getByRole('textbox', { name: 'Photo rotation in degrees' });
  assert.equal(await input.isDisabled(), true);
  assert.equal(await page.locator('#rotationControls-slider').count(), 0, 'The slider lives in a popup until it is opened');
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  const disabledParts = structuredClone(config);
  disabledParts.instances.find((node) => node.id === 'rotationControls').parts.value.states = { disabled: { colors: { foreground: '#637182' } } };
  await page.evaluate((value) => window.frameDev.reconfigure(value), disabledParts);
  for (const selector of ['#rotationControls-input', '#rotationControls-field [data-part="degree"]']) {
    assert.equal(await page.locator(selector).evaluate((element) => getComputedStyle(element).color), 'rgb(99, 113, 130)', 'Disabled value state reaches input and unit content');
  }
  await page.evaluate((value) => window.frameDev.reconfigure(value), config);
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#285776'; ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = '#e9bc67'; ctx.fillRect(0, 0, 300, 400);
    ctx.fillStyle = '#d54c51'; ctx.fillRect(420, 570, 180, 230);
    return canvas.toDataURL().split(',')[1];
  });
  const source = path.join(artifacts, 'rotation-source.png');
  await fs.writeFile(source, Buffer.from(fixture, 'base64')); const originalHash = await hash(source);
  const load = async () => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
    await page.click('#fileControls-load');
    await page.waitForFunction(() => !window.frameDev.snapshot().busy && !!window.frameDev.snapshot().photo);
  };
  const rotation = () => page.evaluate(() => window.frameDev.snapshot().document.rotation);
  const waitRotation = (number) => page.waitForFunction((expected) => window.frameDev.snapshot().document.rotation === expected, number);
  const save = async (name) => {
    const file = path.join(artifacts, name);
    await app.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }); }, file);
    await page.click('#fileControls-save');
    await page.waitForFunction(() => !window.frameDev.snapshot().busy && window.frameDev.snapshot().message.startsWith('Saved '));
    return file;
  };
  await load();
  await page.waitForFunction(() => {
    const canvas = document.getElementById('photoPreview');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 !== 3 && value !== 0);
  });
  const preview = () => page.locator('#photoPreview').evaluate((canvas) => canvas.toDataURL());
  const beforePreview = await preview(); const beforeExport = await save('before.png');
  await input.fill('12.3'); await waitRotation(12.3);
  await input.fill('24.5'); await input.press('Enter'); await waitRotation(24.5);
  await page.waitForFunction((before) => document.getElementById('photoPreview').toDataURL() !== before, beforePreview);
  await page.click('#undo'); await waitRotation(0);
  assert.equal(await page.locator('#undo').isDisabled(), true, 'Typing commits only once');
  await page.click('#redo'); await waitRotation(24.5);
  await input.fill('45.6'); await input.press('Escape'); await waitRotation(24.5);
  await input.fill('invalid'); assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.equal(await input.evaluate((element) => getComputedStyle(element).color), 'rgb(255, 159, 159)', 'JSON error state reaches the actual input');
  await input.press('Enter'); assert.equal(await input.inputValue(), '24.5');
  await input.fill('12.3'); await page.click('#rotationControls-right'); await waitRotation(102.3);
  await page.click('#undo'); await waitRotation(12.3);
  await page.click('#rotationControls-left'); await waitRotation(-77.7);
  checked.push('0.1° input precision, invalid draft recovery, Escape cancellation, ±90° buttons, synchronized slider and one-step typing history');
  await load();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Pointer drag belongs to popover-proof; Rotation proves deterministic keyboard token lifetime here.
  await page.click('#rotationControls-field');
  await page.waitForSelector('#rotationControls-slider', { state: 'attached' });
  let keyboardSlider = page.getByRole('slider', { name: 'Photo rotation slider' });
  await keyboardSlider.focus(); await keyboardSlider.press('ArrowRight');
  const stepped = await rotation(); assert.equal(stepped, 0.1); assert.equal(Number(await input.inputValue()), stepped);
  await page.click('#undo'); await waitRotation(0); assert.equal(await page.locator('#undo').isDisabled(), true);
  await page.click('#redo'); await waitRotation(stepped);
  await page.click('#rotationControls-field');
  await page.waitForSelector('#rotationControls-slider', { state: 'attached' });
  keyboardSlider = page.getByRole('slider', { name: 'Photo rotation slider' }); await keyboardSlider.focus();
  await page.keyboard.down('ArrowRight'); assert.equal(await rotation(), 0.2);
  await page.keyboard.press('Escape'); await page.keyboard.up('ArrowRight'); await waitRotation(stepped);
  assert.equal(await rotation(), stepped, 'Escape cancels the held keyboard step and late keyup cannot revive it');
  const afterExport = await save('rotated.png');
  assert.notEqual(await hash(beforeExport), await hash(afterExport));
  assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), afterExport), { width: 1200, height: 1600 });
  assert.equal(await hash(source), originalHash);
  checked.push('popup keyboard step/cancellation, value error/disabled states, one-step Undo/Redo, rotated live preview and real Rust export with original preserved');
  const configure = async (next) => {
    await page.evaluate((value) => window.frameDev.reconfigure(value), next);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await page.mouse.move(500, 400);
  const loadBefore = await page.locator('#fileControls-load').evaluate((element) => { const b = element.getBoundingClientRect(); return { width: b.width, height: b.height, color: getComputedStyle(element).color }; });
  const customized = structuredClone(config), group = customized.instances.find((node) => node.id === 'rotationControls');
  group.parts.value.size.height = 60;
  group.parts.value.colors = { foreground: '#91e4c3' };
  await configure(customized);
  assert.equal(await input.evaluate((element) => getComputedStyle(element).color), 'rgb(145, 228, 195)');
  const parentHeight = await page.locator('[data-rotation-content]').evaluate((element) => element.getBoundingClientRect().height);
  assert.ok(Math.abs((await page.locator('#rotationControls-field').boundingBox()).height - parentHeight * 0.6) < 1);
  assert.deepEqual(await page.locator('#fileControls-load').evaluate((element) => { const b = element.getBoundingClientRect(); return { width: b.width, height: b.height, color: getComputedStyle(element).color }; }), loadBefore);
  checked.push('JSON-only real field height/color change with Load unaffected');
  await configure(config);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 1100));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const tallCenters = await page.locator('#rotationControls-left, #rotationControls-right, #fileControls-load').evaluateAll((elements) => elements.map((element) => { const bounds = element.getBoundingClientRect(); return bounds.y + bounds.height / 2; }));
  assert.ok(tallCenters.every((center) => Math.abs(center - tallCenters[0]) < 1), 'Shared control allocations remain on the centerline in a tall window');
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), startupSize);
  for (const [name, width, height] of [['startup', ...startupSize], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const fixed = [];
    for (const text of ['0', '10', '100', '-179.9', '0']) {
      await input.fill(text);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const positions = await page.evaluate((ids) => ids.map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, width: b.width }; }), ['rotationControls-field', 'rotationControls-right', 'fileControls-load', 'fileControls-save']);
      fixed.push({ text, positions });
    }
    for (const state of fixed.slice(1)) assert.deepEqual(state.positions, fixed[0].positions, 'Configured value allocation does not reflow siblings with draft length');
    await input.press('Enter');
    await page.screenshot({ path: path.join(artifacts, `rotation-${name}-one-digit.png`) });
    for (const text of ['-180', '180', '179.9', '-179.9']) {
      await input.fill(text); await input.press('Enter');
      assert.equal(await input.inputValue(), text);
      const fit = await input.evaluate((element) => {
        const style = getComputedStyle(element), canvas = document.createElement('canvas');
        const context = canvas.getContext('2d'); context.font = style.font;
        return { textWidth: context.measureText(element.value).width,
          available: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
      });
      assert.ok(fit.textWidth <= fit.available + 0.5, `${text} remains visible within subpixel measurement tolerance at ${name}: ${JSON.stringify(fit)}`);
    }
    await page.mouse.move(width / 2, height / 2);
    const metric = await page.evaluate(() => {
      const read = (id) => { const e = document.getElementById(id === 'separator' ? 'rotationSeparator' : ['load', 'save'].includes(id) ? `fileControls-${id}` : `rotationControls-${id}`), b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, center: b.y + b.height / 2 }; };
      const ids = ['left', 'field', 'right', 'separator', 'load', 'save'];
      const nodes = Object.fromEntries(ids.map((id) => [id, read(id)]));
      const field = document.querySelector('#rotationControls-input').getBoundingClientRect(), unit = document.querySelector('#rotationControls-field [data-part="degree"]').getBoundingClientRect();
      return { nodes, degreeDelta: field.y + field.height / 2 - unit.y - unit.height / 2 };
    });
    const n = metric.nodes;
    const parentWidth = await page.locator('[data-rotation-content]').evaluate((element) => element.clientWidth);
    assert.ok(Math.abs(n.field.width - parentWidth * group.parts.value.size.width / 100) < 1, 'Degree field consumes its configured percentage allocation');
    for (const id of ['left', 'right']) {
      assert.equal(await page.locator(`#rotationControls-${id}`).getAttribute('data-button-renderer'), 'shared-action');
      assert.ok(Math.abs(n[id].height - n.load.height) < 1);
    }
    assert.ok(Math.abs(n.left.width - parentWidth * group.parts.decrease.size.width / 100) < 1);
    assert.ok(Math.abs(n.right.width - parentWidth * group.parts.increase.size.width / 100) < 1);
    const order = Object.values(n);
    for (let i = 1; i < order.length; i++) assert.ok(order[i - 1].right < order[i].x);
    for (const node of order) assert.ok(Math.abs(node.center - n.load.center) < 1);
    assert.ok(n.left.x < width * 0.03 && n.load.x > width * 0.3);
    assert.ok(Math.abs(metric.degreeDelta) < 1);
    metrics.push({ name, ...metric });
    await page.screenshot({ path: path.join(artifacts, `rotation-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === win.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native); await fs.writeFile(path.join(artifacts, `rotation-${name}-native.png`), Buffer.from(native, 'base64'));
  }
  checked.push('startup/minimum fixed proportional value allocation, visible signed decimals, equal-height controls, degree alignment and anchored Load/Save');
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  const unusedPlacement = structuredClone(config);
  unusedPlacement.instances.find((node) => node.id === 'rotationControls').parts.thumb.bounds = { x: 0, y: 0, width: 10, height: 10 };
  await configure(unusedPlacement);
  assert.equal(await page.locator('#rotationControls').count(), 0);
  assert.ok((await page.evaluate(() => window.frameDev.records())).some((issue) => issue.code === 'INVALID_COMPONENT_CONFIG' && issue.configPath.endsWith('.parts.thumb.bounds')));
  await configure(config);
  const invalid = structuredClone(config); invalid.instances.find((node) => node.id === 'rotationControls').parts.value.colors = { foreground: 'wrong' };
  await configure(invalid); await configure(invalid);
  assert.equal(await input.count(), 0); assert.equal(await page.locator('#fileControls-load').isEnabled(), true);
  await page.evaluate(() => window.frameDev.flush());
  const record = (await page.evaluate(() => window.frameDev.records())).find((issue) => issue.configPath.endsWith('.parts.value.colors.foreground'));
  assert.equal(record.repeatCount, 2); assert.equal(record.instanceId, 'rotationControls'); assert.match(record.filePath, /RotationControls/);
  const log = JSON.parse(await fs.readFile(await page.evaluate(() => window.frameDev.logPath), 'utf8'));
  assert.ok(log.some((issue) => issue.instanceId === 'rotationControls' && issue.repeatCount === 2));
  await configure(config);
  await fs.writeFile(path.join(artifacts, 'metrics.json'), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ pass: true, checked, artifacts }, null, 2));
} finally { await app.close(); }
