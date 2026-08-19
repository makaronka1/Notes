let btn = document.querySelector('#btn');
let sendBtn = document.querySelector('#sendBtn');
let sideBar = document.querySelector('.side-bar');
let selectedFolderPath = null;
let openFolders = new Set();

async function getFiles(path) {
  let files = await window.fileSystem.get(path);

  return files.data;
}

async function getAllFilesFromFileSystem(path = null, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return { children: [] };
  
  let folder = path || await getField('folder');
  let items = await getFiles(folder);
  let children = [];
  
  for (let item of items) {
    const node = {
      name: item.name,
      type: item.isDirectory ? 'directory' : 'file',
      path: item.path
    };
    
    if (item.isDirectory) {
      const subTree = await getAllFilesFromFileSystem(item.path, depth + 1, maxDepth);
      node.children = subTree.children || []; // Берём только массив children
    }
    
    children.push(node);
  }
  
  const folderName = folder.split('\\').pop();
  return {
    name: folderName,
    type: 'directory',
    path: folder,
    children: children  // children всегда должен быть плоским массивом
  };
}

async function handleSelectFolder() {
  const result = await window.electronAPI.selectFolder();

  if (result.success) {
    selectedFolderPath = result.path;
    await setField('folder', selectedFolderPath);
    console.log('Выбрана папка:', selectedFolderPath);
  } else {
    console.log('Пользователь отменил выбор папки.');
  }
}


async function renderFileTree() {
  const tree = await getAllFilesFromFileSystem();
  const sideBar = document.querySelector('.side-bar');
  
  sideBar.innerHTML = '';
  
  const rootNode = createTreeNode(tree);
  rootNode.classList.add('root-tree-node');
  
  // ✅ Корневая папка всегда открыта
  const rootSpan = rootNode.querySelector('.directory-item');
  const rootChildUl = rootNode.querySelector('.tree-children');
  
  if (rootSpan && rootChildUl) {
    // Добавляем корневую папку в открытые (если ещё не добавлена)
    if (tree.path && !openFolders.has(tree.path)) {
      openFolders.add(tree.path);
    }
    
    rootChildUl.style.display = 'block';
    setTimeout(() => {
      rootChildUl.classList.add('open');
    }, 10);
    const folderIcon = rootSpan.querySelector('.folder-icon');
    if (folderIcon) folderIcon.textContent = '📂';
  }
  
  sideBar.appendChild(rootNode);
}

function getDisplayName(item) {
  if (item.type === 'directory') {
    return item.name;
  }
  // Для файлов убираем расширение
  const lastDotIndex = item.name.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return item.name.substring(0, lastDotIndex);
  }
  return item.name;
}

function createTreeNode(item, isRoot = false) {
  const li = document.createElement('li');
  li.className = 'tree-node';
  li.dataset.path = item.path;
  li.dataset.type = item.type;
  
  const span = document.createElement('span');
  const displayName = getDisplayName(item);
  span.textContent = displayName;
  span.className = item.type === 'directory' ? 'directory-item' : 'file-item';
  span.dataset.path = item.path;
  
  // Добавляем иконки
  if (item.type === 'directory') {
    span.innerHTML = '<span class="folder-icon">📁</span> ' + span.textContent;
  } else {
    span.innerHTML = '📄 ' + span.textContent;
  }
  
  // Обработчик для файлов
  if (item.type === 'file') {
    span.style.cursor = 'pointer';
    const clickHandler = async () => {
      console.log('Выбран файл:', item.path);
      await openFileInMainPlace(item.path);
    };
    span._clickHandler = clickHandler;
    span.addEventListener('click', clickHandler);
    li.appendChild(span);
  }
  
  // Обработчик для папок
  if (item.type === 'directory') {
    span.style.cursor = 'pointer';
    
    const childUl = document.createElement('ul');
    childUl.className = 'tree-children';
    childUl.dataset.parentPath = item.path;
    
    const children = item.children || [];
    
    if (children.length > 0) {
      children.forEach(child => {
        const childLi = createTreeNode(child);
        childUl.appendChild(childLi);
      });
    } else {
      const emptyMsg = document.createElement('li');
      emptyMsg.textContent = 'Папка пуста';
      emptyMsg.style.color = '#999';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.style.padding = '4px 8px';
      childUl.appendChild(emptyMsg);
    }
    
    // ✅ Восстанавливаем состояние открытия из global Set
    const wasOpen = openFolders.has(item.path);
    
    if (wasOpen) {
      childUl.style.display = 'block';
      setTimeout(() => {
        childUl.classList.add('open');
      }, 10);
      const folderIcon = span.querySelector('.folder-icon');
      if (folderIcon) folderIcon.textContent = '📂';
    } else {
      childUl.style.display = 'none';
    }
    
    let isOpen = wasOpen;
    
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const folderIcon = span.querySelector('.folder-icon');
      
      if (isOpen) {
        childUl.classList.remove('open');
        setTimeout(() => {
          if (!childUl.classList.contains('open')) {
            childUl.style.display = 'none';
          }
        }, 250);
        if (folderIcon) folderIcon.textContent = '📁';
        // ✅ Удаляем из открытых
        openFolders.delete(item.path);
      } else {
        childUl.style.display = 'block';
        setTimeout(() => {
          childUl.classList.add('open');
        }, 10);
        if (folderIcon) folderIcon.textContent = '📂';
        // ✅ Добавляем в открытые
        openFolders.add(item.path);
      }
      isOpen = !isOpen;
    });
    
    li.appendChild(span);
    li.appendChild(childUl);
  }
  
  return li;
}


