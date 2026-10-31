// ASSIS — proceso principal de Electron
// App 100% local: los datos viven en IndexedDB dentro del perfil de la app
// (carpeta de datos del usuario de Windows), sin necesitar internet.
const { app, BrowserWindow, shell, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');

// Menú con roles de edición: SIN esto, en Windows los atajos Ctrl+C / Ctrl+V /
// Ctrl+X no llegan a los campos de la app ni aparece el menú de clic derecho.
function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [{ role: 'quit', label: 'Salir' }]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Pegar desde el proceso principal (lo usa el botón «Pegar» de la app)
ipcMain.handle('assis:pegar', () => clipboard.readText());

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'ASSIS - Asistencia Escolar',
    icon: path.join(__dirname, 'app', 'assets', 'logo-app.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  // Menú contextual (clic derecho) con Cortar / Copiar / Pegar
  win.webContents.on('context-menu', (_e, params) => {
    const template = params.isEditable
      ? [
          { role: 'cut', label: 'Cortar' },
          { role: 'copy', label: 'Copiar' },
          { role: 'paste', label: 'Pegar' },
          { type: 'separator' },
          { role: 'selectAll', label: 'Seleccionar todo' }
        ]
      : [
          { role: 'copy', label: 'Copiar' },
          { role: 'selectAll', label: 'Seleccionar todo' }
        ];
    Menu.buildFromTemplate(template).popup({ window: win });
  });
  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
