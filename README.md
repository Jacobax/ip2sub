# CF-Workers-SUB

这是一个基于 Cloudflare Worker 的订阅生成与转换工具，支持 VLESS、Trojan 节点，结合 UNI API、FDIP、IPS 列表生成订阅。  

---

## 功能特点

- 支持 VLESS 和 Trojan 节点模板  
- 从 UNI API 拉取节点，可按 `name` 分组随机抽取指定数量（`UNI_COUNT`）  
- 支持 IPS 列表和 DIFF API 节点  
- 支持 FDIP 配置，可从 KV 存储或常量列表加载  
- 支持通过 URL 查询参数覆盖默认配置  
- 自动去重节点，支持 Base64、Clash、Sing-box 等多种订阅格式  
- Clash 配置自动修复 WireGuard 节点远程 DNS 设置  

---

## 配置参数

### Worker 端默认值（可被 URL 覆盖）

| 参数 | 默认值 | 描述 |
|------|--------|------|
| `UUID` | (已隐藏) | VLESS UUID |
| `MIMA` | (已隐藏) | Trojan 密码 |
| `hostV` | (已隐藏) | VLESS host/sni 值 |
| `hostT` | (已隐藏) | Trojan host/sni 值 |
| `VLESS_PATH_PREFIX` | `/snippets/ip=` | VLESS path 前缀 |
| `TROJAN_PATH_PREFIX` | `/proxyip=` | Trojan path 前缀 |
| `UNI_COUNT` | `0` | 从 UNI API 每个 name 抽取数量，0 表示全取 |
| `apiUni` | API 地址 | UNI API 节点源 |
| `apiDiff` | API 地址 | DIFF API 节点源 |
| `IPS` | 列表 | 本地 IPS 节点列表 |
| `FDIP` | 列表 | FDIP 节点列表，可与 KV 结合使用 |
| `KV_FDIP_KEY` | `FDIP_LIST` | KV 存储 FDIP 列表键名 |
| `SUBUpdateTime` | `6` | 订阅更新间隔（小时） |
| `FileName` | `CF-Workers-SUB` | 下载文件名 |

---

## URL 查询参数

- `trojan=1`：生成 Trojan 节点订阅  
- `uuid=<UUID>`：覆盖默认 UUID  
- `mima=<密码>`：覆盖默认 Trojan 密码  
- `hostV=<域名>`：覆盖 VLESS host  
- `hostT=<域名>`：覆盖 Trojan host  
- `vlessPrefix=<路径前缀>`  
- `trojanPrefix=<路径前缀>`  
- `fdip=all`：使用所有 FDIP  
- `fdip=<IP:端口>`：强制使用指定 FDIP  
- `uni_count=<数字>`：覆盖 UNI_COUNT，从每个 name 抽取指定数量  

示例：

https://your-worker-domain/?trojan=1&uni_count=5&fdip=all

---

## 节点生成逻辑

1. 拉取 UNI API 节点，并按 `name` 分组随机抽取 `UNI_COUNT` 条（不足则全取）  
2. 处理 IPS 列表和 DIFF API 节点  
3. FDIP 匹配规则：优先匹配节点 name，如果没有匹配则随机选 FDIP  
4. 生成节点模板（VLESS 或 Trojan），路径参数自动生成并编码  
5. 合并所有节点，去重后返回  

---

## 订阅输出格式

- `base64`：原始 Base64 节点列表  
- `clash`：Clash YAML 配置（自动修复 WireGuard 节点）  
- `singbox`：Sing-box 配置  
- `surge`：Surge 配置  
- `quanx`：Quantumult X 配置  
- `loon`：Loon 配置  

自动检测客户端 User-Agent 或通过 URL 参数选择输出格式。  

---

## 注意事项

- KV 功能仅在 Cloudflare Worker KV 命名空间绑定后生效  
- API 或 IPS 配置为空时对应节点源将被忽略  
- UNI_COUNT 设置为 0 或不填时表示使用全部 UNI API 节点  
- Base64 编码采用兼容浏览器方式，确保订阅工具可以直接使用  
- Clash WireGuard 节点默认启用 `remote-dns-resolve`  

---

## 参考

- Cloudflare Worker 文档：[https://developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)  
- Sing-box 官方：[https://github.com/SagerNet/sing-box](https://github.com/SagerNet/sing-box)  
- Clash 官方：[https://github.com/Dreamacro/clash](https://github.com/Dreamacro/clash)


---
