# CF-Workers-SUB

一个基于 Cloudflare Workers 的订阅生成器，用于动态生成 VLESS 或 Trojan 节点订阅，支持多种 IP 来源和反代优化。适用于 Clash、Surge、Quantumult X 等客户端，支持 Base64 和多种配置文件格式。

## 功能概述

- **节点来源**：
  - UNI API：直接使用优选 IP 作为反代（默认）。
  - IPS 列表：静态 IP 列表，使用 FDIP 优化反代。
  - DIFF API：动态 API 节点，使用 FDIP 反代。
- **FDIP 支持**：反代 IP 优化，支持常量列表 + KV 存储动态更新。按节点名称匹配（忽略大小写），多匹配随机选，无匹配全局随机。
- **协议支持**：VLESS (默认) 或 Trojan (?trojan=1)。
- **订阅转换**：集成 SubConverter，支持 Clash、Surge、Loon、Quantumult X、Sing-box 等格式。
- **动态参数**：支持查询参数覆盖 UUID、密码、Host 等。
- **FDIP 扩展**：?fdip=ip:port (强制单一) 或 ?fdip=all (所有来源使用 FDIP)。
- **Path 前缀管理**：支持动态覆盖 VLESS/Trojan path 前缀 (?vlessPrefix=xxx&trojanPrefix=yyy)。

## 配置

在 Worker 代码中修改以下常量（建议使用环境变量覆盖）：

```javascript
// 订阅转换后端
const subConverter = 'YOUR_SUBCONVERTER_DOMAIN'; // e.g., 'SUBAPI.example.com'

// 订阅配置文件
const subConfig = 'YOUR_CONFIG_URL'; // e.g., 'https://raw.githubusercontent.com/user/repo/main/config.ini'

// 下载文件名
const FileName = 'CF-Workers-SUB'; // 可自定义

// 更新间隔 (小时)
const SUBUpdateTime = 6;

// VLESS 配置 (默认，可查询参数覆盖)
const UUID = 'YOUR_VLESS_UUID'; // e.g., 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
const hostV = 'YOUR_VLESS_HOST'; // e.g., 'host.example.com'

// Trojan 配置 (默认，可查询参数覆盖)
const MIMA = 'YOUR_TROJAN_PASSWORD'; // e.g., 'your-password'
const hostT = 'YOUR_TROJAN_HOST'; // e.g., 'trojan.example.com'

// Path 前缀配置 (默认，可查询参数覆盖)
const VLESS_PATH_PREFIX = '/snippets/ip='; // VLESS path 前缀
const TROJAN_PATH_PREFIX = '/proxyip='; // Trojan path 前缀

// API 地址 (空字符串禁用)
const apiUni = 'YOUR_UNI_API_URL'; // UNI API (反代同优选)
const apiDiff = 'YOUR_DIFF_API_URL'; // DIFF API (需 FDIP)

// IPS 列表 (ip:port#name 格式，空数组禁用)
const IPS = [
  // 示例: 'example-ip.com:443#标签'
];

// FDIP 列表 (ip:port#name 格式，空数组禁用)
const FDIP = [
  // 示例: 'fdip.example.com:443#SG'
];

// KV FDIP 键名 (用于动态 FDIP)
const FDIP_KEY = 'YOUR_KV_KEY'; // e.g., 'KV_FDIP_LIST'
```

### KV 配置
- 在 Cloudflare Dashboard > Workers > Settings > Bindings > Add > KV Namespace，绑定变量名为 `KV`。
- 在 KV 中写入键 `FDIP_KEY` 的值（多行 ip:port#name 格式）。

## 使用方法

1. **部署 Worker**：
   - 在 Cloudflare Dashboard 创建 Worker，粘贴代码。
   - 配置 KV（可选）。
   - 保存并部署。

2. **访问订阅**：
   - Base64 格式：`https://your-worker.workers.dev`
   - 指定格式：添加查询参数，如 `?clash` (Clash) 或 `?surge` (Surge)。
   - 示例：`https://your-worker.workers.dev?clash`

3. **查询参数**：
   - `?trojan=1`：使用 Trojan 模板。
   - `?uuid=xxx`：覆盖 VLESS UUID。
   - `?mima=yyy`：覆盖 Trojan 密码。
   - `?hostV=zzz`：覆盖 VLESS Host/SNI。
   - `?hostT=www`：覆盖 Trojan Host/SNI。
   - `?vlessPrefix=xxx`：覆盖 VLESS path 前缀 (e.g., '/custom/vless/ip=')。
   - `?trojanPrefix=yyy`：覆盖 Trojan path 前缀 (e.g., '/custom/trojan/ip=')。
   - `?fdip=ip:port`：强制所有节点使用指定 FDIP。
   - `?fdip=all`：所有来源 (UNI/IPS/DIFF) 使用 FDIP 反代。
   - `?b64` 或 `?base64`：强制 Base64 输出。

## 示例节点生成

- **VLESS (默认)**：`vless://uuid@[ip]:[port]?path=[path]&...#[name]`
- **Trojan**：`trojan://password@[ip]:[port]?path=[path]&...#[name]`
- Path 示例：`/snippets/ip=fdip.example.com:443` (VLESS) 或 `/proxyip=fdip.example.com:443` (Trojan)。

## 订阅格式支持

| 格式       | User-Agent 或参数          | 目标模板          |
|------------|----------------------------|-------------------|
| Base64    | 默认或 `?b64`             | Base64 编码      |
| Clash     | `clash` 或 Clash UA       | Clash YAML       |
| Surge     | `surge`                   | Surge.conf       |
| Quantumult X | `quanx`                | Quantumult.conf  |
| Loon      | `loon`                    | Loon.conf        |
| Sing-box  | `sb` 或 `singbox`         | Sing-box JSON    |

## 注意事项

- **FDIP 检查**：如果 IPS/DIFF 或 `?fdip=all` 启用，但 FDIP 为空，会返回 500 错误。
- **去重**：自动去除重复节点。
- **错误处理**：API 拉取失败 fallback 为空；KV 未绑定 fallback 到常量 FDIP。
- **性能**：适合低频使用；高负载可优化缓存。
- **自定义**：Clash 输出有 WireGuard 修复；Base64 使用内置编码。
- **许可证**：MIT License。

## 贡献

欢迎 PR 或 Issue。测试时，请使用占位符替换敏感配置。

---

*最后更新：2025-10-05*