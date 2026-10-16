'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dxDesktop', {
  recordingsFolder: () => ipcRenderer.invoke('record-dir'),
  chooseRecordingsFolder: () => ipcRenderer.invoke('choose-record-dir'),
});
