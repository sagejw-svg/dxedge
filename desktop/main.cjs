'use strict';

const { app, BrowserWindow, session, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server.cjs');

// A short output buffer, and a renderer that keeps the audio clock while the
// window is in the background. The page already asks for an interactive AudioContext.
app.commandLine.appendSwitch('audio-buffer-size', '128');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow = null;
let recordDir = '';

function publicRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'public');
  return path.resolve(__dirname, '..', 'frontend', 'public');
}

function settingsFile() {
  return path.join(app.getPath('userData'), 'desktop-settings.json');
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); }
  catch (e) { return {}; }
}

function writeSettings(extra) {
  const next = Object.assign({}, readSettings(), extra, { recordDir });
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next));
}

function ensureRecordDir() {
  const saved = readSettings().recordDir;
  if (saved && fs.existsSync(saved)) {
    recordDir = saved;
    return;
  }
  recordDir = path.join(app.getPath('music'), 'DXEdge');
  fs.mkdirSync(recordDir, { recursive: true });
  writeSettings({});
}

function safeName(name) {
  const base = path.basename(String(name || 'recording.wav')).replace(/[<>:"|?*\u0000-\u001f]/g, '_');
  return base && base !== '.' && base !== '..' ? base : 'recording.wav';
}

function uniquePath(file) {
  if (!fs.existsSync(file)) return file;
  const dir = path.dirname(file);
  const ext = path.extname(file);
  const stem = path.basename(file, ext);
  for (let i = 2; i < 1000; i++) {
    const next = path.join(dir, stem + '-' + i + ext);
    if (!fs.existsSync(next)) return next;
  }
  return path.join(dir, stem + '-' + Date.now() + ext);
}

function allowPermission(permission) {
  return permission === 'media' || permission === 'audioCapture' || permission === 'midi' || permission === 'midiSysex';
}

async function askFolderOnce() {
  const settings = readSettings();
  if (settings.asked) return;
  const choice = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Use Music/DXEdge', 'Choose a folder'],
    defaultId: 0,
    cancelId: 0,
    title: 'DXEdge recordings',
    message: 'Master recordings save as WAV files in a folder on this computer.',
    detail: recordDir,
  });
  if (choice.response === 1) {
    const picked = await dialog.showOpenDialog({
      title: 'Choose a recordings folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!picked.canceled && picked.filePaths && picked.filePaths[0]) recordDir = picked.filePaths[0];
  }
  fs.mkdirSync(recordDir, { recursive: true });
  writeSettings({ asked: true });
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#14110e',
    title: 'DXEdge Synth',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { host = ''; }
    if (host !== '127.0.0.1' && host !== 'localhost') {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.loadURL(startUrl);
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

if (gotLock) app.whenReady().then(async () => {
  ensureRecordDir();
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowPermission(permission));
  });
  ses.setPermissionCheckHandler((webContents, permission) => allowPermission(permission));
  if (typeof ses.setDevicePermissionHandler === 'function') {
    ses.setDevicePermissionHandler((details) => details.deviceType === 'midi' || details.deviceType === 'hid');
  }
  ses.on('will-download', (event, item) => {
    const name = safeName(item.getFilename());
    if (!name.toLowerCase().endsWith('.wav')) return;
    fs.mkdirSync(recordDir, { recursive: true });
    item.setSavePath(uniquePath(path.join(recordDir, name)));
  });
  ipcMain.handle('record-dir', () => recordDir);
  ipcMain.handle('choose-record-dir', async () => {
    const picked = await dialog.showOpenDialog({
      title: 'Choose a recordings folder',
      defaultPath: recordDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!picked.canceled && picked.filePaths && picked.filePaths[0]) {
      recordDir = picked.filePaths[0];
      fs.mkdirSync(recordDir, { recursive: true });
      writeSettings({ asked: true });
    }
    return recordDir;
  });
  const root = publicRoot();
  const started = await startServer(root);
  await askFolderOnce();
  createWindow(started.url + 'synth/');
});

if (gotLock) app.on('window-all-closed', () => {
  app.quit();
});
