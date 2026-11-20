const { contextBridge, ipcRenderer, webUtils } = require('electron');

// LOGIC — expose only this slice's explicit transport, never filesystem/Node access.
contextBridge.exposeInMainWorld('frameHost', {
  bootstrap: () => ipcRenderer.invoke('frame:bootstrap'),
  diagnostics: (records) => ipcRenderer.invoke('frame:diagnostics', records),
  openImage: () => ipcRenderer.invoke('frame:image-open'),
  dropImage: async (file) => {
    try {
      const filePath = webUtils.getPathForFile(file);
      if (!filePath) return { ok: false, error: 'Drop a local image file from your computer.' };
      return await ipcRenderer.invoke('frame:image-drop', filePath);
    } catch (error) { return { ok: false, error: error.message }; }
  },
  saveImage: (snapshot) => ipcRenderer.invoke('frame:image-save', snapshot),
  windowAction: (operation) => ipcRenderer.invoke('frame:window-action', operation),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('frame:window-state', listener);
    return () => ipcRenderer.removeListener('frame:window-state', listener);
  },
});
