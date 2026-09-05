const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');


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
  renameObject: (oldPath, newPath) => ipcRenderer.invoke('rename-object', oldPath, newPath),
  deleteElement: (path) => ipcRenderer.invoke('delete-element', path)
});

contextBridge.exposeInMainWorld('yandexAPI', {
  upload: (URL, uploadPath) => ipcRenderer.invoke('upload-file', URL, uploadPath),
});

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (filePath, fileData) => ipcRenderer.invoke('save-file', filePath, fileData),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  openExternal: (filePath) => ipcRenderer.invoke('open-external', filePath),
  createFile: (filePath, fileExtension) => ipcRenderer.invoke('create-file', filePath, fileExtension)

});

contextBridge.exposeInMainWorld('path', {
  join: (...args) => path.join(...args),
  basename: (p) => path.basename(p),
  dirname: (p) => path.dirname(p),
  extname: (p) => path.extname(p),
  isAbsolute: (p) => path.isAbsolute(p),
  sep: path.sep,
  normalize: (p) => path.normalize(p),
  relative: (from, to) => path.relative(from, to),
  resolve: (...args) => path.resolve(...args)
});

contextBridge.exposeInMainWorld('osInfo', {
  platform: process.platform,
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin'
});

console.log('✅ Preload script loaded successfully');
