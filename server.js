const fs = require('fs');
const path = require('path');
const https = require('https');
const WebSocket = require('ws');
const mime = require('mime-types');
const http = require('http');
const cluster = require('cluster');

const numCPUs = 8;

const wss = new WebSocket.Server({ noServer: true });

const keywords = {
  files: [
    'https://image.winudf.com/v2/image/Y29tLmZydWl0d2FsbHBhcGVyLmhkLmZydWl0cGljdHVyZXMucGhvdG9zLmJhY2tncm91bmQuY3V0ZS5jb29sLmFydC5mcnVpdGltYWdlcy5oZC5mcmVlX3NjcmVlbl8wXzE1MzIwODEwMzdfMDY0/screen-0.jpg',
    'https://i.ytimg.com/vi/hdARNreLv2M/maxresdefault.jpg',
    'https://w.forfun.com/fetch/29/29d7347818d3b23d37fc5c8454eed830.jpeg'
  ]
};

function startServer() {
  const httpServer = http.createServer();

  httpServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  httpServer.listen(4000, () => {
    console.log('Server is running! Port: 4000');
  });

  wss.on('connection', handleConnection)
}

function handleConnection(ws) {
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.type === 'req_file') {
        handleFileSend(ws, parsedMessage.link);
      } else if (parsedMessage.type === 'req_keyword') {
        handleKeywordRequest(ws, parsedMessage.keyword);
      } else {
        console.log('Received unknown message type:', parsedMessage.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
}

function handleFileSend(ws, link) {
  const destinationPath = extractDestinationPath(link);

  downloadFile(link, destinationPath)
    .then(() => {
      console.log('File downloaded successfully!');

      fileToDataUri(destinationPath, (err, data) => {
        console.log('Sending file');
        console.log(data.length);

        if (err) {
          console.error('Error reading file:', err);
          return;
        }

        sendFileChunks(ws, link, destinationPath, data);
      });
    })
    .catch((error) => {
      console.error(error.message);
    });
}

function handleKeywordRequest(ws, keyword) {
  const links = keywords[keyword] || [];
  const responseMessage = {
    type: 'resp_keyword',
    links: links,
  };
  ws.send(JSON.stringify(responseMessage));
}

function sendFileChunks(ws, link, destinationPath, data) {
  const chunkSize = 4000;
  const totalChunks = Math.ceil(data.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = (i + 1) * chunkSize;
    const chunkData = data.substring(start, end);

    const message = {
      type: 'resp_file',
      link: link,
      filename: path.basename(destinationPath),
      part: i + 1,
      count: totalChunks,
      data: chunkData,
    };

    ws.send(JSON.stringify(message));
  }
}

function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destinationPath);

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file, status code: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close(resolve);
      });

      file.on('error', (err) => {
        fs.unlink(destinationPath, () => {
          reject(new Error(`Error writing to ${destinationPath}: ${err.message}`));
        });
      });
    });

    request.on('error', (err) => {
      fs.unlink(destinationPath, () => {
        reject(new Error(`Error downloading file from ${url}: ${err.message}`));
      });
    });

    request.end();
  });
}

function fileToDataUri(filePath, callback) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return callback(err);
    }

    const dataUri = `data:${getMimeType(filePath)};base64,${data.toString('base64')}`;
    callback(null, dataUri);
  });
}

function getMimeType(filePath) {
  const extension = path.extname(filePath);
  const mimeType = mime.lookup(extension);
  return mimeType;
}

function extractDestinationPath(link) {
  const parts = link.split('/');
  const filename = parts[parts.length - 1];
  const destinationPath = path.join('files', filename);
  return destinationPath;
}

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} 
else {
  startServer();
}
