document.addEventListener('DOMContentLoaded', () => {
    const ws = new WebSocket('ws://localhost:4000');
    const searchBtn = document.querySelector('#searchBtn');
    const keywordInput = document.querySelector('#keywordInput');
    const filesTag = document.querySelector('.filesList');
    const localsDiv = document.querySelector('.localList');

    var fileTags = {};
    var files = [];
  
    function saveDataToStorage(key, data, part) {
      if (typeof Storage !== 'undefined') {
        let existingData = localStorage.getItem(key) || '';
  
        if (part !== 1) {
          data = existingData + data;
        }
  
        localStorage.setItem(key, data);
        console.log(`Data saved in local storage! Key: ${key}`);
      } else {
        console.error('Error saving data in local storage');
      }
    }
  
    function addLocalTag(file) {
      const baseDiv = document.createElement('div');
      const nameDiv = document.createElement('h4');
      const loadBtn = document.createElement('button');
  
      baseDiv.classList.add('localFile');
      nameDiv.textContent = file;
      loadBtn.textContent = 'Download';
  
      loadBtn.addEventListener('click', () => {
        const blob = dataURItoBlob(localStorage.getItem(file));
  
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      });
  
      baseDiv.appendChild(nameDiv);
      baseDiv.appendChild(loadBtn);

      localsDiv.appendChild(baseDiv);
    }
  
    function dataURItoBlob(dataURI) {
      const byteString = atob(dataURI.split(',')[1]);
      const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
  
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
  
      return new Blob([ab], { type: mimeString });
    }
  
    function saveFileList() {
      localStorage.setItem('files', JSON.stringify(files));
    }
  
    ws.onopen = () => {
      console.log('Connection opened');
  
      searchBtn.addEventListener('click', () => {
        const keyword = keywordInput.value;
  
        ws.send(JSON.stringify({
          type: 'req_keyword',
          keyword: keyword
        }));
      });
    };
  
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
  
      if (message.type === 'resp_keyword') {
        fileTags = {};
        filesTag.innerHTML = '';
  
        for (let key in message.links) {
          const fileContainer = document.createElement('div');
          fileContainer.classList.add('fileContainer');
  
          const fileName = document.createElement('div');
          fileName.textContent = message.links[key];
  
          const downloadBtn = document.createElement('button');
          downloadBtn.textContent = 'Save';
  
          downloadBtn.addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'req_file', link: message.links[key] }));
          });
  
          fileContainer.appendChild(fileName);
          fileContainer.appendChild(downloadBtn);
  
          fileTags[message.links[key]] = fileContainer;
          filesTag.appendChild(fileContainer);
        }
      }
  
      if (message.type === 'resp_file') {
        let link = message.link;
        let progress = parseInt(message.part / message.count * 100);
        let data = message.data;
        let filename = message.filename;
  
        saveDataToStorage(filename, data, message.part);
        let btn = fileTags[link].querySelector('button')
  
        if (message.part == message.count) {  
          if (!files.includes(filename)) {
            addLocalTag(filename);
            files.push(filename);
            saveFileList();
          }
          btn.textContent = `Save`
        } else {
            btn.textContent = `Saving ${progress}%...`
        }
      }
    };
  
    ws.onclose = () => {
      console.log('Connection closed');
    };
  
    files = JSON.parse(localStorage.getItem('files') || '[]');
    for (let key in files) {
      let file = files[key];
      addLocalTag(file);
    }
  });
  