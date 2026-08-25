const settingsContainer = document.querySelector('.settings-container');
const APITokenValueElement = settingsContainer.querySelector('#APITokenValue');
const folderValueELement = settingsContainer.querySelector('#FolderValue');
const settingsBtn = document.querySelector('#settings-btn');
const closeBtn = document.querySelector('#closeBtn');
const body = document.querySelector('#body');
const pathChangeBtn = settingsContainer.querySelector('#pathChangeBtn');


async function fillSettingsValueFromStore (valueElement, key) {
  const storeValue = await window.electronStore.get(key);
  console.log(storeValue);
  if (storeValue) {
    if (key == "token") {
      valueElement.value = storeValue;
    } else {
      valueElement.textContent = storeValue;
    }
  }
}

function toggleVisibilityElement (element) {
  element.classList.toggle('hidden');
}

function toggleOverflowXElement (element) {
  element.classList.toggle('overflow-hidden');
}

settingsBtn.addEventListener('click', () => 
  {
    toggleVisibilityElement(settingsContainer);
    toggleOverflowXElement(body);
  } 
);
closeBtn.addEventListener('click', () => 
  {
    toggleVisibilityElement(settingsContainer);
    toggleOverflowXElement(body);
  } 
);

fillSettingsValueFromStore(APITokenValueElement, 'token');
fillSettingsValueFromStore(folderValueELement, 'folder');

APITokenValueElement.addEventListener('blur', async () => {
  const inputValue = APITokenValueElement.value;
  console.log(inputValue);
  if (inputValue != '') {
    const result = await window.electronStore.set('token', inputValue);
    if (result) {
      createNotify('Токен изменен', 'success', 10000);
    } else {
      createNotify('Ошибка изменения токена', 'danger', 10000);
    }
  } else {
    createNotify('Токен не может быть пустой строкой', 'danger', 10000);
    fillSettingsValueFromStore(APITokenValueElement, 'token');
  }
});

pathChangeBtn.addEventListener('click', async () => {
  let result = await handleSelectFolder();

  if (result) {
    createNotify('Корневая папка изменена', 'success', 10000);
    fillSettingsValueFromStore(folderValueELement, 'folder');
    await renderFileTree();
  } else {
    createNotify('Изменение корневой папки отменено', 'danger', 10000);
  }
})
