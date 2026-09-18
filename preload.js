const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDb', {
  exportPendingServices(options) {
    return ipcRenderer.invoke('payments:export-pending', options);
  },
  sendSync(channel, payload) {
    return ipcRenderer.sendSync(channel, payload);
  }
});
