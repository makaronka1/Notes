async function setField(key, value) {
  await window.electronStore.set(key, value);
  console.log('Field set');
}

async function getField(key) {
  let value = await window.electronStore.get(key);
  console.log(value);
  return value;
}

async function getAllStore() {
  let allData = await window.electronStore.getAll();
  console.log(allData);
}

async function clearStoreParam(key) {
  await window.electronStore.delete(key);
}