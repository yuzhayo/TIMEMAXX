const { app, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createFrameWindow, bindWindowActions, frameAppId } = require('./FrameWindow.cjs');
const { DiagnosticLog } = require('./DiagnosticLog.cjs');
const { ImageWorker } = require('./ImageWorker.cjs');
const { ImageFileDialogs } = require('./ImageFileDialogs.cjs');
const { receiveLayers, pollLayers } = require('./LayerReceiver.cjs');

// LOGIC — photo lifetime stays in Frame; the only Input link is its approved window toggle.
const root = path.resolve(__dirname, '..');
if (process.platform === 'win32') app.setAppUserModelId(frameAppId);
const runtime = path.join(root, '.runtime');
const option = (name) => process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
const proof = process.argv.includes('--layout-proof');
const directory = path.join(runtime, proof ? 'proof-profile' : 'profile');
fs.mkdirSync(directory, { recursive: true });
app.setPath('userData', directory);
app.setPath('sessionData', directory);
app.setPath('crashDumps', path.join(directory, 'crash-dumps'));
const log = new DiagnosticLog(path.join(runtime, 'logs'));
let window;
let worker;
let files;
let inputScreen;
let sessionDirectory;
let quitting = false;
let layerTimer;

app.whenReady().then(async () => {
  const configPath = path.resolve(root, option('--config') ?? 'config.json');
  if (path.relative(root, configPath).startsWith('..') || path.isAbsolute(path.relative(root, configPath))) throw new Error('Config must stay inside frame');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { nativeWindowValid, outputSettingsValid } = await import(pathToFileURL(path.join(root, 'view/layout/ConfigValidation.mjs')).href);
  if (!nativeWindowValid(config.window)) throw new Error('window: invalid native settings; no alternate geometry was invented');
  window = createFrameWindow(root, config.window);
  window.on('close', () => inputScreen?.close());
  const windowActions = bindWindowActions(window, config.window);
  if (outputSettingsValid(config.output)) {
    sessionDirectory = fs.mkdtempSync(path.join(runtime, 'image-session-'));
    worker = new ImageWorker(path.join(root, 'image-worker/target/release/frame-image-worker.exe'), configPath, root);
  }
  files = worker ? new ImageFileDialogs(window, worker, sessionDirectory, config.output) : null;
  window.webContents.on('render-process-gone', () => app.quit());
  const allowed = (event) => event.sender === window?.webContents;
  ipcMain.handle('frame:bootstrap', (event) => {
    if (!allowed(event)) return null;
    return {
      config,
      windowState: windowActions.snapshot(),
      logPath: log.path,
      development: !app.isPackaged,
      inspectionRequested: !app.isPackaged && (process.argv.includes('--inspect-layout') || config.development?.inspectionEnabled === true),
    };
  });
  ipcMain.handle('frame:layers', (event) => {
    if (!allowed(event)) return { ok: false, error: 'Unknown frame sender' };
    try { return receiveLayers({ root, runtime }); }
    catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle('frame:diagnostics', (event, records) => {
    if (!allowed(event) || !Array.isArray(records)) return { ok: false, error: 'Unknown diagnostic sender or invalid records' };
    return log.write(records);
  });
  ipcMain.handle('frame:input-toggle', async (event) => {
    if (!allowed(event)) return { ok: false, error: 'Unknown frame sender' };
    try {
      // Lazy public contract: missing/invalid Input never prevents Frame startup/export.
      if (!inputScreen) {
        const { BrowserWindow, screen } = require('electron');
        const { createInputScreen } = require('../../ui-control/screen.cjs');
        inputScreen = createInputScreen({ BrowserWindow, screen, parent: window, ipcMain,
          development: !app.isPackaged, inspectionRequested: !app.isPackaged && process.argv.includes('--inspect-layout') });
      }
      const state = await inputScreen.toggle();
      return { ok: true, ...state };
    } catch (error) { return { ok: false, error: error.message }; }
  });
  for (const [channel, action] of [
    ['frame:image-open', (currentPhotoId) => files?.open(currentPhotoId)],
    ['frame:image-drop', (request) => files?.openDropped(request?.filePath, request?.currentPhotoId)],
    ['frame:image-save', (snapshot) => files?.save(snapshot)],
    ['frame:image-accept', (photoId) => files?.accept(photoId)],
    ['frame:image-finalize', (photoId) => files?.finalize(photoId)],
    ['frame:image-discard', (photoId) => files?.discard(photoId)],
  ]) {
    ipcMain.handle(channel, async (event, argument) => {
      if (!allowed(event)) return { ok: false, error: 'Unknown frame sender' };
      if (!files) return { ok: false, error: 'Output settings are invalid; image-file actions are unavailable' };
      return action(argument);
    });
  }
  await window.loadFile(path.join(root, 'view-built/index.html'));
  layerTimer = setInterval(() => {
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    const { changed, result } = pollLayers({ root, runtime });
    if (changed && result.ok) window.webContents.send('frame:layers-changed', result);
  }, 500);
  window.show();
}).catch(async (error) => {
  console.error(error);
  await log.write([{ code: 'STARTUP_CONFIG_ERROR', configPath: 'window/config', actual: error.message, action: 'startup stopped; no fallback window invented' }]);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  (async () => {
    try {
      clearInterval(layerTimer);
      await inputScreen?.dispose(); await files?.dispose();
    }
    finally {
      await worker?.close();
      if (sessionDirectory) await fs.promises.rm(sessionDirectory, { recursive: true, force: true });
    }
  })().catch(console.error).finally(() => app.quit());
});
