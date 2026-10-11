const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DEBUG_MODE = false; 
let mainWindow = null;
let statusInterval = null;
const LOG_FILE = path.join(app.getPath('desktop'), 'rayneo_debug.log');

function writeLog(text) {
    if (!DEBUG_MODE) return;
    const timestamp = new Date().toLocaleTimeString();
    const msg = `[${timestamp}] ${text}\n`;
    console.log(msg.trim());
    try { fs.appendFileSync(LOG_FILE, msg, 'utf8'); } catch(e) {}
}

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function isExtendedDisplayActive() {
    const displays = screen.getAllDisplays();
    return displays.length > 1 && displays.some(d => d.bounds.x > 0 || d.bounds.y > 0);
}

function createMainWindow() {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const isActive = isExtendedDisplayActive();

    if (!isActive) {
        dialog.showMessageBoxSync({
            type: 'warning',
            title: 'RayNeo Workspace Error',
            message: 'Hardware Initialization Failed',
            detail: '1. CONNECT HARDWARE: Ensure your RayNeo glasses are plugged in.\n2. DISPLAY SETTINGS: Change your display configuration from "Mirror" to "Use as Extended Display" in macOS System Settings!',
            buttons: ['OK']
        });
        app.quit();
        return;
    }

    let targetDisplay = displays.find(d => d.bounds.x > 0 || d.bounds.y > 0) || primaryDisplay;

    mainWindow = new BrowserWindow({
        x: targetDisplay.bounds.x, 
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height,
        frame: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        type: 'panel',
        backgroundColor: "#000000",
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true,
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function monitorEngine() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const isActive = isExtendedDisplayActive();
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    mainWindow.webContents.send('global-action', { hardwareStatus: isActive });

    if (isActive) {
        const freshGlasses = displays.find(d => d.bounds.x > 0 || d.bounds.y > 0);
        if (freshGlasses && mainWindow.getPosition()[0] !== freshGlasses.bounds.x) {
            mainWindow.setPosition(freshGlasses.bounds.x, freshGlasses.bounds.y);
            mainWindow.setSize(freshGlasses.bounds.width, freshGlasses.bounds.height);
            mainWindow.setAlwaysOnTop(true);
        }
        
    } else {
        if (mainWindow.getPosition()[0] !== primaryDisplay.bounds.x) {
            mainWindow.setAlwaysOnTop(false);
            mainWindow.setPosition(primaryDisplay.bounds.x, primaryDisplay.bounds.y);
            mainWindow.setSize(primaryDisplay.bounds.width, primaryDisplay.bounds.height);
        }
    }
}

app.whenReady().then(() => {
    createMainWindow();
    
    statusInterval = setInterval(() => {
        monitorEngine();
    }, 2000);

    globalShortcut.register('Alt+Up', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'zoom-in'); });
    globalShortcut.register('Alt+Down', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'zoom-out'); });
    globalShortcut.register('Alt+Shift+Left', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'pan-links'); });
    globalShortcut.register('Alt+Shift+Right', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'pan-rechts'); });
    globalShortcut.register('Alt+Shift+Up', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'pan-oben'); });
    globalShortcut.register('Alt+Shift+Down', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'pan-unten'); });
    globalShortcut.register('Alt+H', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'toggle-help'); });
    globalShortcut.register('Alt+A', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'toggle-ambient'); });
    globalShortcut.register('Alt+B', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'toggle-border'); });
    globalShortcut.register('Alt+Control+Up', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'dim-up'); });
    globalShortcut.register('Alt+Control+Down', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'dim-down'); });
    globalShortcut.register('Alt+R', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'reset'); });
    globalShortcut.register('Alt+S', () => { if (mainWindow) mainWindow.webContents.send('global-action', 'toggle-lock'); });
    globalShortcut.register('Alt+Q', () => { app.quit(); });

    ipcMain.handle('request-screen-capture-source', async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
            if (sources.length > 0) {
                return sources[0].id;
            }
            return null;
        } catch (err) {
            return null;
        }
    });
});

app.on('will-quit', () => {
    if (statusInterval) clearInterval(statusInterval);
    globalShortcut.unregisterAll(); 
});
app.on('window-all-closed', () => { app.quit(); });
