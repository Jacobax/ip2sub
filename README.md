# 🌐 Cloudflare Worker - VLESS/Trojan 订阅器  

本项目基于 Cloudflare Workers 构建，支持自动聚合多个来源的节点数据，并根据参数动态生成 **VLESS** 或 **Trojan** 的订阅内容，兼容 **Clash / Sing-box** 等客户端。  

---

## ⚙️ 功能特性  

- ✅ 动态生成 VLESS / Trojan 节点链接  
- ✅ 支持多来源合并（API、固定列表、差异列表）  
- ✅ 可指定每个来源随机抽取数量  
- ✅ 支持 `uuid`、`mima`、`host`、`path`、`prefix` 等动态替换  
- ✅ 支持 `KV` 缓存 FDIP（备用节点信息）  
- ✅ 支持订阅转换（Clash / Sing-box）  
- ✅ 可选参数控制输出格式  

---

## 🧩 环境变量说明  

| 变量名 | 说明 |
| :-- | :-- |
| `UUID` | VLESS 用户 UUID |
| `MIMA` | Trojan 用户密码 |
| `hostV` | VLESS 节点的 SNI / Host |
| `hostT` | Trojan 节点的 SNI / Host |
| `VLESS_PATH_PREFIX` | VLESS 节点路径前缀 |
| `TROJAN_PATH_PREFIX` | Trojan 节点路径前缀 |
| `apiUni` | UNI 节点来源 API 地址 |
| `apiDiff` | DIFF 节点来源 API 地址 |
| `IPS` | 固定节点列表（IP:PORT 格式） |
| `FDIP` | FDIP 备用节点列表 |
| `KV_FDIP_KEY` | 存放于 KV 的 FDIP 键名 |
| `UUID_CACHE` | KV 命名空间，用于缓存数据 |

> **注意：**  
> 以上环境变量在 `Cloudflare Dashboard → Workers → Settings → Variables` 中配置。  

---

## 🔢 查询参数说明  

以下参数可直接在订阅链接后追加，例如：
```
https://example.workers.dev/?target=clash&uni_count=5&diff_count=3
```
| 参数 | 默认值 | 说明 |
| :-- | :-- | :-- |
| `target` | `singbox` | 订阅输出格式，可选 `clash` / `singbox` |
| `uuid` | 环境变量 `UUID` | 动态覆盖 UUID |
| `mima` | 环境变量 `MIMA` | 动态覆盖 Trojan 密码 |
| `hostV` / `hostT` | 环境变量值 | 动态覆盖节点主机名 |
| `uni_count` | `5` | 从 UNI 来源每个 name 随机抽取条目数<br>`0` 表示禁用，`all` 表示全取 |
| `diff_count` | `5` | 同上，用于 DIFF 来源 |
| `fdip` | 空 | 备用节点指定方式：<br>• `ip:port` 固定单节点<br>• `all` 轮询所有 FDIP 节点 |
| `vlessPrefix` / `trojanPrefix` | 环境变量值 | 覆盖路径前缀 |
| `trojan=1` | - | 启用 Trojan 模式（默认 VLESS） |

---

## 🧠 工作逻辑  

1. 从配置的多个来源（API、固定列表、KV）获取节点数据。  
2. 按 `uni_count` / `diff_count` 抽取指定数量的条目。  
3. 生成对应协议（VLESS 或 Trojan）的完整节点链接。  
4. 若指定 `target=clash` 或 `target=singbox`，则自动转为对应订阅格式。  
5. 输出聚合结果作为纯文本或订阅配置文件。  

---

## 📦 部署步骤  

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。  
2. 创建新 Worker 并粘贴 `_worker.js` 全部代码。  
3. 在 **Settings → Variables → Environment Variables** 中配置所需变量。  
4. 若使用 KV：  
   - 在 **Workers KV** 创建命名空间 `UUID_CACHE`。  
   - 绑定至 Worker 环境。  
5. 点击 **Deploy** 发布。  

---

## 🔍 示例链接  

**普通订阅（VLESS）**
```
https://your-worker.workers.dev/?target=singbox
```
**Clash 订阅**
```
https://your-worker.workers.dev/?target=clash
```
**仅取 3 条 UNI 来源节点并禁用 DIFF 来源**
```
https://your-worker.workers.dev/?uni_count=3&diff_count=0
```
**使用固定 FDIP**
```
https://your-worker.workers.dev/?fdip=1.2.3.4:443
```
**启用 Trojan 模式**
```
https://your-worker.workers.dev/?trojan=1
```
---

## 🧾 调试建议  

- 若访问返回 `404`：检查 API 或固定节点是否有内容。  
- 若返回 `500`：检查 FDIP 格式是否正确。  
- 可通过日志查看 `console.log` 输出以确认节点来源是否加载成功。  

---

## 📘 配置示例  

以下为环境变量内容示例（所有示例均为伪造数据）：  

**IPS**
```
1.1.1.1:443#HK_AWS
2.2.2.2:443#JP_Tokyo
3.3.3.3:2053#US_LA
```
**FDIP**
```
104.16.10.5:8443#cfnode1
104.19.21.7:2053#cfnode2
104.20.33.8:2087#cfnode3
```
**apiUni**
```
https://api.example.com/uni?name=hk
https://api.example.com/uni?name=jp
https://api.example.com/uni?name=us
```
**apiDiff**
```
https://api.example.com/diff?region=hk
https://api.example.com/diff?region=jp
https://api.example.com/diff?region=us
```
---

## 📚 文件结构

. ├── _worker.js      # Cloudflare Worker 主程序  
├── README.md       # 使用文档  
└── /KV/            # KV 存储命名空间（仅说明，不是实际文件夹）  

---

## 📄 License  

MIT License  
作者保留代码结构与逻辑的版权说明权。  

---

**最后更新：** 2025-13


---
