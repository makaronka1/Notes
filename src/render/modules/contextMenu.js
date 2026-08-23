function createContextMenu(x, y, targetElement) {
  // Удаляем существующее меню, если есть
  const existingMenu = document.querySelector('.context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Определяем тип элемента
  const isDirectory = targetElement?.closest('.tree-node')?.dataset?.type === 'directory';
  const isFile = targetElement?.closest('.tree-node')?.dataset?.type === 'file';
  
  // Создаём меню
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  // Пункты меню в зависимости от типа
  let items = [];
  
  if (isFile) {
    items = [
      { label: '📄 Открыть', action: () => {
        const filePath = targetElement.getAttribute('data-path');
        openFileInMainPlace(filePath)
      } },
      { label: '✏️ Переименовать', action: () => renameFromContextMenu(targetElement) },
      { label: '🗑️ Удалить', action: () => {
        deleteElement(targetElement);
      } }
    ];
  } else if (isDirectory) {
    items = [
      { label: '📂 Создать папку', action: () => {
        createLocalDirectory(targetElement);
      } },
      { label: '📄 Создать файл', action: () => createFile(targetElement) },
      { label: '✏️ Переименовать', action: () => renameFromContextMenu(targetElement) },
      { label: '🗑️ Удалить', action: () => deleteElement(targetElement) }
    ];
  } else {
    items = [
      { label: '📄 Создать файл', action: () => createFile() },
      { label: '📁 Создать папку', action: () => createLocalDirectory() }
    ];
  }
  
  items.forEach((item) => {
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item';
    menuItem.textContent = item.label;
    
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      item.action();
    });
    
    menu.appendChild(menuItem);
  });
  
  document.body.appendChild(menu);
  
  // Закрываем меню при клике вне его
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 10);
}

async function deleteElement (targetElement) {
  let path = targetElement.getAttribute('data-path');
  const fileViewer = document.querySelector('.file-viewer');
  let fileViewerPath;
  if (fileViewer) {
    fileViewerPath = fileViewer.getAttribute('data-path');
  }

  console.log(path);
  const deleteResult =  await window.fileSystem.deleteElement(path);

  if (fileViewerPath && fileViewerPath == path) {
    fileViewer.remove();
  }

  if(deleteResult.success) {
    createNotify(`✅ Элемент Удалён`, 'success', 10000);
    triggerTreeRefresh();
  } else {
    createNotify(`Ошибка удаления: ${deleteResult.error}`, 'danger', 10000);
  }
}

// Функция создания локальной папки (через IPC)
async function createLocalDirectory(targetElement = false) {
  if (targetElement) {
    let path = targetElement.getAttribute('data-path') + '\/Новая папка';
    console.log(path);
    try {
      const result = await window.electronAPI.createDirectory(path);
      console.log(result);
      triggerTreeRefresh();
      return result.success;
    } catch (error) {
      console.error('Ошибка создания папки:', error);
      return false;
    }
  } else {
    const mainFolderPath = await getField('folder');
    try {
      const result = await window.electronAPI.createDirectory(mainFolderPath + '\/Новая папка');
      triggerTreeRefresh();
      return result.success;
    } catch (error) {
      console.error('Ошибка создания папки:', error);
      return false;
    }
  }
  
}

async function createFile(targetElement = false, fileExtension = '.md') {
  if (targetElement) {
    let path = targetElement.getAttribute('data-path') + '\/Новый файл';
    try {
      const result = await window.electronAPI.createFile(path, fileExtension);
      triggerTreeRefresh();
      return result.success;
    } catch (error) {
      createNotify(`Ошибка создания файла: ${error}`, 'danger', 10000);
      return false;
    }
  } else {
    const mainFolderPath = await getField('folder');
    try {
      const result = await window.electronAPI.createFile(mainFolderPath + '\/Новый файл', fileExtension);
      triggerTreeRefresh();
      return result.success;
    } catch (error) {
      createNotify(`Ошибка создания файла: ${error}`, 'danger', 10000);
      return false;
    }
  }
    
}

async function renameFromContextMenu (targetElement) {
  const isDirectory = targetElement.classList[0] == 'directory-item' ? true : false;

  if (isDirectory) {
    let currentName = targetElement.textContent.slice(3);

    const input = createInputForRename(currentName);

    if (targetElement._clickHandler) {
      targetElement.removeEventListener('click', targetElement._clickHandler);
      targetElement._clickHandler = null;
    }

    targetElement.innerHTML = '';
    targetElement.appendChild(input);
    input.focus();

    const oldDirPath = targetElement.getAttribute('data-path');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('blur',  () => {
      renameEvent(input, oldDirPath);
    });
  } else {
    let currentName = targetElement.textContent.slice(3);    
    const input = createInputForRename(currentName);

    if (targetElement._clickHandler) {
      targetElement.removeEventListener('click', targetElement._clickHandler);
      targetElement._clickHandler = null;
    }

    targetElement.innerHTML = '';
    targetElement.appendChild(input);
    input.focus();

    const oldFilePath = targetElement.getAttribute('data-path');
    const fileExtension = '.' + oldFilePath.split('.').pop().toLowerCase();


    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('blur',  () => {
      renameEvent(input, oldFilePath, fileExtension);
    });
  }
}

function createInputForRename (content = false) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-rename';
  if (content) {
    input.value = content;
  }

  return input;
}

async function renameEvent(input, oldPath, extension = false) {
  if (input.value == '') {
    createNotify(`❌ Ошибка переименования: название не может быть пустой строкой`, 'danger', 5000);
    triggerTreeRefresh();
    return;
  }

  const newPath = oldPath.slice(0, oldPath.lastIndexOf('\\') + 1);
  let newObjectName;

  if (extension) {
    newObjectName = newPath + input.value + extension;
  } else {
    newObjectName = newPath + input.value;
  }

  const renameResult = await window.fileSystem.renameObject(oldPath, newObjectName);


  if (renameResult.success) {
    const fileViewer = document.querySelector('.file-viewer');
    let fileViewerPath = null;

    if (fileViewer) {
      fileViewerPath = fileViewer.getAttribute('data-path')
    }

    if (extension) {
      if (fileViewerPath && fileViewerPath == oldPath) {
        await openFileInMainPlace(newObjectName);
      }

      createNotify(`✅ Файл переименован`, 'success', 10000);
      triggerTreeRefresh();
      return { success: true };
    }

    createNotify(`✅ Папка переименована`, 'success', 10000);
    if (openFolders.has(oldPath)) {
      openFolders.delete(oldPath);
      openFolders.add(newObjectName);
    }

    if (fileViewerPath) {
      if (fileViewerPath.includes(oldPath)) {
        let newFileViewerPath = fileViewerPath.replace(oldPath, newObjectName);
        await openFileInMainPlace(newFileViewerPath);
      }
    }

    triggerTreeRefresh();
    return { success: true };
    
  } else {
    createNotify(`❌ Ошибка переименования: ${renameResult.error}`, 'danger', 10000);
    triggerTreeRefresh();
    return { success: false, error: renameResult.error };
  }
}

function triggerTreeRefresh() {
  const event = new CustomEvent('refreshFileTree');
  document.dispatchEvent(event);
}