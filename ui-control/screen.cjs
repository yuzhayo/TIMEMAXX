const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DiagnosticLog } = require('../components/DiagnosticLog.cjs');

// UI — native DIP geometry derives from the current host and monitor, never photo state.
function inputWindowBounds(frame, area, config) {
  const width = Math.round(frame.width * config.width.percent / 100);
  const height = Math.round(area.height * config.height.percent / 100);
  const bounds = { x: frame.x - width, y: area.y, width, height };
  if (width < 1 || height < 1 || bounds.x < area.x || bounds.x + width > area.x + area.width) {
    throw new Error('Not enough room to the left of Frame for Input; move Frame right or reduce its width');
  }
  return bounds;
}

// LOGIC — public launch-only contract. The host supplies native services and lifetime;
// Input owns its config/page. No photo, settings, engine, or overlay data is accepted.
function createInputScreen({ BrowserWindow, screen, parent, ipcMain, development = false, inspectionRequested = false, configPath = path.join(__dirname, 'config.json') }) {
  if (typeof ipcMain?.handle !== 'function' || typeof ipcMain?.removeHandler !== 'function') throw new Error('Input configuration transport is unavailable; restart the updated Frame');
  let window;
  let queue = Promise.resolve();
  let disposed = false;
  const log = new DiagnosticLog(path.join(__dirname, '.runtime/logs'));
  // LOGIC — Input owns only its own per-section UI selections; state.json sits beside config.json.
  const statePath = path.join(path.dirname(configPath), 'state.json');
  let stateQueue = Promise.resolve();

  const shape = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validSections = (sections) => shape(sections) && Object.keys(sections).length <= 64
    && Object.values(sections).every((bucket) => shape(bucket) && Object.keys(bucket).length <= 16);

  // LOGIC — a missing file is a first run; an invalid one is reported and ignored,
  // so damaged state never blocks Input from opening with its configured defaults.
  const readState = () => {
    let raw;
    try {
      raw = fs.readFileSync(statePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') log.write([{ code: 'INPUT_STATE_UNREADABLE', configPath: statePath, expected: 'readable state.json',
        actual: error.message, action: 'state ignored; configured defaults apply', timestamp: new Date().toISOString() }]);
      return {};
    }
    try {
      const state = JSON.parse(raw);
      if (state?.schemaVersion !== 1 || !validSections(state?.sections)) throw new Error('expected schemaVersion 1 and per-section selection objects');
      return state.sections;
    } catch (error) {
      log.write([{ code: 'INPUT_STATE_INVALID', configPath: statePath, expected: 'schemaVersion 1 and per-section selection objects',
        actual: error.message, action: 'state ignored; configured defaults apply', timestamp: new Date().toISOString() }]);
      return {};
    }
  };

  // LOGIC — serialize saves and replace atomically so a crash never leaves a half-written state.json.
  const writeState = (sections) => {
    const operation = stateQueue.then(() => {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      const temporary = `${statePath}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, sections }, null, 2), 'utf8');
      fs.renameSync(temporary, statePath);
      return { ok: true };
    });
    stateQueue = operation.catch(() => undefined);
    return operation.catch((error) => ({ ok: false, error: error.message }));
  };

  const settings = () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const value = config?.window;
    const percentage = (entry, base) => entry?.base === base && Number.isFinite(entry.percent) && entry.percent > 0 && entry.percent <= 100;
    if (config?.schemaVersion !== 1 || !value || value.units !== 'DIP'
      || typeof value.title !== 'string' || !value.title.trim()
      || typeof value.frame !== 'boolean' || typeof value.thickFrame !== 'boolean'
      || !percentage(value.width, 'frame') || !percentage(value.height, 'workArea')
      || value.placement?.x !== 'beforeFrame' || value.placement?.y !== 'workAreaStart'
      || typeof value.background !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.background)) {
      throw new Error(`${configPath}: invalid Input window settings; expected frame/workArea percentages, beforeFrame placement, native-frame flags and #RRGGBB background`);
    }
    return config;
  };

  const closeWindow = (target) => {
    if (!target || target.isDestroyed()) return Promise.resolve();
    return new Promise((resolve) => { target.once('closed', resolve); target.close(); });
  };

  // UI — frameless client area fills the configured bounds; no caption or Windows-Bar space.
  const create = async () => {
    const configuration = settings(), config = configuration.window;
    const frame = parent.getBounds();
    const area = screen.getDisplayMatching(frame).workArea;
    const token = randomUUID();
    const bootstrapChannel = `input:${token}:bootstrap`, diagnosticsChannel = `input:${token}:diagnostics`, stateChannel = `input:${token}:state`;
    const created = new BrowserWindow({
      title: config.title, parent, modal: false, show: false,
      ...inputWindowBounds(frame, area, config), frame: config.frame, thickFrame: config.thickFrame,
      backgroundColor: config.background, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'desktop/preload.cjs'), additionalArguments: [`--input-token=${token}`],
        contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    window = created;
    created.setMenu(null);
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    created.webContents.on('will-navigate', (event) => event.preventDefault());
    created.on('page-title-updated', (event) => event.preventDefault());
    const allowed = (event) => event.sender === created.webContents && event.senderFrame === created.webContents.mainFrame;
    ipcMain.handle(bootstrapChannel, (event) => allowed(event)
      ? { config: configuration, state: readState(), development, inspectionRequested: development && inspectionRequested, logPath: log.path } : null);
    ipcMain.handle(diagnosticsChannel, (event, records) => {
      if (!allowed(event) || !Array.isArray(records) || records.length > 1000) return { ok: false, error: 'Unknown Input sender or invalid diagnostic records' };
      return log.write(records);
    });
    ipcMain.handle(stateChannel, (event, sections) => {
      if (!allowed(event) || !validSections(sections) || JSON.stringify(sections).length > 8192) {
        return { ok: false, error: 'Unknown Input sender or invalid per-section state' };
      }
      return writeState(sections);
    });
    created.once('closed', () => {
      ipcMain.removeHandler(bootstrapChannel); ipcMain.removeHandler(diagnosticsChannel); ipcMain.removeHandler(stateChannel);
      if (window === created) window = null;
    });
    try {
      await created.loadFile(path.join(__dirname, 'view-built/index.html'));
      if (created.isDestroyed()) throw new Error('Input screen closed while opening');
      return created;
    } catch (error) {
      await closeWindow(created);
      if (error.code === 'ERR_FILE_NOT_FOUND') throw new Error('Input renderer is not built; run ui-control/build.cmd');
      throw error;
    }
  };

  // LOGIC — serialize toggles so rapid clicks keep open/close parity even during loading.
  // A failed command rejects to its caller; only the queue is recovered for the next click.
  return {
    toggle: () => {
      const command = queue.then(async () => {
        if (disposed || parent.isDestroyed()) throw new Error('Frame window is closed');
        if (window && !window.isDestroyed()) {
          await closeWindow(window);
          return { visible: false };
        }
        const target = await create();
        target.show(); target.focus();
        return { visible: true };
      });
      queue = command.then(() => undefined, () => undefined);
      return command;
    },
    close: () => { if (window && !window.isDestroyed()) window.close(); },
    dispose: async () => { disposed = true; await closeWindow(window); await queue; await log.queue; },
  };
}

module.exports = { createInputScreen, inputWindowBounds };
