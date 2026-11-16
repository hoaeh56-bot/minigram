const http = require('http');
const WebSocket = require('ws');

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('ok');
});

const wss = new WebSocket.Server({ server });

server.listen(port, '0.0.0.0', () => {
  console.log('Server running on port ' + port);
});
