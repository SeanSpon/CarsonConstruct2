import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { setMainWindow } from './window';

// Import IPC handlers - this registers them with ipcMain
import './ipc/fileHandlers';
import './ipc/detectionHandlers';
import './ipc/exportHandlers';
import './ipc/reviewHandlers';
import './ipc/cloudHandlers';
import './ipc/premiereExport';
import './ipc/cameraHandlers';
import './ipc/qaHandlers';
import './ipc/mediaLibraryHandlers';
import { registerAiEffectsHandlers } from './ipc/aiEffectsHandlers';
import { registerProjectFileHandlers } from './ipc/projectFileHandlers';
import { registerChatHandlers } from './ipc/chatHandlers';

// Register AI effects handlers
registerAiEffectsHandlers();

// Register project file handlers
registerProjectFileHandlers();

// Register chat handlers
registerChatHandlers();

console.log('=== [MAIN] All imports complete, IPC handlers registered ===');

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
    title: 'PodFlow Studio',
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
