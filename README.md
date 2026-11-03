# DevPulse Stealth Web Gateway (高防审核微服务套件)

针对严格限制或主动封禁代理容器的云托管平台（如 Render、Koyeb、HuggingFace、Serv00、OptikLink 翼龙容器等）设计的高隐蔽性落地方案。

---

## 🌟 四维隐蔽架构

1. **真实 Web 业务伪装 (`index.html`)**：
   - 根路径 `/` 挂载真实的 **DevPulse 开发者网络与编解码工具箱**；
   - 平台的巡检机器人（Health Check / Uptime Probe）访问永远返回 `200 OK` 并呈现真实合规界面；
   - 接口 `/api/ping` 与 `/health` 提供合法测速与健康检查。

2. **私有镜像安全下载 (Cloudflare Worker 中转)**：
   - 容器下载二进制核心时，请求直达你的 Cloudflare Worker（`https://python-packer.yxj-acb.workers.dev/dl/engine`）；
   - 彻底掐断对 `github.com/SagerNet`、`eooce` 等已知代理仓库的直连，逃避出站透明网关（Egress Firewall）的 SNI / 域名黑名单拦截。

3. **内存管道直推 (0 字节落盘)**：
   - 核心进程通过 `sing-box run -c -` 从 Unix 标准输入管道（`stdin`）读取 JSON 配置；
   - 全生命周期内，磁盘上**不写入任何 `config.json` 或节点文件**，宿主机安全扫描器完全抓不到文件指纹。

4. **单端口 Web 容器化 (100% 适配云平台规范)**：
   - 放弃暴露外部非标端口（如 6455），容器仅监听 `$PORT`（默认 3000）；
   - 代理流量全部依托 Cloudflare Argo 隧道走标准 HTTPS / WSS 协议流转，对外表现为纯粹的标准 HTTP 微服务。

---

## 📂 文件结构

- `index.html`：前端伪装工具箱页面
- `app.py`：未打包的 Python 源码（含脱敏配置、内存管道直推与单端口 Web 服务）
- `main.py`：已完成 Zlib 压缩 + XOR 掩码 + Base64 单文件自解压打包的最终生产文件
- `Dockerfile`：通用容器构建配置
- `requirements.txt`：运行时基础依赖

---

## 🚀 部署指南

### 1. 翼龙面板 (Pterodactyl / OptikLink)
- 将 `main.py` 和 `index.html` 上传至根目录；
- 面板启动命令设置为：`python main.py`；
- 重启容器即可。

### 2. Docker / PaaS (Koyeb / Render / HuggingFace)
- 直接上传本目录全部文件；
- 环境变量可根据需要覆盖：
  - `PORT`: 平台指定端口（默认 3000）
  - `ARGO_AUTH`: 你的 Cloudflare Tunnel Token
  - `ARGO_DOMAIN`: 你的固定隧道域名
  - `UUID`: 你的自定义 UUID
  - `BOT_TOKEN` & `CHAT_ID`: Telegram 节点推送

