const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    requestSource: () => ipcRenderer.invoke('request-screen-capture-source'),
    onGlobalAction: (callback) => ipcRenderer.on('global-action', (event, action) => callback(action))
});
