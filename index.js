const http = require('http');
const port = parseInt(process.env.PORT || '8000', 10);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
});
server.listen(port, '0.0.0.0', () => {
  console.log('Listening on port ' + port);
});