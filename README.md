# DevPulse Stealth Web Gateway (高防审核微服务套件)

针对严格限制或主动封禁代理容器的云托管平台（如 Render、Koyeb、HuggingFace、Serv00、OptikLink 翼龙容器等）设计的全栈高隐蔽性落地方案。
本仓库同时原生支持 **Python** 与 **Node.js** 双运行栈。

---

## 🌟 四维隐蔽架构

1. **真实 Web 业务伪装 (`index.html`)**：
   - 根路径 `/` 挂载真实的 **DevPulse 开发者网络与编解码工具箱**；
   - 平台的巡检机器人（Health Check / Uptime Probe）访问永远返回 `200 OK` 并呈现真实合规界面；
   - 接口 `/api/ping` 与 `/health` 提供合法测速与健康检查。

2. **私有镜像安全下载 (Cloudflare Worker 中转)**：
   - 容器下载二进制核心时，请求直达你的 Cloudflare Worker 镜像；
   - 彻底掐断对 `github.com/SagerNet`、`eooce` 等已知代理仓库的直连，逃避出站透明网关（Egress Firewall）的 SNI / 域名黑名单拦截。

3. **内存管道直推 (0 字节落盘)**：
   - 核心进程从 Unix 标准输入管道（`stdin`）读取配置；
   - 全生命周期内，磁盘上**不写入任何 `config.json` 或 `sub.txt` 节点文件**，宿主机安全扫描器完全抓不到文件指纹。

4. **单端口 Web 容器化 (100% 适配云平台规范)**：
   - 放弃暴露外部非标端口（如 6455），容器仅监听 `$PORT` 或 `$SERVER_PORT`（默认 3000）；
   - 代理流量全部依托 Cloudflare Argo 隧道走标准 HTTPS / WSS 协议流转，对外表现为纯粹的标准 HTTP 微服务。

---

## 📂 双栈入口对应

| 运行环境 | 开发/源码入口 | 0 明文生产入口（推荐直接运行） |
| :--- | :--- | :--- |
| **🐍 Python 环境** | `app.py` | `main.py` |
| **🟢 Node.js 环境** | `app.js` | `index.js` |

*两个环境均共用 `index.html` 前端测速工具箱，并自动自愈、自动清屏与推送 Telegram。*

---

## 🚀 部署指南

### 1. 翼龙面板 (Pterodactyl / OptikLink)
- **如果你用的是 Python 镜像**：只需上传 `main.py` 和 `index.html`，启动命令：`python main.py`。
- **如果你用的是 Node.js 镜像**：只需上传 `index.js` 和 `index.html`，启动命令：`node index.js`。
- 启动后自动检测面板端口，浏览器打开 `IP:端口` 即可访问前端，TG 机器人自动收到订阅。

### 2. Docker / PaaS (Koyeb / Render / HuggingFace)
- 直接连接本 GitHub 私有仓库；
- 平台自动识别并执行构建；
- 环境变量可根据需要按下方场景设置。

---

## 🌐 三大接入场景配置指南（完美支持自有域名）

无论你的平台是否支持 Argo 隧道，本网关均能智能自适应：

### 场景 1：PaaS 平台（如 Koyeb, Render, Zeabur）+ 自有域名（免 Argo）
- **原理特点**：平台提供 443 HTTPS 自动证书网关。本程序在单个 `$PORT` 上动态分流：普通访问呈现 DevPulse 诊断前端，WebSocket 连接直通内核。
- **域名配置**：在 PaaS 平台后台绑定自定义域名（例如 `api.yourdomain.com`），并将域名字段 CNAME 解析到平台。
- **环境变量设置**：
  - `CUSTOM_DOMAIN`: `api.yourdomain.com`（填你的域名）
  - `DISABLE_ARGO`: `true`（禁用 Argo）
  - `UUID`: 你的自定义 UUID（可选，有内置默认密文）

### 场景 2：独立 IP:端口平台（如 翼龙面板 Pterodactyl / OptikLink / Serv00 / VPS）（免 Argo）
- **原理特点**：利用分配的独立公网端口，启动极速 **VLESS Reality** 原生直连，借用大厂 TLS 1.3 握手证书（`www.iij.ad.jp`）伪装，抗封锁、延迟最低。
- **域名配置**：在 Cloudflare 或域名商处添加 A 记录：`node.yourdomain.com` -> `服务器公网IP`，**务必关闭代理（仅 DNS 解析 / 灰色小云朵）**。
- **环境变量设置**：
  - `CUSTOM_DOMAIN`: `node.yourdomain.com`（节点地址将自动使用此域名）
  - `DISABLE_ARGO`: `true`
  - `REALITY_PORT`: 面板分配的端口（翼龙面板会自动读取 `$SERVER_PORT`，留空即可自动绑定）

### 场景 3：Cloudflare Argo 隧道穿透（穿透任意内网/封堵环境）
- **原理特点**：依托 Cloudflare CDN 边缘节点穿透，适合没有公网端口或平台封堵直连的情况。
- **环境变量设置**：
  - `ARGO_AUTH`: 你的 Cloudflare Tunnel Token
  - `ARGO_DOMAIN`: 你的固定隧道域名
  - `DISABLE_ARGO`: `false`
  - `CFIP` / `CFPORT`: 优选 IP 与端口（默认即可）
