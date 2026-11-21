const fs = require('node:fs');
const path = require('node:path');

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
function createInputScreen({ BrowserWindow, screen, parent, configPath = path.join(__dirname, 'config.json') }) {
  let window;
  let queue = Promise.resolve();

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
    return value;
  };

  const closeWindow = (target) => {
    if (!target || target.isDestroyed()) return Promise.resolve();
    return new Promise((resolve) => { target.once('closed', resolve); target.close(); });
  };

  // UI — frameless client area fills the configured bounds; no caption or Windows-Bar space.
  const create = async () => {
    const config = settings();
    const frame = parent.getBounds();
    const area = screen.getDisplayMatching(frame).workArea;
    const created = new BrowserWindow({
      title: config.title, parent, modal: false, show: false,
      ...inputWindowBounds(frame, area, config), frame: config.frame, thickFrame: config.thickFrame,
      backgroundColor: config.background, autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    window = created;
    created.setMenu(null);
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    created.webContents.on('will-navigate', (event) => event.preventDefault());
    created.on('page-title-updated', (event) => event.preventDefault());
    created.once('closed', () => { if (window === created) window = null; });
    try {
      await created.loadFile(path.join(__dirname, 'view/InputScreen.html'));
      if (created.isDestroyed()) throw new Error('Input screen closed while opening');
      return created;
    } catch (error) {
      await closeWindow(created);
      throw error;
    }
  };

  // LOGIC — serialize toggles so rapid clicks keep open/close parity even during loading.
  // A failed command rejects to its caller; only the queue is recovered for the next click.
  return {
    toggle: () => {
      const command = queue.then(async () => {
        if (parent.isDestroyed()) throw new Error('Frame window is closed');
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
  };
}

module.exports = { createInputScreen, inputWindowBounds };
