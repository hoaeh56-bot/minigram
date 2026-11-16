const http = require('http');
const WebSocket = require('ws');

const port = process.env.PORT || 3000;

// Создаем HTTP сервер
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MiniGram Server is running\n');
});

// Создаем WebSocket сервер поверх HTTP
const wss = new WebSocket.Server({ server });
