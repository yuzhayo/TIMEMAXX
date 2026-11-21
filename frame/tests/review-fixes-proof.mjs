import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const original = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
const artifacts = path.join(root, '.runtime/checks/review-fixes');
await fs.mkdir(artifacts, { recursive: true });
const sourceComponent = path.join(root, 'view/window/frame-body/PhotoPreview.jsx');
const sourceDrop = path.join(root, 'view/window/frame-body/DropTarget.jsx');
const movedDirectory = path.join(root, 'view/window/relocated-preview');
const movedComponent = path.join(movedDirectory, 'RenamedPreview.jsx');
const movedDrop = path.join(movedDirectory, 'DropTarget.jsx');
const errors = [];
let moved = false;
let app;

function build() {
  const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'error'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error?.message ?? ''}`);
}

try {
  // Actual relocation/rename plus JSON only; no source/import/behavior edits.
  await fs.mkdir(movedDirectory);
  await fs.rename(sourceComponent, movedComponent);
  await fs.rename(sourceDrop, movedDrop);
  moved = true;
  const config = structuredClone(original);
  config.window.title = 'Frame review fixes proof';
  const section = config.sections.find((node) => node.id === 'frameBody');
  section.id = 'previewReview'; section.folder = 'relocated-preview';
  for (const id of ['photoPreview', 'photoDrop']) config.instances.find((node) => node.id === id).parentId = 'previewReview';
  config.history.limit = 0;
  const configPath = path.join(artifacts, 'without-history.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  build();

  app = await _electron.launch({ executablePath: require('electron'), args: [root, '--layout-proof', '--inspect-layout', `--config=${configPath}`], cwd: root, timeout: 20000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForSelector('#fileControls-load');
  const startupSize = await app.evaluate(({ BrowserWindow }) => { const bounds = BrowserWindow.getAllWindows()[0].getBounds(); return [bounds.width, bounds.height]; });
  await page.evaluate(() => window.frameDev.inspect(false));
  assert.equal(await page.locator('[data-instance]').count(), config.instances.filter((node) => node.enabled).length);
  assert.equal(await page.evaluate(() => window.frameDev.snapshot().historyAvailable), false);
  assert.equal(await page.locator('#undo').isDisabled(), true);
  assert.equal(await page.locator('#redo').isDisabled(), true);
  assert.equal(await page.locator('#fileControls-load').isEnabled(), true);
  assert.equal(await page.locator('#fileControls-save').isEnabled(), true);
  assert.equal(await page.locator('[data-instance="photoPreview"]').getAttribute('data-parent'), 'previewReview');
  assert.equal(await page.locator('[data-instance="photoPreview"]').getAttribute('data-source'), 'relocated-preview/RenamedPreview.jsx');
  assert.equal(await page.locator('[data-instance="photoDrop"]').getAttribute('data-source'), 'relocated-preview/DropTarget.jsx');
  const issueCodes = await page.evaluate(() => window.frameDev.records().map((issue) => issue.code));
  assert.deepEqual(issueCodes, ['INVALID_HISTORY_CONFIG']);

  const black = path.join(artifacts, 'without-history-black.png');
  await app.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }); }, black);
  await page.click('#fileControls-save');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
  assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), black), { width: 1200, height: 1600 });

  const source = path.join(artifacts, 'source.png');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = '#2c6180'; context.fillRect(0, 0, 120, 160);
    context.fillStyle = '#e7bf68'; context.fillRect(20, 30, 80, 60);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await fs.writeFile(source, Buffer.from(png, 'base64'));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
  await page.click('#fileControls-load');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Loaded ') && !window.frameDev.snapshot().busy);
  assert.equal(await page.locator('#fileName').textContent(), 'source.png');
  await page.waitForFunction(() => {
    const canvas = document.getElementById('photoPreview');
    const context = canvas.getContext('2d');
    const pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0;
  });
  assert.equal(await page.locator('#undo').isDisabled(), true);
  const exported = path.join(artifacts, 'without-history-photo.png');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.click('#fileControls-save');
  await page.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
  assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), exported), { width: 1200, height: 1600 });

  // Native rejection of original overwrite must identify the actual initiating instance.
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, source);
  await page.click('#fileControls-save');
  await page.waitForFunction(() => window.frameDev.snapshot().message.includes('original photo cannot be overwritten') && !window.frameDev.snapshot().busy);
  await page.evaluate(() => window.frameDev.flush());
  const issues = await page.evaluate(() => window.frameDev.records());
  const failure = issues.find((issue) => issue.code === 'IMAGE_FILE_OPERATION_FAILED');
  assert.equal(failure.operation, 'save');
  assert.equal(failure.instanceId, 'fileControls');
  assert.equal(failure.componentId, 'file.controls');
  assert.equal(failure.parentId, 'actionBar');
  assert.equal(failure.filePath, 'action-bar/FileControls.jsx');
  assert.equal(failure.configPath, `instances[${config.instances.findIndex((node) => node.id === 'fileControls')}].parts.save`);
  const persisted = JSON.parse(await fs.readFile(await page.evaluate(() => window.frameDev.logPath), 'utf8'));
  assert.ok(persisted.some((issue) => issue.operation === 'save' && issue.instanceId === 'fileControls'));

  const disabled = structuredClone(config);
  const disabledFiles = disabled.instances.find((node) => node.id === 'fileControls');
  disabledFiles.enabled = false; disabledFiles.icons.save = 'unregistered';
  await page.evaluate((next) => window.frameDev.reconfigure(next), disabled);
  await page.waitForFunction(() => window.frameDev.records().some((issue) => issue.code === 'INVALID_COMPONENT_CONFIG' && issue.instanceId === 'fileControls'));
  assert.equal(await page.locator('#windowClose').isEnabled(), true);
  assert.equal(await page.locator('#fileControls-load, #fileControls-save').count(), 0);

  await page.evaluate((next) => window.frameDev.reconfigure(next), config);
  await page.waitForSelector('#fileControls-save');
  for (const [name, width, height] of [['startup', ...startupSize], ['minimum', config.window.minWidth, config.window.minHeight]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), [width, height]);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(artifacts, `fixed-${name}.png`) });
    const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const window = BrowserWindow.getAllWindows()[0];
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1200, height: 1200 } });
      return sources.find((source) => source.name === window.getTitle())?.thumbnail.toPNG().toString('base64');
    });
    assert.ok(native);
    await fs.writeFile(path.join(artifacts, `fixed-${name}-native.png`), Buffer.from(native, 'base64'));
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, checked: ['all controls preserved with invalid history', 'real black/photo exports without tracking', 'physical preview move/rename with unchanged imports/behavior', 'live relocated preview', 'disabled invalid options logged', 'native file-error origin persisted'], artifacts }, null, 2));
} finally {
  if (app) await app.close();
  if (moved) {
    await fs.rename(movedComponent, sourceComponent);
    await fs.rename(movedDrop, sourceDrop);
    await fs.rmdir(movedDirectory);
    build(); // Leave reviewed baseline source and matching UI for the completion restart.
  }
}
