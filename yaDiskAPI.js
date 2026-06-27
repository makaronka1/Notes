async function getDiskInfo() {
  const token = await window.electronStore.get('token');
  const response = await fetch('https://cloud-api.yandex.net/v1/disk/resources?path=app:/', {
    method: 'GET',
    headers: { 'Authorization': `OAuth ${token}` }
  });
  const data = await response.json();
  console.log(data);
}

async function getURLForUpload() {
  const token = await window.electronStore.get('token');
  const response = await fetch('https://cloud-api.yandex.net/v1/disk/resources/upload?path=app:/image123.png&overwrite=true', {
    method: 'GET',
    headers: { 'Authorization': `OAuth ${token}` }
  });
  const data = await response.json();
  return data['href'];
}

async function getFolderContentsAPI(path = '/Приложения/Notes') {
  const encodedPath = encodeURIComponent(path);
  const token = await window.electronStore.get('token');

  const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodedPath}&limit=100`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка API: ${response.status} - ${errorData.message}`);
    }

    const data = await response.json();
    const items = data._embedded?.items || [];
    
    // Форматируем в тот же формат, что и локальная getFiles
    const formattedFiles = items.map(item => ({
      name: item.name,
      isDirectory: item.type === 'dir',
      isFile: item.type === 'file',
      path: item.path,
      size: item.size,
      modified: item.modified
    }));

    return { success: true, data: formattedFiles };

  } catch (error) {
    console.error('Ошибка:', error.message);
    return { success: false, data: [], error: error.message };
  }
}

async function getAllFilesFromCloud(path = null, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return { children: [] };
  
  // Если путь не указан, используем путь по умолчанию
  let folder = path || '/Приложения/Notes';
  
  // Получаем содержимое папки
  const result = await getFolderContentsAPI(folder);
  
  if (!result.success) {
    console.error('Ошибка получения содержимого папки:', result.error);
    return { children: [] };
  }
  
  let items = result.data;
  let children = [];
  
  for (let item of items) {
    const node = {
      name: item.name,
      type: item.isDirectory ? 'directory' : 'file',
      path: item.path
    };
    
    if (item.isDirectory) {
      const subTree = await getAllFilesFromCloud(item.path, depth + 1, maxDepth);
      node.children = subTree.children || [];
    }
    
    children.push(node);
  }
  
  // Получаем имя папки из пути
  const folderName = folder.split('/').pop();
  
  return {
    name: folderName,
    type: 'directory',
    path: folder,
    children: children
  };
}

async function fullUploadFile() {
  const uploadURL = await getURLForUpload();

  await window.yandexAPI.upload(uploadURL, './image.png');
}


// Функция получения URL для скачивания файла из облака
async function getDownloadUrl(cloudFilePath) {
  const token = await window.electronStore.get('token');
  const encodedPath = encodeURIComponent(cloudFilePath);
  
  const url = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodedPath}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка API: ${response.status} - ${errorData.message}`);
    }
    
    const data = await response.json();
    console.log('✅ Получен URL для скачивания:', data.href);
    return data.href;
    
  } catch (error) {
    console.error('❌ Ошибка получения URL для скачивания:', error.message);
    return null;
  }
}

// Функция скачивания файла по полученному URL
async function downloadFileByUrl(downloadUrl, savePath) {
  try {
    const response = await fetch(downloadUrl, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка скачивания: ${response.status} ${response.statusText}`);
    }
    
    // Получаем данные как Blob
    const blob = await response.blob();
    
    // Конвертируем Blob в ArrayBuffer для передачи через IPC
    const arrayBuffer = await blob.arrayBuffer();
    
    // Передаём данные в main-процесс для сохранения
    const saveResult = await window.electronAPI.saveFile(savePath, arrayBuffer);
    
    if (saveResult.success) {
      console.log(`✅ Файл сохранён: ${savePath}`);
      return { success: true, path: savePath };
    } else {
      throw new Error(saveResult.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка скачивания:', error.message);
    return { success: false, error: error.message };
  }
}

// Основная функция скачивания файла из облака
async function downloadFileFromCloud(cloudFilePath, localSavePath = null) {
  try {
    // 1. Получаем URL для скачивания
    const downloadUrl = await getDownloadUrl(cloudFilePath);
    
    if (!downloadUrl) {
      throw new Error('Не удалось получить URL для скачивания');
    }
    
    // 2. Если локальный путь не указан, используем имя файла из облачного пути
    if (!localSavePath) {
      const fileName = cloudFilePath.split('/').pop();
      const downloadsFolder = await getField('downloadsFolder') || './downloads';
      localSavePath = `${downloadsFolder}/${fileName}`;
    }
    
    // 3. Скачиваем и сохраняем файл
    const result = await downloadFileByUrl(downloadUrl, localSavePath);
    
    return result;
    
  } catch (error) {
    console.error('❌ Ошибка скачивания файла из облака:', error.message);
    return { success: false, error: error.message };
  }
}

// Функция скачивания всех файлов из облачной папки
async function downloadAllFilesFromCloud(cloudPath = '/Приложения/Notes', localBasePath = null) {
  // Если локальный базовый путь не указан, используем выбранную пользователем папку
  if (!localBasePath) {
    localBasePath = await getField('folder') || './cloud_downloads';
  }
  
  console.log(`☁️ Начинаем скачивание из облачной папки: ${cloudPath}`);
  console.log(`💾 Локальная папка: ${localBasePath}`);
  
  // Получаем содержимое облачной папки
  const result = await getFolderContentsAPI(cloudPath);
  
  if (!result.success) {
    console.error('❌ Ошибка получения содержимого папки:', result.error);
    return { success: false, error: result.error };
  }
  
  const items = result.data;
  const results = {
    success: [],
    failed: [],
    total: items.length
  };
  
  for (const item of items) {
    const localItemPath = `${localBasePath}/${item.name}`;
    
    if (item.isFile) {
      console.log(`📥 Скачиваем файл: ${item.name}`);
      
      try {
        const downloadResult = await downloadFileFromCloud(item.path, localItemPath);
        
        if (downloadResult.success) {
          results.success.push({ name: item.name, path: localItemPath });
          console.log(`✅ Файл скачан: ${item.name}`);
        } else {
          results.failed.push({ name: item.name, error: downloadResult.error });
          console.error(`❌ Ошибка скачивания ${item.name}:`, downloadResult.error);
        }
      } catch (error) {
        results.failed.push({ name: item.name, error: error.message });
      }
      
    } else if (item.isDirectory) {
      console.log(`📁 Обрабатываем папку: ${item.name}`);
      
      // Создаём локальную папку
      const dirCreated = await createLocalDirectory(localItemPath);
      
      if (dirCreated) {
        // Рекурсивно скачиваем содержимое папки
        const subResult = await downloadAllFilesFromCloud(item.path, localItemPath);
        results.success.push(...subResult.success);
        results.failed.push(...subResult.failed);
      } else {
        results.failed.push({ name: item.name, error: 'Не удалось создать локальную папку' });
      }
    }
  }
  
  console.log('📊 Итоги скачивания:');
  console.log(`✅ Успешно: ${results.success.length} файлов`);
  console.log(`❌ Ошибок: ${results.failed.length} файлов`);
  
  return results;
}