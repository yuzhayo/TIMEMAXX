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
  await page.evaluate(() => window.frameDev.inspect(false));
  const input = page.getByRole('textbox', { name: 'Photo rotation in degrees' });
  const slider = page.getByRole('slider', { name: 'Photo rotation slider' });
  assert.equal(await input.isDisabled(), true);
  assert.equal(await slider.isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  const disabledParts = structuredClone(config);
  disabledParts.instances.find((node) => node.id === 'rotationControls').parts.degree.states = { disabled: { colors: { foreground: '#637182' } } };
  await page.evaluate((value) => window.frameDev.reconfigure(value), disabledParts);
  assert.equal(await page.locator('#rotationControls-field [data-part="degree"]').evaluate((element) => getComputedStyle(element).color), 'rgb(99, 113, 130)', 'Disabled state reaches named degree part');
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
  assert.equal(await slider.getAttribute('aria-valuenow'), '12.3');
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
  const rail = await page.locator('#rotationControls-slider [data-part="rail"]').boundingBox();
  await page.mouse.move(rail.x + rail.width / 2, rail.y + rail.height / 2); await page.mouse.down();
  assert.equal(await page.locator('#rotationControls-slider [data-part="thumb"]').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(255, 196, 77)', 'JSON active state reaches MUI thumb');
  await page.mouse.move(rail.x + rail.width * 0.65, rail.y + rail.height / 2, { steps: 12 });
  const during = await rotation(); assert.ok(during > 30);
  await page.mouse.move(rail.x + rail.width * 0.75, rail.y + rail.height / 2, { steps: 12 }); await page.mouse.up();
  const dragged = await rotation(); assert.ok(dragged > during);
  assert.equal(Number(await input.inputValue()), dragged);
  await page.click('#undo'); await waitRotation(0); assert.equal(await page.locator('#undo').isDisabled(), true);
  await page.click('#redo'); await waitRotation(dragged);
  await page.mouse.move(rail.x + rail.width * 0.75, rail.y + rail.height / 2); await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * 0.6, rail.y + rail.height / 2);
  assert.notEqual(await rotation(), dragged);
  await page.keyboard.press('Escape'); await waitRotation(dragged);
  await page.mouse.move(rail.x + rail.width * 0.4, rail.y + rail.height / 2); await page.mouse.up();
  assert.equal(await rotation(), dragged, 'Escape cancels the whole drag, including remaining pointer movement');
  await slider.focus(); await slider.press('ArrowRight');
  assert.equal(await rotation(), Number((dragged + 0.1).toFixed(1)));
  await slider.press('Escape');
  const afterExport = await save('rotated.png');
  assert.notEqual(await hash(beforeExport), await hash(afterExport));
  assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), afterExport), { width: 1200, height: 1600 });
  assert.equal(await hash(source), originalHash);
  checked.push('live slider drag, whole-drag Escape cancellation, named-part error/disabled/active states, one-step Undo/Redo, keyboard step, rotated live preview and real Rust export with original preserved');
  const configure = async (next) => {
    await page.evaluate((value) => window.frameDev.reconfigure(value), next);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await page.mouse.move(500, 400);
  const loadBefore = await page.locator('#fileControls-load').evaluate((element) => { const b = element.getBoundingClientRect(); return { width: b.width, height: b.height, color: getComputedStyle(element).color }; });
  const customized = structuredClone(config), group = customized.instances.find((node) => node.id === 'rotationControls');
  group.parts.field.size.height = 60;
  group.parts.input.colors = { foreground: '#91e4c3' };
  group.parts.degree.colors = { foreground: '#91e4c3' };
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
  assert.ok(tallCenters.every((center) => Math.abs(center - tallCenters[0]) < 1), 'Width-limited squares remain on the centerline in a tall window');
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [config.window.width, config.window.height]);
  for (const [name, width, height] of [['default', config.window.width, config.window.height], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dynamic = [];
    for (const text of ['0', '10', '100', '-179.9', '0']) {
      await input.fill(text);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const positions = await page.evaluate((ids) => ids.map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, width: b.width }; }), ['rotationControls-field', 'rotationControls-slider', 'fileControls-load', 'fileControls-save']);
      dynamic.push({ text, positions });
    }
    assert.ok(dynamic[0].positions[0].width < 30, 'Default fits one digit plus degree symbol/insets');
    for (let i = 1; i < 4; i++) {
      const before = dynamic[i - 1].positions, after = dynamic[i].positions;
      assert.ok(after[0].width > before[0].width, 'Draft text expands the field');
      assert.ok(after[1].x > before[1].x, 'Slider uses the space freed by the actual-width field');
      assert.deepEqual(after.slice(2), before.slice(2), 'Load/Save remain anchored');
    }
    assert.ok(Math.abs(dynamic[4].positions[0].width - dynamic[0].positions[0].width) < 0.1, 'Field shrinks back to one digit');
    assert.ok(Math.abs(dynamic[4].positions[1].x - dynamic[0].positions[1].x) < 0.1, 'Slider returns with the field width');
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
      assert.ok(fit.textWidth <= fit.available, `${text} remains fully visible at ${name}: ${JSON.stringify(fit)}`);
    }
    await page.mouse.move(width / 2, height / 2);
    const metric = await page.evaluate(() => {
      const read = (id) => { const e = document.getElementById(id === 'separator' ? 'rotationSeparator' : ['load', 'save'].includes(id) ? `fileControls-${id}` : `rotationControls-${id}`), b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, center: b.y + b.height / 2 }; };
      const ids = ['left', 'field', 'slider', 'right', 'separator', 'load', 'save'];
      const nodes = Object.fromEntries(ids.map((id) => [id, read(id)]));
      const field = document.querySelector('#rotationControls-input').getBoundingClientRect(), unit = document.querySelector('#rotationControls-field [data-part="degree"]').getBoundingClientRect();
      const control = document.querySelector('#rotationControls-slider .MuiSlider-root').getBoundingClientRect();
      const rail = document.querySelector('#rotationControls-slider [data-part="rail"]').getBoundingClientRect();
      const thumb = document.querySelector('#rotationControls-slider [data-part="thumb"]').getBoundingClientRect();
      return { nodes, degreeDelta: field.y + field.height / 2 - unit.y - unit.height / 2,
        parts: { control: { width: control.width, height: control.height }, railHeight: rail.height, thumbWidth: thumb.width, thumbHeight: thumb.height } };
    });
    const n = metric.nodes;
    const parentWidth = await page.locator('[data-rotation-content]').evaluate((element) => element.clientWidth);
    assert.ok(n.field.width <= parentWidth * 0.22 + 1, 'Content-sized degree field stays within its maximum allocation');
    for (const id of ['left', 'right']) {
      assert.ok(Math.abs(n[id].width - n[id].height) < 0.1, `${id} true square at ${name}`);
      assert.equal(await page.locator(`#rotationControls-${id}`).getAttribute('data-button-renderer'), 'shared-action');
      assert.ok(Math.abs(n[id].height - n.load.height) < 1);
    }
    const order = Object.values(n);
    for (let i = 1; i < order.length; i++) assert.ok(order[i - 1].right < order[i].x);
    for (const node of order) assert.ok(Math.abs(node.center - n.load.center) < 1);
    assert.ok(n.left.x < width * 0.03 && n.load.x > width * 0.7);
    assert.ok(Math.abs(metric.degreeDelta) < 1);
    assert.ok(Math.abs(metric.parts.railHeight - metric.parts.control.height * 0.12) < 0.1);
    assert.ok(Math.abs(metric.parts.thumbWidth - metric.parts.control.width * 0.08) < 0.1);
    assert.ok(Math.abs(metric.parts.thumbHeight - metric.parts.control.height * 0.48) < 0.1);
    metrics.push({ name, ...metric });
    await page.screenshot({ path: path.join(artifacts, `rotation-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === win.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native); await fs.writeFile(path.join(artifacts, `rotation-${name}-native.png`), Buffer.from(native, 'base64'));
  }
  checked.push('default/minimum one-digit field expands/shrinks live, signed three-digit/decimal angles fit, true squares and degree alignment remain, slider drag area and Load/Save stay anchored');
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  const unusedPlacement = structuredClone(config);
  unusedPlacement.instances.find((node) => node.id === 'rotationControls').parts.thumb.bounds = { x: 0, y: 0, width: 10, height: 10 };
  await configure(unusedPlacement);
  assert.equal(await page.locator('#rotationControls').count(), 0);
  assert.ok((await page.evaluate(() => window.frameDev.records())).some((issue) => issue.code === 'INVALID_COMPONENT_CONFIG' && issue.configPath.endsWith('.parts.thumb.bounds')));
  await configure(config);
  const invalid = structuredClone(config); invalid.instances.find((node) => node.id === 'rotationControls').parts.input.colors = { foreground: 'wrong' };
  await configure(invalid); await configure(invalid);
  assert.equal(await input.count(), 0); assert.equal(await page.locator('#fileControls-load').isEnabled(), true);
  await page.evaluate(() => window.frameDev.flush());
  const record = (await page.evaluate(() => window.frameDev.records())).find((issue) => issue.configPath.endsWith('.parts.input.colors.foreground'));
  assert.equal(record.repeatCount, 2); assert.equal(record.instanceId, 'rotationControls'); assert.match(record.filePath, /RotationControls/);
  const log = JSON.parse(await fs.readFile(await page.evaluate(() => window.frameDev.logPath), 'utf8'));
  assert.ok(log.some((issue) => issue.instanceId === 'rotationControls' && issue.repeatCount === 2));
  await configure(config);
  await fs.writeFile(path.join(artifacts, 'metrics.json'), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ pass: true, checked, artifacts }, null, 2));
} finally { await app.close(); }
