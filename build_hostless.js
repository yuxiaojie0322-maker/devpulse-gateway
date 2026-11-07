const fs = require('fs');
const vm = require('vm');
const path = require('path');
const zlib = require('zlib');
const JavaScriptObfuscator = require('D:/Antigravity IDE/03_网络与隧道部署/python-packer-worker/node_modules/javascript-obfuscator');

const html = fs.readFileSync('D:/Antigravity IDE/03_网络与隧道部署/python-packer-worker/unified_dashboard.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const mainScript = scripts[scripts.length - 1];

const mockElements = {
  cfgUuid: { value: '351c9981-1628-4159-81e8-9582370153a1' },
  cfgName: { value: 'Hostless-Cloud' },
  cfgPort: { value: '8000' },
  enableArgo: { checked: true },
  protoVmess: { checked: true },
  protoVless: { checked: true },
  protoTrojan: { checked: true },
  cfgArgoPort: { value: '8001' },
  cfgArgoDomain: { value: 'hostless44.yxj02.ccwu.cc' },
  cfgArgoAuth: { value: 'eyJhIjoiYWNiNzhlNWQyODA1ZWE1MmFiYjdhZWYwNTU1NTY4YTYiLCJ0IjoiZmNlMzM2ZDAtOWFhZC00MzMwLWJiNGItNzVmOWZmNWQwODk3IiwicyI6Ikc5eU5ETFR0Z0pxdU1tNFZIeU1PNlE1dmJxaFJCRVNlbkpZYklvcU04SzQ9In0=' },
  enableReality: { checked: false },
  protoRealityVless: { checked: false },
  protoHysteria2: { checked: false },
  protoTuic: { checked: false },
  cfgVlessPort: { value: '8443' },
  cfgHy2Port: { value: '8444' },
  cfgTuicPort: { value: '8445' },
  cfgRealitySni: { value: 'www.microsoft.com' },
  cfgNzServer: { value: 'nezha.blibli.kdns.fr:443' },
  cfgNzKey: { value: '4Lw803GSbgNYiCQd2z7VlbQc8UjmUrgO' },
  cfgNzUuid: { value: 'f4e812c0-9aad-4330-bb4b-75f9ff5d0897' },
  cfgTgToken: { value: '' },
  cfgTgChatId: { value: '' },
  cfgStealthProfile: { value: 'sakura' },
  optLowMem: { checked: true },
  optWatchdog: { checked: true },
  optCleanConsole: { checked: true },
  optFakeWeb: { checked: true }
};

const sandbox = {
  window: {
    location: { origin: 'https://node-python.yxj02.ccwu.cc' },
    __REALITY_KEYS__: { privKey: 'priv_test', pubKey: 'pub_test', shortId: '1a2b3c4d' }
  },
  document: {
    getElementById: (id) => mockElements[id] || { value: '', checked: false, style: {}, classList: { add(){}, remove(){} }, addEventListener(){} },
    getElementsByName: () => [{ checked: true, value: 'light' }],
    querySelector: () => ({ value: '', style: {} }),
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, click(){} }),
    body: { appendChild(){}, removeChild(){} }
  },
  navigator: {},
  console,
  setTimeout: () => {},
  setInterval: () => {},
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  Uint8Array,
  TextDecoder,
  unescape: (s) => s,
  encodeURIComponent,
  JavaScriptObfuscator
};
vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

let rawNode = sandbox.generateNodeSource();
// Ensure CACHE_DIR works on Read-Only Root Filesystem (EROFS) platforms like Hostless (/app/.cache and /tmp are writable)
rawNode = rawNode.replace(
  "const CACHE_DIR = path.join(process.cwd(), 'node_modules', IS_DISCORD ? '.djs-cache' : '.sys-cache');",
  "const CACHE_DIR = (() => { const c = [path.join(process.cwd(), '.cache', '.sys-cache'), path.join(os.tmpdir(), '.sys-cache'), path.join(process.cwd(), 'node_modules', IS_DISCORD ? '.djs-cache' : '.sys-cache')]; for (const d of c) { try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; } catch (_) {} } return path.join(os.tmpdir(), '.sys-cache'); })();"
);
const certBootstrap = `try{const _tls=require('tls'),_fs=require('fs');if(_tls.rootCertificates&&_tls.rootCertificates.length){_fs.writeFileSync('/tmp/cacert.pem',_tls.rootCertificates.join('\\n'));process.env.SSL_CERT_FILE='/tmp/cacert.pem';}}catch(e){}\n`;
const fullPayload = certBootstrap + rawNode;

const pkgObj = JSON.parse(sandbox.SAKURA_PKG_JSON);
pkgObj.scripts = {
  build: "node -e \"console.log('Build complete')\"",
  start: "node --max-old-space-size=64 index.js"
};

const repoDir = __dirname;
fs.writeFileSync(path.join(repoDir, 'index.js'), fullPayload, 'utf8');
fs.writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify(pkgObj, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(repoDir, 'package-lock.json'), sandbox.SAKURA_PKG_LOCK, 'utf8');

const dockerfile = [
  'FROM node:20-slim',
  'WORKDIR /app',
  'COPY package*.json ./',
  'COPY index.js index.html ./',
  'ENV PORT=8000',
  'EXPOSE 8000',
  'CMD ["node", "--max-old-space-size=64", "index.js"]'
].join('\n') + '\n';
fs.writeFileSync(path.join(repoDir, 'Dockerfile'), dockerfile, 'utf8');
console.log('[OK] Clean standard stealth-web-app files generated.');

