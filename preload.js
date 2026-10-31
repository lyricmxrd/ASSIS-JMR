// ASSIS — puente seguro entre la app y Electron (solo portapapeles)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assisPortapapeles', {
  pegar: () => ipcRenderer.invoke('assis:pegar')
});
