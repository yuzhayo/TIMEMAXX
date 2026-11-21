const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

const frameAppId = 'com.yuzha.timemaxx.frame';

// UI — startup and the maximize button use the same right-aligned work-area target.
function tallWindowBounds(area, config) {
  const width = Math.min(config.width, area.width);
  return { x: area.x + area.width - width, y: area.y, width, height: area.height };
}

// UI — native presentation is supplied by the validated window config.
function createFrameWindow(root, config) {
  const iconPath = path.join(root, 'assets', process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png');
  // UI — JSON selects the startup policy; native work-area bounds exclude the taskbar.
  let startupBounds = {};
  if (config.startup === 'workAreaHeight') {
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    startupBounds = {
      ...tallWindowBounds(area, config),
      minWidth: Math.min(config.minWidth, area.width),
      minHeight: Math.min(config.minHeight, area.height),
    };
  }
  const window = new BrowserWindow({
    title: config.title,
    width: config.width,
    height: config.height,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    ...startupBounds,
    icon: iconPath,
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

  // UI — pinning uses this app's identity/icon and relaunch command, not the Electron host defaults.
  if (process.platform === 'win32') window.setAppDetails({
    appId: frameAppId,
    appIconPath: iconPath,
    appIconIndex: 0,
    relaunchCommand: app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${root}"`,
    relaunchDisplayName: config.title,
  });

  // LOGIC — restrict navigation and retain native window behavior.
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  return window;
}

// LOGIC — narrow native operations; Close follows the existing normal quit/worker cleanup.
function bindWindowActions(window, config) {
  let verticalBounds = config.startup === 'workAreaHeight' ? window.getBounds() : null;
  const startupArea = screen.getDisplayMatching(window.getBounds()).workArea;
  const restoreWidth = Math.min(config.width, startupArea.width);
  const restoreHeight = Math.min(config.height, startupArea.height);
  let restoreBounds = {
    x: startupArea.x + startupArea.width - restoreWidth,
    y: startupArea.y + Math.round((startupArea.height - restoreHeight) / 2),
    width: restoreWidth,
    height: restoreHeight,
  };
  const snapshot = () => {
    const bounds = window.getBounds();
    return {
      maximized: window.isMaximized(),
      minimized: window.isMinimized(),
      verticalMaximized: Boolean(verticalBounds) && !window.isMaximized() && !window.isFullScreen()
        && ['x', 'y', 'width', 'height'].every((key) => bounds[key] === verticalBounds[key]),
    };
  };
  const notify = () => { if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('frame:window-state', snapshot()); };
  const events = ['maximize', 'unmaximize', 'minimize', 'restore', 'resize', 'move', 'enter-full-screen', 'leave-full-screen'];
  for (const event of events) window.on(event, notify);
  ipcMain.handle('frame:window-action', (event, operation) => {
    if (event.sender !== window.webContents) return { ok: false, error: 'Unknown frame sender' };
    if (operation === 'minimize') window.minimize();
    else if (operation === 'toggleMaximize') { if (window.isMaximized()) window.unmaximize(); else window.maximize(); }
    else if (operation === 'toggleVerticalMaximize') {
      if (snapshot().verticalMaximized) {
        verticalBounds = null;
        window.setBounds(restoreBounds);
      } else {
        if (window.isFullScreen()) window.setFullScreen(false);
        if (window.isMaximized()) window.unmaximize();
        restoreBounds = window.getBounds();
        const area = screen.getDisplayMatching(restoreBounds).workArea;
        // LOGIC — return to the approved launch shape; restore retains the previous bounds.
        window.setBounds(tallWindowBounds(area, config));
        verticalBounds = window.getBounds();
      }
      notify();
    }
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

module.exports = { createFrameWindow, bindWindowActions, frameAppId };
