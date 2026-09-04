function addToOpenFiles (openFilesContainer, targetElement, className = null) {
  const dataPath = targetElement.getAttribute('data-path');
  console.log(openFiles);
  if (openFiles.has(dataPath)) {
    const openFilesElement = openFilesContainer.querySelector(`[data-path="${CSS.escape(dataPath)}"]`);
    focusOnOpenElement(openFilesElement);
    highlightOpenFilesElement(openFilesContainer, openFilesElement);
    return;
  }
  
  const newOpenFilesElement = createOpenFilesElement(targetElement, dataPath, className);

  const lastElement = openFilesContainer.children[openFilesContainer.children.length - 1];

  if (lastElement && lastElement.classList.contains('temporary')) {
    lastElement.remove();
    const previousDataPath = lastElement.getAttribute('data-path');
    openFiles.delete(previousDataPath);
  }

  openFiles.add(dataPath);
  openFilesContainer.appendChild(newOpenFilesElement);
  
  highlightOpenFilesElement(openFilesContainer, newOpenFilesElement);
  focusOnOpenElement(newOpenFilesElement);
}

function removeFromOpenFiles (e) {
  e.stopPropagation();
  const openFilesElement = e.target.closest('.open-files-element');
  const container = e.target.closest('.open-files-container')
  container.removeChild(openFilesElement);
  const dataPath = openFilesElement.getAttribute('data-path');
  openFiles.delete(dataPath);
}

function focusOnOpenElement (element) {
  element.focus();
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function createOpenFilesElement (targetElement, dataPath, className = null) {
  const openFilesElement = document.createElement('div');
  openFilesElement.classList.add('open-files-element');
  if (className) {
    openFilesElement.classList.add(className);
  }
  openFilesElement.setAttribute('data-path', dataPath);
  openFilesElement.tabIndex = '0';

  const openFilesSpan = document.createElement('span');
  openFilesSpan.textContent = targetElement.textContent.slice(3);
  openFilesElement.appendChild(openFilesSpan);

  const closeIcon = document.createElement('span');
  closeIcon.className = 'close-icon'
  closeIcon.addEventListener('click', (e) => removeFromOpenFiles(e));
  openFilesElement.appendChild(closeIcon);

  openFilesElement.addEventListener('click', async (e) => {
    highlightOpenFilesElement(openFilesContainer, openFilesElement);

    const path = e.target.closest('.open-files-element').getAttribute('data-path'); 
    await openFileInMainPlace(path);
  })

  return openFilesElement;
}

function highlightOpenFilesElement (openFilesContainer, element) {
  const otherActiveElement = openFilesContainer.querySelector('.active');

  if (otherActiveElement) {
    otherActiveElement.classList.remove('active');
  }

  element.classList.add('active');
}