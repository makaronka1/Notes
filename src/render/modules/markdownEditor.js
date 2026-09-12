(function setupQuillImageSanitize() {
  if (typeof Quill === 'undefined') {
    console.warn('⚠️ Quill не загружен, sanitize не переопределён');
    return;
  }
  
  const Image = Quill.import('formats/image');
  
  Image.sanitize = function(url) {
    // Разрешаем стандартные схемы + наш протокол
    const allowed = ['http:', 'https:', 'data:', 'note-file:', 'file:'];
    
    try {
      const parsed = new URL(url);
      if (allowed.includes(parsed.protocol)) return url;
    } catch (e) {
      // Относительные пути (images/..., ./images/..., ../images/...)
      if (url.startsWith('images/') || 
          url.startsWith('./images/') || 
          url.startsWith('../images/')) {
        return url;
      }
    }
    
    return '//:0';
  };
  
  console.log('✅ Quill Image.sanitize переопределён');
})();

let currentQuill = null;
let currentEditorState = {
  currentFilePath: null,
  currentFullFileName: null,
  currentFileNameWithoutExtension: null,
  saveTimeout: null,
  isDirty: false
};

const IMAGE_PATH_PREFIX = 'images/';
const IMAGE_PROTOCOL_PREFIX = 'note-file://local/images/';

function replaceImagePathsForDisplay(markdown) {
  return markdown.replace(
    /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
    `![$1](${IMAGE_PROTOCOL_PREFIX}$2)`
  );
}

function replaceImagePathsForStorage(html) {
  return html.replace(
    new RegExp(IMAGE_PROTOCOL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    IMAGE_PATH_PREFIX
  );
}

async function openMarkdownInQuill(filePath, fileNameWithoutExtension) {
  const mainPlace = document.querySelector('.main-place');
  
  const result = await window.fileSystem.readFile(filePath);
  if (!result.success) {
    createNotify(`❌ Ошибка чтения: ${result.error}`, 'danger');
    return;
  }
  
  const markdownText = result.content;
  
  mainPlace.innerHTML = '';
  
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'quill-editor-wrapper';
  
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'file-title-input';
  titleInput.value = fileNameWithoutExtension;
  editorWrapper.appendChild(titleInput);
  
  const editorContainer = document.createElement('div');
  editorContainer.id = 'quill-editor';
  editorWrapper.appendChild(editorContainer);
  
  mainPlace.appendChild(editorWrapper);
  
  currentQuill = new Quill('#quill-editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ header: ['1', '2', '3', false] }],
        ['bold', 'italic', 'underline', 'link'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: '' }, { align: 'center' }, { align: 'right' }, { align: 'justify' }],
        ['image', 'blockquote', 'code-block'],
        ['clean']
      ]
    },
    placeholder: 'Начните писать...'
  });
  

  const markdownForDisplay = replaceImagePathsForDisplay(markdownText);
  const html = window.markdown.mdToHtml(markdownForDisplay);
  const delta = currentQuill.clipboard.convert({ html: html });
  currentQuill.setContents(delta, 'silent');
  

  currentEditorState.currentFilePath = filePath;
  currentEditorState.currentFullFileName = window.path.basename(filePath);
  currentEditorState.currentFileNameWithoutExtension = fileNameWithoutExtension;
  currentEditorState.isDirty = false;
  

  titleInput.addEventListener('input', (e) => {
    if (currentEditorState.saveTimeout) {
      clearTimeout(currentEditorState.saveTimeout);
    }
    
    const newValue = e.target.value.trim().toLowerCase();
    
    currentEditorState.saveTimeout = setTimeout(async () => {
      await saveFileChanges(
        {
          currentFilePath: currentEditorState.currentFilePath,
          currentFullFileName: currentEditorState.currentFullFileName,
          currentFileExtension: 'md',
          currentFileNameWithoutExtension: currentEditorState.currentFileNameWithoutExtension,
          saveTimeout: null
        },
        newValue,
        null,
        titleInput
      );
      
      currentEditorState.currentFileNameWithoutExtension = newValue;
      currentEditorState.saveTimeout = null;
    }, 1000);
  });
  

  currentQuill.on('text-change', (delta, oldDelta, source) => {
    if (source === 'user') {
      currentEditorState.isDirty = true;
      
      if (currentEditorState.saveTimeout) {
        clearTimeout(currentEditorState.saveTimeout);
      }
      
      currentEditorState.saveTimeout = setTimeout(async () => {
        await saveQuillContent();
        currentEditorState.saveTimeout = null;
      }, 1000);
    }
  });
  

  currentQuill.root.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      await saveQuillContent();
    }
  });
  

  setupImagePaste(currentQuill);
  

  currentQuill.focus();
  
  console.log('✅ Файл открыт в Quill:', filePath);
}

