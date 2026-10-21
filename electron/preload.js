const { contextBridge, ipcRenderer } = require('electron');

// Expose persistent config store to renderer
contextBridge.exposeInMainWorld('electronStore', {
  getSync: (key) => ipcRenderer.sendSync('store-get-sync', key),
  setSync: (key, value) => ipcRenderer.sendSync('store-set-sync', key, value)
});

// Expose IPC invoke for native dialogs (e.g. SFTP Save As)
contextBridge.exposeInMainWorld('electronIPC', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data)
});
