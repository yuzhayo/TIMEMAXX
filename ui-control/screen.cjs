const fs = require('node:fs');
const path = require('node:path');

// LOGIC — public launch-only contract. The host supplies native services and lifetime;
// Input owns its config/page. No photo, settings, engine, or overlay data is accepted.
function createInputScreen({ BrowserWindow, screen, parent, configPath = path.join(__dirname, 'config.json') }) {
  let window;
  let opening;

  const settings = () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const value = config.window;
    if (config.schemaVersion !== 1 || !value || value.units !== 'DIP'
      || typeof value.title !== 'string' || !value.title.trim()
      || !['width', 'height', 'minWidth', 'minHeight'].every((key) => Number.isSafeInteger(value[key]) && value[key] > 0)
      || value.width < value.minWidth || value.height < value.minHeight
      || typeof value.background !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.background)) {
      throw new Error(`${configPath}: invalid Input window settings; expected title, positive DIP bounds and #RRGGBB background`);
    }
    return value;
  };

  // UI — native title bar only; client area is deliberately empty and config-colored.
  const create = async () => {
    const config = settings();
    const area = screen.getDisplayMatching(parent.getBounds()).workArea;
    const width = Math.min(config.width, area.width), height = Math.min(config.height, area.height);
    const created = new BrowserWindow({
      title: config.title, parent, modal: false, show: false,
      x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2),
      width, height, minWidth: Math.min(config.minWidth, area.width), minHeight: Math.min(config.minHeight, area.height),
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
      if (!created.isDestroyed()) created.close();
      throw error;
    }
  };

  // LOGIC — one live window, one in-flight opening; reopening reads current JSON.
  return {
    open: async () => {
      if (parent.isDestroyed()) throw new Error('Frame window is closed');
      if (!opening && (!window || window.isDestroyed())) opening = create();
      const pending = opening;
      let target;
      try { target = pending ? await pending : window; }
      finally { if (opening === pending) opening = null; }
      if (!target || target.isDestroyed()) throw new Error('Input screen closed while opening');
      if (target.isMinimized()) target.restore();
      target.show();
      target.focus();
    },
    close: () => { if (window && !window.isDestroyed()) window.close(); },
  };
}

module.exports = { createInputScreen };
