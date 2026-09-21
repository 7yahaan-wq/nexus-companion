const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nexus', {
  call: (method, ...args) => ipcRenderer.invoke('nexus', method, ...args),
  onCommand: (callback) => {
    const fn = (_, value) => callback(value);
    ipcRenderer.on('command', fn);
    return () => ipcRenderer.removeListener('command', fn);
  },
  onVisibility: (callback) => {
    const fn = (_, visible) => callback(visible);
    ipcRenderer.on('window-visibility', fn);
    return () => ipcRenderer.removeListener('window-visibility', fn);
  },
});
