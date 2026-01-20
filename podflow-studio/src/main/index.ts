import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'node:path';
import { setMainWindow, getMainWindow } from './window';

// Import IPC handlers - this registers them with ipcMain
import './ipc/fileHandlers';
import './ipc/detectionHandlers';
import './ipc/exportHandlers';

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
  // Remove the default Electron menu bar
  Menu.setApplicationMenu(null);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    useContentSize: true,
    backgroundColor: '#0D1117',
    title: 'PodFlow',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

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

  // Check if Python is available
  const { spawn } = require('child_process');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pythonTest = spawn(pythonCmd, ['--version']);
  
  pythonTest.on('error', (err: Error) => {
    console.error('Python NOT available:', err.message);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Python Required',
      `Python 3.8+ must be installed for clip detection to work.\n\nPlease download and install Python from python.org, then restart the app.\n\nCommand attempted: ${pythonCmd}`
    );
  });
  
  pythonTest.stdout?.on('data', (data: Buffer) => {
    console.log('Python available:', data.toString().trim());
  });

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
