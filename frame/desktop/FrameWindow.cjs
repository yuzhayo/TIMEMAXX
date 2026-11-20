const { BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// UI — native presentation is supplied by the validated window config.
function createFrameWindow(root, config) {
  const window = new BrowserWindow({
    title: config.title,
    width: config.width,
    height: config.height,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    icon: path.join(root, 'assets', 'app-icon.png'),
    backgroundColor: config.background,
    autoHideMenuBar: true,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: config.caption.mode === 'native'
      ? { height: config.caption.height, color: config.caption.background, symbolColor: config.caption.foreground }
      : false,
    webPreferences: {
      preload: path.join(root, 'desktop', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // LOGIC — restrict navigation and retain native window behavior.
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  return window;
}

// LOGIC — narrow native operations; Close follows the existing normal quit/worker cleanup.
function bindWindowActions(window) {
  const snapshot = () => ({ maximized: window.isMaximized(), minimized: window.isMinimized() });
  const notify = () => { if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('frame:window-state', snapshot()); };
  const events = ['maximize', 'unmaximize', 'minimize', 'restore'];
  for (const event of events) window.on(event, notify);
  ipcMain.handle('frame:window-action', (event, operation) => {
    if (event.sender !== window.webContents) return { ok: false, error: 'Unknown frame sender' };
    if (operation === 'minimize') window.minimize();
    else if (operation === 'toggleMaximize') { if (window.isMaximized()) window.unmaximize(); else window.maximize(); }
    else if (operation === 'close') setImmediate(() => { if (!window.isDestroyed()) window.close(); });
    else return { ok: false, error: 'Unsupported native window operation' };
    return { ok: true };
  });
  window.once('closed', () => {
    for (const event of events) window.removeListener(event, notify);
    ipcMain.removeHandler('frame:window-action');
  });
  return { snapshot };
}

module.exports = { createFrameWindow, bindWindowActions };
