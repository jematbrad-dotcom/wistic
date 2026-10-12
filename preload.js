const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cl', { api: (n, a) => ipcRenderer.invoke('api', n, a), on: (ch, fn) => ipcRenderer.on(ch, () => fn()) });