async function saveQuillContent() {
  if (!currentQuill || !currentEditorState.currentFilePath) return;
  
  try {
    // 1. Получаем HTML из Quill
    const html = currentQuill.root.innerHTML;
    
    // 2. Заменяем note-file:// пути на относительные
    const htmlForStorage = replaceImagePathsForStorage(html);
    
    // 3. Конвертируем HTML → Markdown
    const markdown = window.markdown.htmlToMd(htmlForStorage);
    
    // 4. Сохраняем в файл
    const result = await window.fileSystem.saveFile(
      currentEditorState.currentFilePath,
      markdown
    );
    
    if (result.success) {
      currentEditorState.isDirty = false;
      createNotify('✅ Файл сохранён', 'success', 3000);
    } else {
      createNotify(`❌ Ошибка сохранения: ${result.error}`, 'danger');
    }
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    createNotify(`❌ Ошибка: ${error.message}`, 'danger');
  }
}

function setupImagePaste(quill) {
  // ✅ Вставка из буфера (Ctrl+V)
  quill.root.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        
        const file = item.getAsFile();
        if (file) {
          await insertImageToQuill(quill, file);
        }
        return;
      }
    }
  }, true); // capture: true — перехватываем до Quill
  
  // ✅ Drag-and-drop
  quill.root.addEventListener('drop', async (e) => {
    const files = e.dataTransfer?.files;
    if (!files) return;
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        await insertImageToQuill(quill, file);
        return;
      }
    }
  }, true);
  
  // ✅ Кнопка "Изображение" на тулбаре
  const toolbar = quill.getModule('toolbar');
  toolbar.addHandler('image', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        await insertImageToQuill(quill, file);
      }
    };
    input.click();
  });
}

async function insertImageToQuill(quill, file) {
  try {
    createNotify('📤 Сохраняем изображение...', 'info', 2000);
    
    // 1. Читаем файл как ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 2. Отправляем в main-процесс
    const result = await window.fileSystem.saveImage(
      arrayBuffer,
      file.name
    );
    
    if (!result.success) {
      createNotify(`❌ Ошибка: ${result.error}`, 'danger');
      return;
    }
    
    // 3. Формируем путь для отображения
    const displayPath = `${IMAGE_PROTOCOL_PREFIX}${result.fileName}`;
    
    // 4. Вставляем в Quill
    const range = quill.getSelection(true);
    quill.insertEmbed(range.index, 'image', displayPath, 'user');
    quill.setSelection(range.index + 1);
    
    createNotify('✅ Изображение вставлено', 'success', 3000);
    console.log('✅ Изображение вставлено:', result.relativePath);
    
  } catch (error) {
    console.error('❌ Ошибка вставки изображения:', error);
    createNotify(`❌ Ошибка: ${error.message}`, 'danger');
  }
}

// ============================================================
// Закрытие редактора
// ============================================================
function closeCurrentEditor() {
  // Сохраняем несохранённые изменения
  if (currentEditorState.isDirty) {
    saveQuillContent();
  }
  
  if (currentEditorState.saveTimeout) {
    clearTimeout(currentEditorState.saveTimeout);
  }
  
  currentQuill = null;
  currentEditorState = {
    currentFilePath: null,
    currentFullFileName: null,
    currentFileNameWithoutExtension: null,
    saveTimeout: null,
    isDirty: false
  };
}

// ============================================================
// Проверка, открыт ли редактор
// ============================================================
function isEditorOpen() {
  return currentQuill !== null;
}