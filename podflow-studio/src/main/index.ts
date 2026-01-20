import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'node:path';
import { setMainWindow, getMainWindow } from './window';

// Import IPC handlers - this registers them with ipcMain
import './ipc/fileHandlers';
import './ipc/detectionHandlers';
import './ipc/exportHandlers';
import './ipc/reviewHandlers';
import './ipc/cloudHandlers';
import './ipc/premiereExport';
import './ipc/qaHandlers';
import './ipc/instagramHandlers';
import './ipc/styleHandlers';
import { registerProjectFileHandlers } from './ipc/projectFileHandlers';

// Register project file handlers
registerProjectFileHandlers();

// Window control handlers
ipcMain.on('window-minimize', () => {
  const win = getMainWindow();
  if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
  const win = getMainWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  const win = getMainWindow();
  if (win) win.close();
});

console.log('=== [MAIN] IPC handlers registered ===');

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const createWindow = () => {
  // Remove the default Electron menu bar (we use a custom menu in the renderer)
  Menu.setApplicationMenu(null);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    useContentSize: true, // Use content area size instead of window frame size
    backgroundColor: '#0D1117', // Match app background to prevent white flash on resize
    title: 'Opus AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload scripts to work with contextIsolation
      webSecurity: false, // Allow loading local files (needed for video playback)
    },
  });

  // Store the window reference so IPC handlers can access it
  setMainWindow(mainWindow);

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    mainWindow.loadFile(filePath);
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