(async () => {
  await renderFileTree();
})();


//btn.addEventListener('click', setName); // Вызываем функцию

// Функция открытия файла в главной области
async function openFileInMainPlace(filePath) {
  const mainPlace = document.querySelector('.main-place');
  
  // Убеждаемся, что путь абсолютный
  let absolutePath = filePath;
  if (!filePath.includes(':\\') && !filePath.startsWith('/') && !filePath.includes(':/')) {
    const currentDir = await getField('folder');
    if (currentDir) {
      absolutePath = `${currentDir}\\${filePath}`;
    }
  }
  
  // Определяем тип файла по расширению
  const fileExtension = absolutePath.split('.').pop().toLowerCase();
  const fullFileName = absolutePath.split('\\').pop().split('/').pop();
  const fileNameWithoutExtension = getFileNameWithoutExtension(fullFileName);
  
  // Создаём объект состояния
  const state = {
    currentFilePath: absolutePath,
    currentFullFileName: fullFileName,
    currentFileExtension: fileExtension,
    currentFileNameWithoutExtension: fileNameWithoutExtension,
    saveTimeout: null
  };
  
  // Создаём интерфейс
  const fileViewer = createFileViewer();
  const titleInput = createTitleInput(fileNameWithoutExtension);

  fileViewer.setAttribute('data-path', filePath);
  
  // Обработчик изменения имени с задержкой 1 секунда
  titleInput.addEventListener('input', (e) => {
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }
    
    const newValue = e.target.value.trim();
    
    state.saveTimeout = setTimeout(async () => {
      // ✅ Используем объединённую функцию
      await saveFileChanges(state, newValue, null, titleInput);
      state.saveTimeout = null;
    }, 1000);
  });
  
  fileViewer.appendChild(titleInput);
  
  try {
    // Читаем и отображаем файл
    const contentElement = await readFile(state);
    if (contentElement) {
      fileViewer.appendChild(contentElement);
      
      // ✅ Добавляем обработчик для сохранения содержимого
      if (contentElement.tagName === 'PRE') {
        // Для текстовых файлов - сохраняем при потере фокуса или по Ctrl+S
        contentElement.addEventListener('blur', async () => {
          const newContent = contentElement.textContent;
          // ✅ Используем объединённую функцию
          await saveFileChanges(state, null, newContent, null, contentElement);
        });
        
        // Ctrl+S для сохранения
        contentElement.addEventListener('keydown', async (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const newContent = contentElement.textContent;
            // ✅ Используем объединённую функцию
            const result = await saveFileChanges(state, null, newContent, null, contentElement);
            if (result.success) {
              console.log('✅ Файл сохранён!');
            } else {
              alert(`❌ Ошибка сохранения: ${result.error}`);
            }
          }
        });
      }
    } else {
      throw new Error('Не удалось прочитать файл');
    }
    
  } catch (error) {
    console.error('Ошибка открытия файла:', error);
    // ... обработка ошибок
  }
  
  mainPlace.innerHTML = '';
  mainPlace.appendChild(fileViewer);
}

// Вспомогательная функция: проверка текстового файла
function isTextFile(extension) {
  const textExtensions = ['txt', 'md', 'js', 'json', 'css', 'html', 'xml', 'svg', 'py', 'java', 'c', 'cpp', 'h', 'ini', 'cfg', 'conf', 'log'];
  return textExtensions.includes(extension);
}

// Вспомогательная функция: проверка изображения
function isImageFile(extension) {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg'];
  return imageExtensions.includes(extension);
}

