import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const artifacts = path.join(root, '.runtime/checks/engine-layers');
const codePath = path.resolve(root, '../ui-control/code.json');
await fs.mkdir(artifacts, { recursive: true });
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const app = await _electron.launch({ executablePath: require('electron'),
  args: [root, '--layout-proof'], cwd: root, timeout: 20000 });

const original = await fs.readFile(codePath, 'utf8');
try {
  const page = await app.firstWindow();
  await page.waitForSelector('canvas');
  await page.evaluate(() => {
    window.__layerEvents = [];
    window.frameHost.onLayersChanged((result) => window.__layerEvents.push(result));
  });
  const result = await page.evaluate(() => window.frameHost.layers());
  assert.equal(result.ok, true, 'Frame can ask the parent engine for layers');
  assert.deepEqual(result.layers.map((layer) => layer.id), ['shield', 'codeDivider', 'codeStamp'],
    'the engine returns the discovered calculations, ordered by z');
  assert.ok(result.frame.width === 1200 && result.frame.height === 1600, 'layers are 3:4 1200x1600');
  assert.ok(result.layers.every((layer) => layer.dataUrl.startsWith('data:image/png;base64,')),
    'each layer is a transparent PNG carried across the bridge');
  const before = result.layers.find((layer) => layer.id === 'codeStamp').dataUrl;

  // LOGIC — a code.json edit must reach the frame without a restart.
  const changed = JSON.parse(original);
  changed.sections.codeGenerator.code = 'POLLCHECK00001';
  await fs.writeFile(codePath, `${JSON.stringify(changed, null, 2)}\n`, 'utf8');
  await page.waitForFunction(() => window.__layerEvents.length > 0, null, { timeout: 10000 });
  const after = await page.evaluate(() => window.__layerEvents.at(-1));
  const updated = after.layers.find((layer) => layer.id === 'codeStamp').dataUrl;
  assert.notEqual(updated, before, 'a code.json change pushes a fresh codeStamp layer to Frame');

  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const next = () => { if (++frames === 30) resolve(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }));
  await page.screenshot({ path: path.join(artifacts, 'frame-with-layers.png') });
  console.log(JSON.stringify({ pass: true, layers: result.layers.map((layer) => layer.id), liveUpdate: true }));
} finally {
  await fs.writeFile(codePath, original, 'utf8');
  await app.close();
}
