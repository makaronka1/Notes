const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Store = require('electron-store');

let mainWindow = null;
const store = new Store.default();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      sandbox: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, '../render/index.html'));

  mainWindow.webContents.openDevTools();
}

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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
    // Проверяем, существует ли папка
    try {
      await fs.access(dirPath);
      // Папка существует → генерируем новое имя
      const dirName = path.basename(dirPath);
      const parentDir = path.dirname(dirPath);
      
      let counter = 2;
      let newDirPath = path.join(parentDir, `${dirName} (${counter})`);
      
      // Продолжаем увеличивать счётчик, пока не найдём свободное имя
      while (true) {
        try {
          await fs.access(newDirPath);
          counter++;
          newDirPath = path.join(parentDir, `${dirName} (${counter})`);
        } catch {
          // Папки с таким именем нет — выходим из цикла
          break;
        }
      }
      
      // Создаём папку с новым именем
      await fs.mkdir(newDirPath, { recursive: true });
      return { success: true, path: newDirPath, name: path.basename(newDirPath) };
      
    } catch {
      // Папки не существует — создаём с переданным именем
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true, path: dirPath, name: path.basename(dirPath) };
    }
  } catch (error) {
    console.error('Ошибка создания директории:', error);
    return { success: false, error: error.message };
  }
});

//создание файла
ipcMain.handle('create-file', async (event, filePath, fileExtension) => {
  try {
    try {
      await fs.access(filePath + fileExtension);
      // Папка существует → генерируем новое имя
      const fileName = path.basename(filePath);
      const parentDir = path.dirname(filePath);
      
      let counter = 2;
      let newFilePath = path.join(parentDir, `${fileName} (${counter})` + fileExtension);
      
      // Продолжаем увеличивать счётчик, пока не найдём свободное имя
      while (true) {
        try {
          await fs.access(newFilePath);
          counter++;
          newFilePath = path.join(parentDir, `${fileName} (${counter})` + fileExtension);
        } catch {
          // Файла с таким именем нет — выходим из цикла
          break;
        }
      }
      
      // Создаём файл с новым именем
      await fs.writeFile(newFilePath, '', { recursive: true });
      return { success: true, path: newFilePath, name: path.basename(newFilePath) };
      
    } catch {
      // Файла не существует — создаём с переданным именем
      await fs.writeFile(filePath + fileExtension, '', { recursive: true });
      return { success: true, path: filePath, name: path.basename(filePath) };
    }
  } catch (error) {
    console.error('Ошибка создания файла:', error);
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

// Переименование объекта
ipcMain.handle('rename-object', async (event, oldPath, newPath) => {
  try {
    // Проверяем, существует ли объект со старым именем
    await fs.access(oldPath);

    // Проверяем, не существует ли объект с новым именем
    try {
      await fs.access(newPath);
      return { success: false, error: 'Объект с таким именем уже существует' + newPath };
    } catch {
      // Объект с новым именем не существует - хорошо
    }
    
    // Переименовываем объект
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('Ошибка переименования объекта:', error);
    return { success: false, error: error.message };
  }
});

// Удаление файла
ipcMain.handle('delete-element', async (event, path) => {
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