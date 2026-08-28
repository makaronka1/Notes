function addToOpenFiles (openFilesContainer, targetElement) {
  const dataPath = targetElement.getAttribute('data-path');
  const openFilesElement = document.createElement('div');
  openFilesElement.className = 'open-files-element';
  openFilesElement.setAttribute('data-path', dataPath);

  const openFilesSpan = document.createElement('span');
  openFilesSpan.textContent = targetElement.textContent.slice(3);
  openFilesElement.appendChild(openFilesSpan);

  const closeIcon = document.createElement('span');
  closeIcon.className = 'close-icon'
  closeIcon.addEventListener('click', (e) => removeFromOpenFiles(e));
  openFilesElement.appendChild(closeIcon);

  openFilesContainer.appendChild(openFilesElement);
}

function removeFromOpenFiles (e) {
  e.stopPropagation();
  const openFilesElement = e.target.closest('.open-files-element');
  const container = e.target.closest('.open-files-container')
  container.removeChild(openFilesElement);;
}