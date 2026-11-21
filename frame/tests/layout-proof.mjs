import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { _electron } = require('playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const artifacts = path.join(root, '.runtime', 'checks');
process.env.ELECTRON_CACHE = path.join(root, '.runtime', 'electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
await fs.mkdir(artifacts, { recursive: true });
const originalConfigBytes = await fs.readFile(path.join(root, 'config.json'));
const originalConfig = JSON.parse(originalConfigBytes);
const errors = [];
const evidence = [];
let app;
let changed = false;
const moves = [];

async function launch(inspect = true) {
  app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', ...(inspect ? ['--inspect-layout'] : [])], cwd: root, timeout: 20000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('[data-ready="true"]');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setTitle('Frame layout proof'));
  page.frameStartupSize = await app.evaluate(({ BrowserWindow }) => { const bounds = BrowserWindow.getAllWindows()[0].getBounds(); return [bounds.width, bounds.height]; });
  return page;
}

async function close() {
  if (app) { await app.close(); app = null; }
}

async function configure(page, config) {
  await page.evaluate((next) => window.frameDev.reconfigure(next), config);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function capture(page, name) {
  const rendererPath = path.join(artifacts, `${name}.png`);
  await page.screenshot({ path: rendererPath });
  const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
    const source = sources.find((candidate) => candidate.name === window.getTitle());
    return source && !source.thumbnail.isEmpty() ? source.thumbnail.toPNG().toString('base64') : null;
  });
  assert.ok(native, `${name}: actual native window capture includes caption controls`);
  await fs.writeFile(path.join(artifacts, `${name}-native.png`), Buffer.from(native, 'base64'));
  evidence.push(name);
}

function build() {
  const run = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(run.status, 0, `Changed source build failed: ${run.error?.message ?? ''}\n${run.stdout}\n${run.stderr}`);
}

if (process.argv.includes('--inspection-only')) {
  try {
    const page = await launch();
    await page.waitForFunction(() => document.querySelector('.layout-summary')?.textContent.includes('windows-bar/UndoButton.jsx'));
    const text = await page.locator('.layout-summary').innerText();
    for (const value of ['history.undo', 'history.redo', 'windowsBar', 'windows-bar/UndoButton.jsx', 'windows-bar/RedoButton.jsx']) assert.ok(text.includes(value));
    for (const [name, width, height] of [['startup', ...page.frameStartupSize], ['minimum', originalConfig.window.minWidth, originalConfig.window.minHeight]]) {
      await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('.layout-summary').evaluate((element) => element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth), false);
      await capture(page, `slice-inspection-${name}`);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ pass: true, checked: ['readable component/instance/parent/source summary', 'no summary clipping', 'startup/minimum native inspection screenshots'], evidence }, null, 2));
  } finally { await close(); }
} else try {
  let page = await launch();
  assert.equal(await page.locator('.frame-section').count(), 4);
  assert.equal(await page.locator('[data-instance]').count(), originalConfig.instances.filter((node) => node.enabled).length);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  await page.waitForFunction(() => document.querySelector('.layout-summary')?.textContent.includes('windows-bar/UndoButton.jsx'));
  assert.equal(await page.locator('#undo').isDisabled(), true);
  assert.equal(await page.locator('#redo').isDisabled(), true);

  await page.evaluate(() => window.frameDev.commit({ rotation: 15 }));
  await page.click('#undo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 0);
  await page.click('#redo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 15);

  // Change JSON values only: verify the actual MUI button, not just its slot.
  const sibling = await page.locator('#redo').evaluate((element) => ({ color: getComputedStyle(element).color, height: element.getBoundingClientRect().height }));
  const originalUndo = await page.locator('#undo').boundingBox();
  const visual = structuredClone(originalConfig);
  visual.instances[0].colors = { foreground: '#aaffbb', background: '#214e34' };
  visual.instances[0].bounds.height = 40;
  visual.instances[0].bounds.y = 30;
  await configure(page, visual);
  assert.equal(await page.locator('#undo').evaluate((element) => getComputedStyle(element).color), 'rgb(170, 255, 187)');
  assert.equal(await page.locator('#undo').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(33, 78, 52)');
  assert.ok((await page.locator('#undo').boundingBox()).height < originalUndo.height);
  assert.deepEqual(await page.locator('#redo').evaluate((element) => ({ color: getComputedStyle(element).color, height: element.getBoundingClientRect().height })), sibling);
  await capture(page, 'slice-config-variation');

  const resized = structuredClone(originalConfig);
  resized.sections[1].bounds.height = 10;
  resized.sections[2].bounds.y = 15;
  resized.sections[2].bounds.height = 78;
  const bottomBefore = await page.locator('#bottomBar').boundingBox();
  await configure(page, resized);
  const parentHeight = await page.locator('#actionBar').evaluate((element) => element.clientHeight);
  const files = originalConfig.instances.find((node) => node.id === 'fileControls');
  const allocation = resized.sections.find((section) => section.id === 'actionBar').layout.allocations[files.placement.allocation];
  const loadHeightFraction = allocation.height / 100 * files.parts.load.size.height / 100;
  assert.ok(Math.abs((await page.locator('#fileControls-load').boundingBox()).height - parentHeight * loadHeightFraction) < 1);
  assert.deepEqual(await page.locator('#bottomBar').boundingBox(), bottomBefore);

  const disabled = structuredClone(originalConfig);
  disabled.instances[1].enabled = false;
  await configure(page, disabled);
  assert.equal(await page.locator('#redo').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  await configure(page, originalConfig);

  await page.evaluate(() => window.frameDev.commit({ rotation: 30 }));
  await page.click('#undo');
  const mismatch = structuredClone(originalConfig);
  mismatch.instances[0].parentId = 'actionBar';
  mismatch.instances[0].placement = { align: 'start', order: 4, allocation: 'controls' };
  mismatch.instances[0].bounds = { width: 4.5 };
  await configure(page, mismatch);
  await configure(page, mismatch);
  assert.equal(await page.locator('#undo').count(), 0);
  assert.equal(await page.locator('#redo').isEnabled(), true);
  await page.click('#redo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 30);
  const issues = await page.evaluate(async () => { await window.frameDev.flush(); return { records: window.frameDev.records(), path: window.frameDev.logPath }; });
  assert.equal(issues.records.length, 1);
  assert.equal(issues.records[0].code, 'FOLDER_PARENT_MISMATCH');
  assert.equal(issues.records[0].repeatCount, 2);
  const persisted = JSON.parse(await fs.readFile(issues.path, 'utf8'));
  assert.equal(persisted[0].repeatCount, 2);
  assert.ok(persisted[0].configPath && persisted[0].filePath && persisted[0].action);
  await capture(page, 'slice-mismatch');
  await close();

  // No developer bridge or inspector during a normal launch; real production build.
  page = await launch(false);
  assert.equal(await page.evaluate(() => typeof window.frameDev), 'undefined');
  assert.equal(await page.locator('[data-inspection]').count(), 0);
  await capture(page, 'slice-normal');
  await close();

  // Physical file move + JSON only. Renaming Undo also proves filename-independent IDs.
  changed = true;
  for (const [sourceName, targetName] of [['UndoButton.jsx', 'HistoryBack.jsx'], ['RedoButton.jsx', 'RedoButton.jsx']]) {
    const source = path.join(root, 'view/window/windows-bar', sourceName);
    const target = path.join(root, 'view/window/action-bar', targetName);
    await fs.rename(source, target);
    moves.push({ source, target });
  }
  const moved = structuredClone(originalConfig);
  moved.instances.forEach((instance, index) => {
    if (!instance.componentId.startsWith('history.')) return;
    instance.parentId = 'actionBar';
    instance.placement = { align: 'start', order: 5 + index, allocation: 'controls' };
    instance.bounds = { width: 5 };
  });
  await fs.writeFile(path.join(root, 'config.json'), JSON.stringify(moved, null, 2));
  build();
  page = await launch();
  assert.equal(await page.locator('#actionBar [data-component^="history."]').count(), 2);
  assert.equal(await page.locator('#windowsBar [data-component^="history."]').count(), 0);
  assert.equal(await page.locator('[data-instance="undo"]').getAttribute('data-source'), 'action-bar/HistoryBack.jsx');
  assert.deepEqual(await page.evaluate(() => window.frameDev.records()), []);
  await page.evaluate(() => window.frameDev.commit({ rotation: 20 }));
  await page.click('#undo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 0);
  await page.click('#redo');
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().document.rotation), 20);

  for (const [name, width, height] of [['startup', ...page.frameStartupSize], ['minimum', moved.window.minWidth, moved.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => {
      const safe = document.querySelector('[data-section-content="actionBar"]').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('#actionBar [data-component^="history."] button')].map((element) => {
        const button = element.getBoundingClientRect();
        const icon = element.querySelector('svg').getBoundingClientRect();
        return { id: element.id, right: button.right, width: button.width, height: button.height,
          dx: icon.x + icon.width / 2 - button.x - button.width / 2,
          dy: icon.y + icon.height / 2 - button.y - button.height / 2 };
      });
      return { safeRight: safe.right, width: innerWidth, height: innerHeight, buttons };
    });
    assert.equal(metrics.width, width);
    assert.equal(metrics.height, height);
    for (const button of metrics.buttons) {
      assert.ok(button.right <= metrics.safeRight + 1, 'Relocated control stays clear of native caption buttons');
      assert.ok(Math.abs(button.dx) < 1 && Math.abs(button.dy) < 1, 'Icon is centered');
    }
    await capture(page, `slice-relocated-${name}`);
    await page.evaluate(() => window.frameDev.inspect(false));
    await page.waitForFunction(() => document.querySelectorAll('[data-inspection]').length === 0);
    await capture(page, `slice-relocated-${name}-normal`);
    await page.evaluate(() => window.frameDev.inspect(true));
  }
  assert.deepEqual(errors, [], 'No renderer errors');
  console.log(JSON.stringify({ pass: true, evidence, artifacts, checked: ['real history', 'actual config consumption', 'sibling isolation', 'parent percentages', 'enabling', 'non-breaking mismatch', 'persisted deduplicated logs', 'normal mode', 'physical move and rename plus JSON only', 'configured parent bounds', 'centered icons', 'startup/minimum native screenshots'] }, null, 2));
} finally {
  await close();
  if (changed) {
    for (const { source, target } of moves.reverse()) await fs.rename(target, source);
    await fs.writeFile(path.join(root, 'config.json'), originalConfigBytes);
    build(); // Restore the reviewed baseline and its matching generated UI.
  }
}
