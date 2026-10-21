const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Single Instance Lock: Prevent multiple instances of the app from running simultaneously
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Electron] Another instance is already running. Quitting this instance.');
  app.quit();
  process.exit(0);
}

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'KirinTerminal',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  });

  Menu.setApplicationMenu(null);

  // Show window only when ready to avoid black screen flicker
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Safety fallback in case ready-to-show doesn't fire within 1.2 seconds
  const showFallbackTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn('[Electron] Showing window via quick fallback');
      mainWindow.show();
    }
  }, 1200);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Log] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Renderer Load Error] ${errorCode}: ${errorDescription}`);
  });

  // Force external links and window.open to use the OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Enable F12 or Ctrl+Shift+I to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools();
      }
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (devUrl) {
    console.log('[Electron] Loading dev server:', devUrl);
    mainWindow.loadURL(devUrl).catch(() => {
      setTimeout(() => mainWindow && mainWindow.loadURL(devUrl), 1500);
    });
  } else if (fs.existsSync(distPath)) {
    console.log('[Electron] Loading production build:', distPath);
    mainWindow.loadFile(distPath);
  } else {
    console.warn('[Electron] Production build not found at:', distPath);
    const missingBuildHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>KirinTerminal - Build Missing</title>
          <style>
            body {
              background-color: #1e1e1e;
              color: #f3f4f6;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background: #252526;
              border: 1px solid #eab308;
              border-radius: 8px;
              padding: 28px;
              max-width: 520px;
              text-align: center;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            h2 { color: #facc15; margin-top: 0; }
            code { background: #374151; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #60a5fa; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Production Build Not Found</h2>
            <p>The application distribution file (<code>dist/index.html</code>) was not found.</p>
            <p>Please run <code>npm run build</code> in the project directory or run <code>start-app.bat</code> to build and launch.</p>
          </div>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(missingBuildHtml)}`);
  }

  mainWindow.on('closed', () => {
    clearTimeout(showFallbackTimeout);
    mainWindow = null;
  });
}

// ---- Data Persistence (config.json) ----
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) { console.error('Error reading config', e); }
  return {};
}

function writeConfig(key, value) {
  try {
    const configPath = getConfigPath();
    const config = readConfig();
    if (value === null || value === undefined) {
      delete config[key];
    } else {
      config[key] = value;
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) { console.error('Error writing config', e); }
}

ipcMain.on('store-get-sync', (event, key) => {
  const config = readConfig();
  event.returnValue = config[key] !== undefined ? config[key] : null;
});
ipcMain.on('store-set-sync', (event, key, value) => {
  writeConfig(key, value);
  event.returnValue = true;
});

ipcMain.handle('sftp-save-file', async (event, { fileName, dataBase64 }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: fileName,
    title: 'Save File from SFTP'
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, Buffer.from(dataBase64, 'base64'));
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Cancelled' };
});

// Focus existing window when a second instance tries to launch
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ---- App Lifecycle ----
app.whenReady().then(() => {
  // Start the PTY/SSH WebSocket server directly inside the Electron main process
  console.log('[Electron] Starting PTY/SSH server in main process...');
  require('../server/pty-server.js');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
