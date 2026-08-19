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
      { label: '📄 Открыть', action: () => console.log('Открыть файл') },
      { label: '✏️ Переименовать', action: () => console.log('Переименовать файл') },
      { label: '🗑️ Удалить', action: () => {
        deleteElement(targetElement);
      } }
    ];
  } else if (isDirectory) {
    items = [
      { label: '📂 Создать папку', action: () => {
        createLocalDirectory(targetElement);
      } },
      { label: '📄 Создать файл', action: () => console.log('Создать файл в папке') },
      { label: '✏️ Переименовать', action: () => console.log('Переименовать папку') },
      { label: '🗑️ Удалить', action: () => deleteElement(targetElement) }
    ];
  } else {
    items = [
      { label: '📄 Создать файл', action: () => console.log('Создать файл') },
      { label: '📁 Создать папку', action: () => console.log('Создать папку') }
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
async function createLocalDirectory(targetElement) {
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
}

function triggerTreeRefresh() {
  const event = new CustomEvent('refreshFileTree');
  document.dispatchEvent(event);
}