const { contextBridge, ipcRenderer } = require('electron');

// НЕ ПОДКЛЮЧАЕМ electronStoreFunctions, yaDiskAPI, notify здесь
// Они будут работать через IPC

contextBridge.exposeInMainWorld('electronStore', {
  get: (key) => ipcRenderer.invoke('store-get', key),
  set: (key, value) => ipcRenderer.invoke('store-set', key, value),
  has: (key) => ipcRenderer.invoke('store-has', key),
  delete: (key) => ipcRenderer.invoke('store-delete', key),
  getAll: () => ipcRenderer.invoke('store-all')
});

contextBridge.exposeInMainWorld('fileSystem', {
  get: (path) => ipcRenderer.invoke('get-directory-contents', path),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readFileAsBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file-text', filePath, content),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath)
});

contextBridge.exposeInMainWorld('yandexAPI', {
  upload: (URL, uploadPath) => ipcRenderer.invoke('upload-file', URL, uploadPath),
});

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (filePath, fileData) => ipcRenderer.invoke('save-file', filePath, fileData),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  openExternal: (filePath) => ipcRenderer.invoke('open-external', filePath)
});

console.log('✅ Preload script loaded successfully');
