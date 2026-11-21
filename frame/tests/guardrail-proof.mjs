import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const original = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
const artifacts = path.join(root, '.runtime/checks');
await fs.mkdir(artifacts, { recursive: true });
const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout'], cwd: root, timeout: 20000 });
const errors = [];
const checked = [];

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('[data-ready="true"]');
  const startupSize = await app.evaluate(({ BrowserWindow }) => { const bounds = BrowserWindow.getAllWindows()[0].getBounds(); return [bounds.width, bounds.height]; });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setTitle('Frame guardrail proof'));
  const configure = async (config) => {
    await page.evaluate((next) => window.frameDev.reconfigure(next), config);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const change = async (mutate) => { const config = structuredClone(original); mutate(config); await configure(config); };
  const records = () => page.evaluate(() => window.frameDev.records());
  const recordExists = async (predicate) => assert.ok((await records()).some(predicate));

  await page.evaluate(() => { window.frameDev.commit({ rotation: 15 }); window.frameDev.commit({ rotation: 30 }); });
  await page.click('#undo');
  await change((config) => { config.presets.broken = { preset: 'broken' }; config.instances[0].preset = 'broken'; });
  assert.equal(await page.locator('#undo').count(), 0);
  assert.equal(await page.locator('#redo').isEnabled(), true);
  await page.click('#redo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 30);
  await recordExists((issue) => issue.code === 'PRESET_CYCLE');
  checked.push('preset cycle isolated in real renderer; valid Redo remains usable');

  await change((config) => { config.instances[0].colors = null; });
  assert.equal(await page.locator('#undo').count(), 0);
  await recordExists((issue) => issue.configPath === 'instances[0].colors' && issue.instanceId === 'undo');
  await change((config) => { config.presets.broken = { preset: 'button', typoRadius: 123 }; config.instances[0].preset = 'broken'; });
  assert.equal(await page.locator('#undo').count(), 0);
  await recordExists((issue) => issue.configPath === 'presets.broken.typoRadius');
  await change((config) => { config.instances[0].geometry = { shadow: 'not-a-shadow' }; });
  assert.equal(await page.locator('#undo').count(), 0);
  await recordExists((issue) => issue.configPath === 'instances[0].geometry.shadow');
  checked.push('null visuals, unsupported preset keys and invalid shadows rejected');

  await change((config) => { config.sections[1].bounds.y = 0; });
  assert.equal(await page.locator('#windowsBar').count(), 0);
  assert.equal(await page.locator('#actionBar').count(), 0);
  assert.equal(await page.locator('#frameBody').count(), 1);
  assert.equal(await page.locator('#bottomBar').count(), 1);
  await recordExists((issue) => issue.code === 'SECTION_FLOW_OVERLAP' && issue.sectionId === 'actionBar');
  checked.push('overlapping section subtrees isolated; unrelated sections remain');

  await change((config) => { delete config.development.inspector; });
  assert.equal(await page.locator('#undo').count(), 1);
  assert.equal(await page.locator('[data-inspection]').count(), 0);
  await recordExists((issue) => issue.configPath === 'development.inspector');
  await change((config) => { config.development.label.bounds.height = -1; });
  assert.equal(await page.locator('#redo').count(), 1);
  await recordExists((issue) => issue.configPath === 'development.label.bounds.height');
  await change((config) => { config.instances[0].geometry = { fontSize: 'wrong' }; });
  await recordExists((issue) => issue.configPath === 'instances[0].geometry.fontSize'
    && issue.instanceId === 'undo' && issue.componentId === 'history.undo' && issue.filePath === 'windows-bar/UndoButton.jsx');
  checked.push('inspector failures and invalid visual properties logged with exact ownership');

  await change((config) => {
    config.sections[1].content = { direction: 'column', horizontalAlign: 'flex-end', verticalAlign: 'flex-start' };
    config.sections[1].geometry = { borderStyle: 'dashed', borderWidth: 3 };
    config.sections[1].colors = { background: '#102030' };
    config.sections[1].states = { hover: { colors: { background: '#3b2f4a' } } };
    config.instances[0].geometry = { shadow: { x: 0, y: 1, blur: 3, spread: 0, color: '#0009', inset: false } };
  });
  await page.mouse.move(400, 400);
  let style = await page.locator('#actionBar').evaluate((element) => {
    const style = getComputedStyle(element);
    return { align: style.alignItems, justify: style.justifyContent, border: style.borderTopStyle, background: style.backgroundColor };
  });
  assert.deepEqual(style, { align: 'flex-end', justify: 'flex-start', border: 'dashed', background: 'rgb(16, 32, 48)' });
  assert.notEqual(await page.locator('#undo').evaluate((element) => getComputedStyle(element).boxShadow), 'none');
  const action = await page.locator('#actionBar').boundingBox();
  await page.mouse.move(action.x + action.width / 2, action.y + action.height / 2);
  assert.equal(await page.locator('#actionBar').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(59, 47, 74)');
  checked.push('column axes, JSON dashed border/structured shadow and actual section hover applied');

  for (const [name, width, height] of [['startup', ...startupSize], ['minimum', original.window.minWidth, original.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.diagnostic-summary').count(), 0, 'No floating diagnostic banner');
    assert.equal(await page.locator('#fileStatus').evaluate((element) => element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth), false, 'Bottom Bar expands to fit its messages; full records stay in the log');
    await page.screenshot({ path: path.join(artifacts, `guardrails-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      const source = sources.find((candidate) => candidate.name === window.getTitle());
      return source && !source.thumbnail.isEmpty() ? source.thumbnail.toPNG().toString('base64') : null;
    });
    assert.ok(native);
    await fs.writeFile(path.join(artifacts, `guardrails-${name}-native.png`), Buffer.from(native, 'base64'));
  }

  await configure(original);
  assert.equal(await page.locator('[data-instance]').count(), original.instances.filter((node) => node.enabled).length);
  await page.evaluate(() => window.frameDev.flush());
  const logPath = await page.evaluate(() => window.frameDev.logPath);
  const persisted = JSON.parse(await fs.readFile(logPath, 'utf8'));
  assert.ok(persisted.some((issue) => issue.configPath === 'instances[0].geometry.fontSize' && issue.filePath === 'windows-bar/UndoButton.jsx'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, checked, nativeScreenshots: ['guardrails-startup-native.png', 'guardrails-minimum-native.png'], logPath }, null, 2));
} finally {
  await app.close();
}
