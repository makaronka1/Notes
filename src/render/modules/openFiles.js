function addToOpenFiles (openFilesContainer, targetElement, className = null) {
  const dataPath = targetElement.getAttribute('data-path');
  console.log(openFiles);
  if (openFiles.has(dataPath)) {
    focusOnOpenElement(openFilesContainer, dataPath);
    return;
  }
  
  const openFilesElement = createOpenFilesElement(targetElement, dataPath, className);

  const lastElement = openFilesContainer.children[openFilesContainer.children.length - 1];

  if (lastElement && lastElement.classList.contains('temporary')) {
    lastElement.remove();
    const previousDataPath = lastElement.getAttribute('data-path');
    openFiles.delete(previousDataPath);
  }

  openFiles.add(dataPath);
  openFilesContainer.appendChild(openFilesElement);
  focusOnOpenElement(openFilesContainer, dataPath);
}

function removeFromOpenFiles (e) {
  e.stopPropagation();
  const openFilesElement = e.target.closest('.open-files-element');
  const container = e.target.closest('.open-files-container')
  container.removeChild(openFilesElement);
  const dataPath = openFilesElement.getAttribute('data-path');
  openFiles.delete(dataPath);
}

function focusOnOpenElement (container, dataPath) {
  const openFilesElement = container.querySelector(`[data-path="${CSS.escape(dataPath)}"]`);
  openFilesElement.focus();
  openFilesElement.scrollIntoView({
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

  return openFilesElement;
}