const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Store = require('electron-store');


const store = new Store.default();

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      sandbox: false,
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, '../render/index.html'));

  win.webContents.openDevTools();
}

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Выберите папку'
  });

  if (result.canceled) {
    return { success: false, path: null };
  } else {
    const selectedPath = result.filePaths[0];
    return { success: true, path: selectedPath };
  }
});

// IPC обработчики для работы с хранилищем
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-has', (event, key) => {
  return store.has(key);
});

ipcMain.handle('store-delete', (event, key) => {
  store.delete(key);
  return true;
});

// Для получения всех данных сразу
ipcMain.handle('store-all', () => {
  return store.store;
});


ipcMain.handle('get-directory-contents', async (event, targetPath = __dirname) => {
  try {
    // Читаем содержимое директории с дополнительной информацией
    const files = await fs.readdir(targetPath, { withFileTypes: true });

    // Форматируем результат в удобный для отправки вид
    const formattedFiles = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      isFile: file.isFile(),
      path: path.join(targetPath, file.name)
    }));

    return { success: true, data: formattedFiles };
  } catch (error) {
    console.error('Ошибка чтения директории:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('upload-file', async (event, URL, uploadPath) => {
  try {
    const fileBuffer = fsSync.readFileSync(uploadPath);

    const response = await fetch(URL, {
      method: 'PUT',
      headers: {
        'Content-Type': '.png' || 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString()
      },
      body: fileBuffer
    });

    if (response.status === 201) {
      console.log('✅ Файл успешно загружен!');
      return true;
    } else if (response.status === 507) {
      throw new Error('❌ Недостаточно места на Яндекс.Диске.');
    } else {
      throw new Error(`❌ Ошибка загрузки. Статус: ${response.status}`);
    }
  } catch (error) {
    console.error('Ошибка чтения директории:', error);
    return { success: false, error: error.message };
  }
});



// Сохранение файла (для скачанных файлов)
ipcMain.handle('save-file', async (event, filePath, fileData) => {
  try {
    // Убеждаемся, что папка существует
    const dir = path.dirname(filePath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Конвертируем ArrayBuffer в Buffer (только здесь, в main-процессе)
    const buffer = Buffer.from(fileData);
    await fs.writeFile(filePath, buffer);
    
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения файла:', error);
    return { success: false, error: error.message };
  }
});

// Создание директории
ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Ошибка создания директории:', error);
    return { success: false, error: error.message };
  }
});

// Чтение текстового файла
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content: content };
  } catch (error) {
    console.error('Ошибка чтения файла:', error);
    return { success: false, error: error.message };
  }
});

// Чтение файла как base64 (для изображений)
ipcMain.handle('read-file-base64', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath);
    const base64 = content.toString('base64');
    const extension = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(extension)) {
      mimeType = `image/${extension.substring(1)}`;
    }
    
    return { success: true, data: `data:${mimeType};base64,${base64}` };
  } catch (error) {
    console.error('Ошибка чтения файла:', error);
    return { success: false, error: error.message };
  }
});

// Сохранение текстового файла
ipcMain.handle('save-file-text', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения файла:', error);
    return { success: false, error: error.message };
  }
});

// Открытие файла во внешней программе
const { shell } = require('electron');
ipcMain.handle('open-external', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('Ошибка открытия файла:', error);
    return { success: false, error: error.message };
  }
});

// Переименование файла
ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
  try {
    // Проверяем, существует ли файл со старым именем
    await fs.access(oldPath);
    
    // Проверяем, не существует ли файл с новым именем
    try {
      await fs.access(newPath);
      return { success: false, error: 'Файл с таким именем уже существует' };
    } catch {
      // Файла с новым именем не существует - хорошо
    }
    
    // Переименовываем файл
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('Ошибка переименования файла:', error);
    return { success: false, error: error.message };
  }
});

// Удаление файла
ipcMain.handle('delete-file', async (event, path) => {
  try {
    // Отправляем файл в Корзину
    await shell.trashItem(path);
    return { success: true };
  } catch (error) {
    console.error('Ошибка перемещения в корзину:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);