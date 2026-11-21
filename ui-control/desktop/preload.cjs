const { contextBridge, ipcRenderer } = require('electron');

// LOGIC — only Input's window-local config and diagnostics; no Frame/file/Node bridge.
const token = process.argv.find((value) => value.startsWith('--input-token='))?.slice('--input-token='.length);
if (!token || !/^[a-f0-9-]{36}$/.test(token)) throw new Error('Missing Input bootstrap identity');
contextBridge.exposeInMainWorld('inputHost', {
  bootstrap: () => ipcRenderer.invoke(`input:${token}:bootstrap`),
  diagnostics: (records) => ipcRenderer.invoke(`input:${token}:diagnostics`, records),
});
