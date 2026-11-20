import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const artifacts = path.join(root, '.runtime/checks/bar-layout');
const temp = path.join(root, '.runtime/tmp');
await fs.mkdir(artifacts, { recursive: true });
await fs.mkdir(temp, { recursive: true });
const config = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
config.window.title = 'Frame bar-layout proof';
const configPath = path.join(artifacts, 'config.json');
await fs.writeFile(configPath, JSON.stringify(config, null, 2));
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout', `--config=${configPath}`], cwd: root, timeout: 20000 });
const errors = [];
const metrics = [];

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#windowClose');
  await page.evaluate(() => window.frameDev.inspect(false));
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#285776'; context.fillRect(0, 0, 300, 400);
    context.fillStyle = '#e9bc67'; context.fillRect(50, 60, 200, 140);
    context.fillStyle = '#26313c'; context.font = 'bold 24px sans-serif'; context.textAlign = 'center'; context.fillText('FRAME', 150, 135);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = path.join(artifacts, 'loaded-image-name.png');
  await fs.writeFile(source, Buffer.from(png, 'base64'));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
  await page.click('#fileControls-load');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Loaded ') && !window.frameDev.snapshot().busy);
  assert.equal(await page.locator('#fileName').textContent(), 'loaded-image-name.png');

  for (const [name, width, height] of [['default', config.window.width, config.window.height], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const read = (id) => {
        const element = document.getElementById(['load', 'save'].includes(id) ? `fileControls-${id}` : id), rect = element.getBoundingClientRect();
        const style = getComputedStyle(element), icon = element.querySelector('svg')?.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, width: rect.width, height: rect.height, textAlign: style.textAlign,
          pointerEvents: style.pointerEvents, background: style.backgroundColor,
          dx: icon ? icon.x + icon.width / 2 - rect.x - rect.width / 2 : 0,
          dy: icon ? icon.y + icon.height / 2 - rect.y - rect.height / 2 : 0 };
      };
      const bars = Object.fromEntries(['windowsBar', 'actionBar'].map((id) => { const rect = document.getElementById(id).getBoundingClientRect(); return [id, { y: rect.y, height: rect.height, bottom: rect.bottom }]; }));
      return { width: innerWidth, height: innerHeight, bars, nodes: Object.fromEntries(['undo', 'redo', 'fileName', 'load', 'save', 'windowClose'].map((id) => [id, read(id)])) };
    });
    const { nodes } = result;
    assert.ok(nodes.undo.x < width * 0.03);
    assert.ok(nodes.undo.right < nodes.redo.x && nodes.redo.right < nodes.fileName.x);
    assert.equal(nodes.fileName.textAlign, 'left');
    assert.equal(nodes.fileName.pointerEvents, 'none');
    assert.equal(nodes.fileName.background, 'rgba(0, 0, 0, 0)');
    for (const id of ['redo', 'windowClose']) {
      assert.ok(Math.abs(nodes[id].width - nodes.undo.width) < 1, `${id} width matches Undo`);
      assert.ok(Math.abs(nodes[id].height - nodes.undo.height) < 1, `${id} height matches Undo`);
    }
    assert.ok(nodes.load.x > width * 0.75 && nodes.load.right < nodes.save.x);
    assert.ok(Math.abs(nodes.load.width - width * 0.08) < 1 && Math.abs(nodes.save.width - nodes.load.width) < 1);
    assert.ok(nodes.save.right > width * 0.97 && nodes.save.right <= width);
    assert.ok(Math.abs(result.bars.windowsBar.height - result.bars.actionBar.height) < 1);
    assert.ok(Math.abs(nodes.load.height - nodes.undo.height) < 1 && Math.abs(nodes.save.height - nodes.undo.height) < 1);
    const headerInset = nodes.undo.y - result.bars.windowsBar.y;
    const actionInset = nodes.load.y - result.bars.actionBar.y;
    assert.ok(Math.abs(headerInset - actionInset) < 1, 'Both rows share proportional vertical padding');
    assert.ok(Math.abs(actionInset - (result.bars.actionBar.bottom - nodes.load.y - nodes.load.height)) < 1, 'Action Bar top/bottom padding is symmetric');
    for (const id of ['undo', 'redo', 'load', 'save', 'windowClose']) assert.ok(Math.abs(nodes[id].dx) < 1 && Math.abs(nodes[id].dy) < 1, `${id} icon centered`);
    assert.equal(await page.locator('#windowMinimize, #windowMaximize').count(), 0);
    metrics.push({ name, ...result });
    await page.screenshot({ path: path.join(artifacts, `bars-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === window.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native);
    await fs.writeFile(path.join(artifacts, `bars-${name}-native.png`), Buffer.from(native, 'base64'));
  }

  // CDP mouse events do not establish native non-client dragging. Use actual Windows
  // pointer input only after validating the exact proof window's foreground HWND.
  const handle = await app.evaluate(({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    win.setPosition(area.x + 40, area.y + 40); win.show(); win.focus();
    const bytes = win.getNativeWindowHandle();
    return bytes.length === 8 ? bytes.readBigUInt64LE().toString() : String(bytes.readUInt32LE());
  });
  const nativePointer = async (id, dx, dy) => {
    const fractions = await page.locator(`#${id}`).evaluate((element, kind) => {
      const rect = element.getBoundingClientRect();
      return { x: (rect.x + (kind === 'fileName' ? Math.min(40, rect.width / 4) : rect.width / 2)) / innerWidth, y: (rect.y + rect.height / 2) / innerHeight };
    }, id);
    const output = execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'tests/native-pointer.ps1'), '-WindowHandle', handle,
      '-FractionX', String(fractions.x), '-FractionY', String(fractions.y), '-DeltaX', String(dx), '-DeltaY', String(dy)], {
      cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, TEMP: temp, TMP: temp },
    });
    return JSON.parse(output);
  };
  const dragged = await nativePointer('fileName', 70, 35);
  assert.ok(dragged.dx >= 30 && dragged.dy >= 10, 'Dragging over displayed filename moves the native window');
  const document = await page.evaluate(() => window.frameDev.snapshot().document);
  await page.evaluate((current) => window.frameDev.commit({ ...current, rotation: 15 }), document);
  const undoClick = await nativePointer('undo', 0, 0);
  await page.waitForFunction(() => window.frameDev.snapshot().document.rotation === 0);
  assert.equal(undoClick.dx, 0); assert.equal(undoClick.dy, 0);
  const redoClick = await nativePointer('redo', 0, 0);
  await page.waitForFunction(() => window.frameDev.snapshot().document.rotation === 15);
  assert.equal(redoClick.dx, 0); assert.equal(redoClick.dy, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  await fs.writeFile(path.join(artifacts, 'metrics.json'), JSON.stringify({ metrics, dragged, undoClick, redoClick }, null, 2));
  console.log(JSON.stringify({ pass: true, checked: ['history at far left', 'left filename beside history', 'pass-through transparent filename', 'wider equal Load/Save at right', 'equal Windows Bar button boxes', 'compact equal-height rows with symmetric proportional padding', 'centered icons at both sizes', 'actual native filename drag', 'actual native Undo/Redo clicks without moving window'], dragged, artifacts }, null, 2));
} finally {
  await app.close();
}