// Функция чтения файла как base64 для изображений
async function readFileAsBase64(filePath) {
  const result = await window.fileSystem.readFileAsBase64(filePath);
  return result.data;
}
//sendBtn.addEventListener('click', getAllStore);

function getFileNameWithoutExtension (fullFileName) {
  const lastDotIndex = fullFileName.lastIndexOf('.');

  if (lastDotIndex > 0) {
    return fullFileName.substring(0, lastDotIndex);
  }
  return fullFileName;
}

function createTitleInput (value) {
  let input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.className = 'file-title-input';
  return input;
}

function createFileViewer () {
  let fileViewer = document.createElement('div');
  fileViewer.className = 'file-viewer';
  return fileViewer;
}

async function readFile(state) {
  const result = await window.fileSystem.readFile(state.currentFilePath);
  
  if (result && result.success) {
    const content = result.content;
    
    if (isTextFile(state.currentFileExtension)) {
      const pre = document.createElement('pre');
      pre.textContent = content;
      pre.className = 'file-content-text';
      pre.contentEditable = 'true';
      pre.style.outline = 'none';
      pre.style.backgroundColor = '#FFFFFF';
      
      return pre;
      
    } else if (isImageFile(state.currentFileExtension)) {
      const img = document.createElement('img');
      const base64 = await readFileAsBase64(state.currentFilePath);
      img.src = base64;
      img.className = 'file-content-image';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '70vh';
      return img;
      
    } else {
      const info = document.createElement('p');
      info.textContent = `Тип файла: ${state.currentFileExtension.toUpperCase()}\nРазмер: ${result.size || 'неизвестно'} байт`;
      info.className = 'file-content-info';
      return info;
    }
    
  } else {
    throw new Error('Не удалось прочитать файл');
  }
}

async function saveFileChanges(state, newName, newContent = null, titleInput = null, contentElement = null) {
  let fileChanged = false;
  let oldPath = state.currentFilePath;
  let newPath = null;
  let newDisplayName = null;
  
  // 1. Обработка изменения имени файла
  if (newName && newName !== state.currentFileNameWithoutExtension) {
    const renameResult = await renameFileWithState(state, newName, titleInput);
    if (renameResult.success) {
      fileChanged = true;
      newPath = state.currentFilePath;
      newDisplayName = newName;
    } else {
      return { success: false, error: renameResult.error };
    }
  }
  
  // 2. Обработка изменения содержимого файла
  if (newContent !== null) {
    const saveResult = await window.fileSystem.saveFile(state.currentFilePath, newContent);
    if (saveResult.success) {
     createNotify('✅ Содержимое файла сохранено', 'success', 10000);
    } else {
      return { success: false, error: saveResult.error };
    }
  }
  
  // 3. Обновляем только изменённый узел в дереве
  if (fileChanged) {
    // Используем точечное обновление вместо полной перерисовки
    const updated = await updateTreeNode(oldPath, newPath, newDisplayName);
    console.log(oldPath, newPath, newDisplayName);
    
    if (!updated) {
      // Если точечное обновление не удалось, делаем полную перерисовку
      //await renderFileTree();
    }
  }
  
  return { success: true };
}

async function renameFileWithState(state, newNameWithoutExt, titleInput) {
  if (!newNameWithoutExt || newNameWithoutExt === state.currentFileNameWithoutExtension) {
    return { success: true };
  }
  
  // Получаем директорию из пути
  const lastBackslash = state.currentFilePath.lastIndexOf('\\');
  const lastSlash = state.currentFilePath.lastIndexOf('/');
  const lastSeparator = lastBackslash > lastSlash ? lastBackslash : lastSlash;
  
  let directory = state.currentFilePath.substring(0, lastSeparator);
  
  // Проверка: если directory пустой, используем сохранённую папку
  if (!directory || directory === state.currentFilePath) {
    directory = await getField('folder');
    if (!directory) {
      console.error('Ошибка: не удалось определить директорию');
      if (titleInput) titleInput.value = state.currentFileNameWithoutExtension;
      return { success: false, error: 'Не удалось определить директорию' };
    }
  }
  
  // Формируем новое полное имя файла
  const newFullName = state.currentFileExtension ? `${newNameWithoutExt}.${state.currentFileExtension}` : newNameWithoutExt;
  const newFilePath = `${directory}\\${newFullName}`;
  
  // Проверка: не пытаемся ли переименовать в тот же файл
  if (newFilePath === state.currentFilePath) {
    return { success: true };
  }
  
  try {
    // Переименовываем файл
    const renameResult = await window.fileSystem.renameFile(state.currentFilePath, newFilePath);
    
    if (renameResult.success) {
      createNotify(`✅ Файл переименован: ${state.currentFullFileName} -> ${newFullName}`, 'success', 10000);
      
      // Обновляем состояние
      state.currentFilePath = newFilePath;
      state.currentFullFileName = newFullName;
      state.currentFileNameWithoutExtension = newNameWithoutExt;
      
      if (titleInput) titleInput.value = newNameWithoutExt;
      
      return { success: true };
    } else {
      console.error(`❌ Ошибка переименования: ${renameResult.error}`);
      if (titleInput) titleInput.value = state.currentFileNameWithoutExtension;
      return { success: false, error: renameResult.error };
    }
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    if (titleInput) titleInput.value = state.currentFileNameWithoutExtension;
    return { success: false, error: error.message };
  }
}

