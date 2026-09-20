const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nexus', {
  call: (method, ...args) => ipcRenderer.invoke('nexus', method, ...args),
  onCommand: (callback) => {
    const fn = (_, value) => callback(value);
    ipcRenderer.on('command', fn);
    return () => ipcRenderer.removeListener('command', fn);
  },
});
