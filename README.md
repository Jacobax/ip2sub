# CF-Workers-SUB

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/cf-workers-sub) 

这是一个基于Cloudflare Workers的订阅生成器，用于动态拉取IP来源并生成VLESS/Trojan节点订阅。支持多种协议转换（如Clash、Surge等），并集成FDIP反代优化，提升节点可用性。 

## 功能特点 

- **多来源支持**：集成UNI API（优选IP）、DIFF API（匹配FDIP）、静态IPS列表，可配置为空。 
- **FDIP反代**：IPS和DIFF API节点可匹配/随机使用FDIP（SG/JP/FI），支持域名/IP。 
- **通用Path生成**：统一path格式（如`/snippets/ip=ip/domain:port`），兼容VLESS/Trojan，易扩展。 
- **查询参数灵活**：支持`?trojan=1`切换模板、`?fdip=ip:port`强制统一path、`?uuid=xxx`等动态覆盖核心参数。 
- **订阅转换**：集成subconverter，支持base64/Clash/Surge等格式输出。 
- **配置校验**：确保至少一个来源不为空，FDIP依赖时必填。 

## 配置说明 

在`_worker.js`中修改以下常量： 

- **API地址**： 
  - `apiUni`：UNI API URL，设为空字符串禁用。 
  - `apiDiff`：DIFF API URL，设为空字符串禁用。 

- **IPS列表**：静态IP数组，如`['ip/domain:port#name']`，为空数组`[]`禁用。 

- **FDIP列表**：反代IP数组，如`['ip/domain:port#标签']`，为空数组`[]`禁用（但IPS/DIFF启用时必填）。 

- **模板**： 
  - `vlessTemplate`：VLESS URI模板。 
  - `trojanTemplate`：Trojan URI模板。 

- **订阅转换**： 
  - `subConverter`：后端URL。 
  - `subConfig`：配置文件URL。 

示例配置（简化）： 
```javascript 
const IPS = [ 
  'ip/domain:port#name', 
  'ip/domain:port#name' 
]; 

const FDIP = [ 
  'ip/domain:port#标签', 
  'ip/domain:port#标签' 
]; 
``` 

## 使用方法 

1. **部署**：点击上方按钮一键部署到Cloudflare Workers，或手动上传`_worker.js`。 

2. **访问订阅**： 
   - 基础URL：`https://your-worker.workers.dev` 
   - 示例：`https://your-worker.workers.dev?trojan=1&fdip=8.8.8.8:443&uuid=new-uuid&hostV=custom-host.com` 

3. **查询参数**： 
   - `?trojan=1`：使用Trojan模板（默认VLESS）。 
   - `?fdip=ip:port` 或 `?fdip=ip/domain:port`：强制所有节点path使用指定值。 
   - `?uuid=xxx`：覆盖VLESS UUID（默认从代码常量）。 
   - `?mima=yyy`：覆盖Trojan密码（默认从代码常量）。 
   - `?hostV=zzz`：覆盖VLESS host/sni值（默认从代码常量）。 
   - `?hostT=www`：覆盖Trojan host/sni值（默认从代码常量）。 
   - `?clash` / `?surge` 等：触发对应格式转换。 
   - `?b64`：强制base64输出。 

4. **输出格式**： 
   - 默认：Base64编码节点列表。 
   - 客户端UA检测：自动适配Clash/Surge/Quantumult X等。 

## 部署步骤 

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) > Workers & Pages > 创建应用 > Workers > 上传`_worker.js`。 
2. 配置环境变量（可选）：`SUBAPI`、`SUBCONFIG`覆盖默认。 
3. 测试：访问Worker URL，下载订阅文件解码验证节点。 

## 示例节点输出 

VLESS（无fdip，简化）： 
``` 
vless://UUID@[ip]:[port]?path=%2Fsnippets%2Fip%3D[ip]:[port]&...#[name] 
vless://...@[ip]:[port]?path=%2Fsnippets%2Fip%3Ddomain%3Aport&...#[name] 
``` 

Trojan（有fdip=example.com:443）： 
``` 
trojan://PASSWORD@[ip]:[port]?...&path=%2Fproxyip%3Dexample.com%3A443#[name] 
``` 

## 故障排除 

- **无节点**：检查配置，确保至少一个来源启用。 
- **FDIP错误**：IPS/DIFF启用时，FDIP不能为空。 
- **转换失败**：fallback到base64，检查subConverter连通性。 
- **日志**：Workers控制台查看console.error。 

## 贡献 

欢迎PR！fork仓库，修改`_worker.js`，提交issue反馈。 

## 许可证 

MIT License - 免费使用、修改、分发。