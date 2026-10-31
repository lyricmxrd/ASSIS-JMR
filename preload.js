// ASSIS — puente seguro entre la app y Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assisPortapapeles', {
  pegar: () => ipcRenderer.invoke('assis:pegar')
});

// Guardado antes de cerrar: el proceso principal avisa, la app guarda
// lo pendiente y confirma para que la ventana pueda cerrarse.
contextBridge.exposeInMainWorld('assisCierre', {
  alGuardar: (cb) => ipcRenderer.on('assis:guardar-antes-de-cerrar', () => cb()),
  confirmar: () => ipcRenderer.send('assis:guardado-confirmado')
});