async function updateTreeNode(oldPath, newPath = null, newName = null) {
  const sideBar = document.querySelector('.side-bar');
  
  const targetPath = newPath || oldPath;
  const targetName = newName || getDisplayName({ 
    name: targetPath.split('\\').pop().split('/').pop(), 
    type: 'file' 
  });
  
  let targetSpan = findNodeByPath(sideBar, oldPath);
  
  if (targetSpan) {
    console.log('✅ Найден узел для обновления:', targetSpan);
    
    const isDirectory = targetSpan.classList.contains('directory-item');
    
    // Обновляем имя и иконку
    targetSpan.textContent = targetName;
    if (isDirectory) {
      targetSpan.innerHTML = '<span class="folder-icon">📁</span> ' + targetName;
    } else {
      targetSpan.innerHTML = '📄 ' + targetName;
    }
    
    // Обновляем путь в data-атрибутах
    targetSpan.dataset.path = targetPath;
    const li = targetSpan.closest('li');
    if (li) {
      li.dataset.path = targetPath;
    }
    
    // ✅ Обновляем состояние открытых папок
    if (isDirectory && oldPath !== newPath) {
      if (openFolders.has(oldPath)) {
        openFolders.delete(oldPath);
        openFolders.add(targetPath);
      }
    }
    
    // Обновляем обработчик для файлов
    if (!isDirectory) {
      const clickHandler = targetSpan._clickHandler;
      if (clickHandler) {
        const newHandler = async () => {
          console.log('Выбран файл:', targetPath);
          await openFileInMainPlace(targetPath);
        };
        targetSpan.removeEventListener('click', clickHandler);
        targetSpan._clickHandler = newHandler;
        targetSpan.addEventListener('click', newHandler);
      }
    }
    
    console.log(`✅ Узел обновлён: ${oldPath} -> ${targetPath}`);
    return true;
  } else {
    console.warn('Узел не найден, выполняется полная перерисовка');
    await renderFileTree();
    return false;
  }
}

function findNodeByPath(element, targetPath) {
  // Ищем по data-path на span
  const spans = element.querySelectorAll('span.file-item, span.directory-item');
  console.log('🔍 Ищем путь:', targetPath);
  console.log('📋 Найдено span элементов:', spans.length);
  
  for (const span of spans) {
    const spanPath = span.dataset.path;
    console.log(`  - Проверяем span: ${span.textContent}, путь: ${spanPath}`);
    
    if (spanPath === targetPath) {
      console.log('✅ Найден span по data-path');
      return span;
    }
  }
  
  // Если не нашли через span, ищем через li
  const items = element.querySelectorAll('li.tree-node');
  for (const li of items) {
    const liPath = li.dataset.path;
    console.log(`  - Проверяем li: ${liPath}`);
    
    if (liPath === targetPath) {
      const span = li.querySelector('span.file-item, span.directory-item');
      if (span) {
        console.log('✅ Найден span через li');
        return span;
      }
    }
  }
  
  console.log('❌ Узел не найден');
  return null;
}



// Для всего документа (пустое место в sidebar)
document.querySelector('.side-bar').addEventListener('contextmenu', (event) => {
  event.preventDefault();
  
  // Находим ближайший элемент дерева
  const treeNode = event.target.closest('.tree-node');
  
  // Если клик на элементе дерева, передаём его в функцию
  if (treeNode) {
    // Находим span внутри узла
    const span = treeNode.querySelector('.file-item, .directory-item');
    createContextMenu(event.clientX, event.clientY, span);
    console.log(span);
  } else {
    // Клик на пустом месте сайдбара
    createContextMenu(event.clientX, event.clientY, null);
  }
});

document.addEventListener('refreshFileTree', async () => {
  console.log('🔄 Получен сигнал на обновление дерева');
  await renderFileTree();
});


