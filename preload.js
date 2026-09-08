const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDb', {
  sendSync(channel, payload) {
    return ipcRenderer.sendSync(channel, payload);
  }
});
