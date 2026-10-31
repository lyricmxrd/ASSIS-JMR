// ASSIS — proceso principal de Electron
// App 100% local: los datos viven en IndexedDB dentro del perfil de la app
// (carpeta de datos del usuario de Windows), sin necesitar internet.
// Al abrirla busca actualizaciones en GitHub (si hay internet) y avisa.
const { app, BrowserWindow, shell, Menu, ipcMain, clipboard, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

/* ───────── ACTUALIZACIONES ───────── */
let chequeoManual = false;

function initUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una versión nueva de ASSIS (${info.version}). Se está descargando en segundo plano; te aviso cuando esté lista para instalar.`,
      buttons: ['Entendido']
    });
  });
  autoUpdater.on('update-not-available', () => {
    if (!chequeoManual) return;
    chequeoManual = false;
    dialog.showMessageBox({
      type: 'info',
      title: 'ASSIS está actualizado',
      message: `Ya tienes la última versión (${app.getVersion()}).`,
      buttons: ['Aceptar']
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'question',
      title: 'Actualización lista',
      message: `La versión ${info.version} de ASSIS ya se descargó. ¿Quieres reiniciar la app ahora para instalarla? Tus datos no se tocan.`,
      buttons: ['Reiniciar e instalar', 'Más tarde']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on('error', () => {
    if (!chequeoManual) return;
    chequeoManual = false;
    dialog.showMessageBox({
      type: 'warning',
      title: 'Sin conexión',
      message: 'No se pudo buscar actualizaciones. Revisa tu conexión a internet e inténtalo de nuevo.',
      buttons: ['Aceptar']
    });
  });

  // Revisión automática al abrir (silenciosa si no hay nada nuevo)
  autoUpdater.checkForUpdates().catch(() => {});
}

function buscarActualizacionesManual() {
  if (!app.isPackaged) return;
  chequeoManual = true;
  autoUpdater.checkForUpdates().catch(() => {
    chequeoManual = false;
    dialog.showMessageBox({
      type: 'warning',
      title: 'Sin conexión',
      message: 'No se pudo buscar actualizaciones. Revisa tu conexión a internet.',
      buttons: ['Aceptar']
    });
  });
}

/* ───────── MENÚ ─────────
   Con roles de edición: SIN esto, en Windows los atajos Ctrl+C / Ctrl+V /
   Ctrl+X no llegan a los campos de la app ni aparece el menú de clic derecho. */
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
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Buscar actualizaciones…', click: () => buscarActualizacionesManual() },
        {
          label: 'Acerca de ASSIS',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'Acerca de ASSIS',
            message: `ASSIS — Asistencia Escolar\nVersión ${app.getVersion()}\nLos datos se guardan en esta computadora; el respaldo en la nube es manual (botones Respaldar / Restaurar).`,
            buttons: ['Aceptar']
          })
        }
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
    title: `ASSIS - Asistencia Escolar (v${app.getVersion()})`,
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
  // Antes de cerrar, la app guarda lo que esté pendiente de escribir.
  // Se intercepta el cierre, se le pide al contenido que guarde y se
  // espera su confirmación (con un máximo de 700 ms por seguridad).
  let cierreListo = false;
  win.on('close', (e) => {
    if (cierreListo) return;
    e.preventDefault();
    const seguro = setTimeout(() => { cierreListo = true; win.close(); }, 700);
    ipcMain.once('assis:guardado-confirmado', () => {
      clearTimeout(seguro);
      cierreListo = true;
      win.close();
    });
    win.webContents.send('assis:guardar-antes-de-cerrar');
  });
  win.webContents.on('did-finish-load', () => win.setTitle(`ASSIS - Asistencia Escolar (v${app.getVersion()})`));
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  initUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
