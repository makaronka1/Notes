function createNotifyContainer (targetContainerSelector = 'body') {
  const targetContainer = document.querySelector(targetContainerSelector);

  const notifyContainer = document.createElement('div');
  notifyContainer.className = `notify-container`;
  console.log(targetContainer);
  targetContainer.appendChild(notifyContainer);
}

function createNotify(string, type = false, delay = 5000) {
  const notify = document.createElement('div');
  notify.className = `notify-item ${type ? type : ''}`;
  notify.textContent = string;
  
  const notifyContainer = document.querySelector('.notify-container');

  if (!notifyContainer) {
    createNotifyContainer('.container');
    notifyContainer.appendChild(notify);
  } else {
    notifyContainer.appendChild(notify);
  }
  
  setTimeout(() => {
    if (notify.parentNode) { 
      notify.remove();
    }
  }, delay);
}

createNotifyContainer('.container');