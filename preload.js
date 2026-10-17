const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDb', {
  databaseChallenge() { return ipcRenderer.invoke('database:challenge'); },
  exportDatabase() { return ipcRenderer.invoke('database:export'); },
  importDatabase() { return ipcRenderer.invoke('database:import'); },
  deleteDatabase(text) { return ipcRenderer.invoke('database:delete', text); },
  exportServiceReport(options) {
    return ipcRenderer.invoke('services:export-report', options);
  },
  exportServiceCalendar(options) {
    return ipcRenderer.invoke('services:export-calendar', options);
  },
  exportQuotation(options) {
    return ipcRenderer.invoke('quotations:export', options);
  },
  exportPendingServices(options) {
    return ipcRenderer.invoke('payments:export-pending', options);
  },
  sendSync(channel, payload) {
    return ipcRenderer.sendSync(channel, payload);
  }
});
