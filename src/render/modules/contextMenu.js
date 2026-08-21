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
    let currentName = targetElement.textContent;

    const folderIcon = targetElement.querySelector('.folder-icon');
    if (folderIcon) {
      currentName = currentName.slice(3);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'input-rename';

    if (targetElement._clickHandler) {
      targetElement.removeEventListener('click', targetElement._clickHandler);
      targetElement._clickHandler = null;
    }

    targetElement.innerHTML = '';
    targetElement.appendChild(input);
    input.focus();

    const oldDirPath = targetElement.getAttribute('data-path');
    const newDirPath = oldDirPath.slice(0, oldDirPath.lastIndexOf('\\') + 1);
    
    const renameEvent = async () => {
      if (input.value == '') {
        createNotify(`❌ Ошибка переименования: название не может быть пустой строкой`, 'danger', 5000);
        triggerTreeRefresh();
        return;
      }
      const newFolderName = newDirPath + input.value;
      const renameResult = await window.fileSystem.renameObject(oldDirPath, newFolderName);

      if (renameResult.success) {
        createNotify(`✅ Папка переименована`, 'success', 10000);
        if (openFolders.has(oldDirPath)) {
          openFolders.delete(oldDirPath);
          openFolders.add(newFolderName);
        }

        triggerTreeRefresh();
        return { success: true };
      } else {
        createNotify(`❌ Ошибка переименования: ${renameResult.error}`, 'danger', 10000);
        triggerTreeRefresh();
        
        return { success: false, error: renameResult.error };
      }
    }

    input.addEventListener('blur',  renameEvent);
  } else {
    let currentName = targetElement.textContent.slice(3);
    console.log(currentName);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'input-rename';

    if (targetElement._clickHandler) {
      targetElement.removeEventListener('click', targetElement._clickHandler);
      targetElement._clickHandler = null;
    }

    targetElement.innerHTML = '';
    targetElement.appendChild(input);
    input.focus();

    const oldFilePath = targetElement.getAttribute('data-path');
    const newFilePath = oldFilePath.slice(0, oldFilePath.lastIndexOf('\\') + 1);
    const fileExtension = '.' + oldFilePath.split('.').pop().toLowerCase();

    const renameEvent = async () => {
      if (input.value == '') {
        createNotify(`❌ Ошибка переименования: название не может быть пустой строкой`, 'danger', 5000);
        triggerTreeRefresh();
        return;
      }
      const newFileName = newFilePath + input.value + fileExtension;
      const renameResult = await window.fileSystem.renameObject(oldFilePath, newFileName);

      if (renameResult.success) {
        const fileViewerPath = document.querySelector('.file-viewer').getAttribute('data-path');

        if (fileViewerPath == oldFilePath) {
          await openFileInMainPlace(newFileName);
        }
        createNotify(`✅ Файл переименован`, 'success', 10000);
        triggerTreeRefresh();
        return { success: true };
      } else {
        createNotify(`❌ Ошибка переименования: ${renameResult.error}`, 'danger', 10000);
        triggerTreeRefresh();
        return { success: false, error: renameResult.error };
      }
    }

    input.addEventListener('blur',  renameEvent);
  }
}

function triggerTreeRefresh() {
  const event = new CustomEvent('refreshFileTree');
  document.dispatchEvent(event);
}