import { app, BrowserWindow } from 'electron';
import path from 'node:path';

// Disable GPU acceleration (can cause issues on some Windows systems)
app.disableHardwareAcceleration();

// Import IPC handlers
import './ipc/fileHandlers';
import './ipc/detectionHandlers';
import './ipc/exportHandlers';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Note: electron-squirrel-startup handling disabled for development
// Re-enable for production builds if needed

// Global error handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.on('uncaughtException', (err) => {
  console.error('App uncaught exception:', err);
});

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#09090b', // zinc-950
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open the DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

export { mainWindow };
