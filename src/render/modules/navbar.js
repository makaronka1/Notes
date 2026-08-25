const addFileBtn = document.querySelector('#add-file-btn');
const addFolderBtn = document.querySelector('#add-folder-btn');
const refreshBtn = document.querySelector('#refresh-btn');

addFileBtn.addEventListener('click', () => createFile());
addFolderBtn.addEventListener('click', () => createLocalDirectory());
