// ===== 配置变量 =====
const subConverter = 'SUBAPI.cmliussss.net'; // 订阅转换后端
const subConfig = 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini'; // 订阅配置文件
const FileName = 'CF-Workers-SUB'; // 下载文件名
const SUBUpdateTime = 6; // 订阅更新间隔（小时）

// 通用配置参数
const UUID = '17f0bb43-bc90-458e-9752-5027839cd5e4'; // VLESS UUID
const MIMA = 'mima'; // Trojan 密码
const hostV = ''; // VLESS host/sni 值
const hostT = ''; // Trojan host/sni 值

// VLESS 模板（使用 [path] 占位，host/sni 统一用 hostV）
const vlessTemplate = `vless://${UUID}@[ip]:[port]?path=[path]&security=tls&alpn=h3&encryption=none&host=${hostV}&fp=random&type=ws&sni=${hostV}#[name]`;

// Trojan 模板（使用 [path] 占位，host/sni 统一用 hostT）
const trojanTemplate = `trojan://${MIMA}@[ip]:[port]?security=tls&sni=${hostT}&fp=chrome&type=ws&host=${hostT}&path=[path]#[name]`;

// API 地址（为空字符串则禁用）
const apiUni = ''; // 反代IP同优选IP，记为UNI API
const apiDiff = ''; // 反代IP取自FDIP，记为DIFF API

// IPS 列表（为空数组则禁用）
const IPS = [
   'cf.qmqm.cf:443#官方',
   'mfa.gov.ua:443官方',
   'cm.cf.090227.xyz:443#官方',
   'download.yunzhongzhuan.com:443#官方',
   'www.shopify.com:443#官方'
];

// FDIP 列表（为空数组则禁用，但需检查使用条件）
const FDIP = [
  'ProxyIP.SG.CMLiussss.net:443#SG',
  'ProxyIP.JP.CMLiussss.net:443#JP',
  'ProxyIP.FI.CMLiussss.net:443#FI'
];

// ===== 辅助函数：生成path =====
function generatePath(useTrojan, pathIp, pathPort) {
  const prefix = useTrojan ? '/proxyip=' : '/snippets/ip=';	//分别为trojan、vless模板path路径前缀，path=[前缀][port:ip]
  const rawPath = `${prefix}${pathIp}:${pathPort}`;
  return encodeURIComponent(rawPath);
}

// ===== 辅助函数：选择FDIP（匹配name或随机） =====
function selectFdip(name, FDIP) {
  // 按 name 匹配 FDIP（优先匹配，多个取第一个；无匹配则随机）
  let selectedFdip = null;
  for (const fdip of FDIP) {
    const [_, fdipName] = fdip.split('#');
    if (name.includes(fdipName.trim())) {
      selectedFdip = fdip;
      break;
    }
  }
  if (!selectedFdip) {
    selectedFdip = FDIP[Math.floor(Math.random() * FDIP.length)];
  }
  const [addrFdip] = selectedFdip.split('#');
  return addrFdip.split(':');
}

// ===== Worker 主逻辑 =====
export default {
  async fetch(request, env) {
    try {
      const reqUrl = new URL(request.url);

      // 根据查询参数决定使用哪种模板（?trojan=1 时使用 trojan）
      const useTrojan = reqUrl.searchParams.get('trojan') === '1';
      const template = useTrojan ? trojanTemplate : vlessTemplate;

      // 获取强制FDIP参数（?fdip=ip:port）
      const forcedFdip = reqUrl.searchParams.get('fdip');
      let forcedIpFdip, forcedPortFdip;
      let useForcedFdip = false;
      if (forcedFdip && forcedFdip.includes(':')) {
        const [ip, port] = forcedFdip.split(':');
        if (ip && port) {
          forcedIpFdip = ip;
          forcedPortFdip = port;
          useForcedFdip = true;
        }
      }

      // 处理UNI API 节点
      let apiNodes = [];
      if (apiUni && apiUni.trim() !== '') {
        const res = await fetch(apiUni);
        if (res.ok) {
          const text = await res.text();
          const apiLines = text.split('\n').filter(l => l.trim());
          apiNodes = apiLines.map(line => {
            const [addr, rawName] = line.split('#');
            const [ip, port] = addr.split(':');

            // path：如果使用强制FDIP，则用其ip:port；否则用原
            let pathIp = ip;
            let pathPort = port;
            if (useForcedFdip) {
              pathIp = forcedIpFdip;
              pathPort = forcedPortFdip;
            }
            const pathParam = generatePath(useTrojan, pathIp, pathPort);

            // 对 name 做 URL 编码（用于 #fragment）
            const name = rawName ? rawName.trim() : ip;
            const nameEnc = encodeURIComponent(name);

            return template
              .replaceAll('[ip]', ip)
              .replaceAll('[port]', port)
              .replaceAll('[path]', pathParam)
              .replaceAll('[name]', nameEnc);
          });
        } else {
          console.error('UNI API拉取失败');
        }
      }

      // 处理 IPS 节点（统一逻辑：匹配/随机FDIP）
      let ipsNodes = [];
      if (IPS.length > 0) {
        ipsNodes = IPS.map(line => {
          const [addr, rawName] = line.split('#');
          const [ip, port] = addr.split(':');

          // 提取 name
          const name = rawName ? rawName.trim() : '';

          // path：如果使用强制FDIP，则用其ip:port；否则用匹配/随机FDIP
          let pathIp, pathPort;
          if (useForcedFdip) {
            pathIp = forcedIpFdip;
            pathPort = forcedPortFdip;
          } else {
            const [fdipIp, fdipPort] = selectFdip(name, FDIP);
            pathIp = fdipIp;
            pathPort = fdipPort;
          }
          const pathParam = generatePath(useTrojan, pathIp, pathPort);

          // 对 name 做 URL 编码（用于 #fragment）
          const nameEnc = encodeURIComponent(name || ip);

          return template
            .replaceAll('[ip]', ip)
            .replaceAll('[port]', port)
            .replaceAll('[path]', pathParam)
            .replaceAll('[name]', nameEnc);
        });
      }

      // 拉取并处理DIFF API 节点（统一逻辑：匹配/随机FDIP）
      let newNodes = [];
      if (apiDiff && apiDiff.trim() !== '') {
        try {
          const newRes = await fetch(apiDiff);
          if (newRes.ok) {
            const newText = await newRes.text();
            const newLines = newText.split('\n').filter(l => l.trim());
            newNodes = newLines.map(line => {
              const [addr, rawName] = line.split('#');
              const [ip, port] = addr.split(':');

              // 提取 name
              const name = rawName ? rawName.trim() : '';

              // path：如果使用强制FDIP，则用其ip:port；否则用匹配/随机FDIP
              let pathIp, pathPort;
              if (useForcedFdip) {
                pathIp = forcedIpFdip;
                pathPort = forcedPortFdip;
              } else {
                const [fdipIp, fdipPort] = selectFdip(name, FDIP);
                pathIp = fdipIp;
                pathPort = fdipPort;
              }
              const pathParam = generatePath(useTrojan, pathIp, pathPort);

              // 对 name 做 URL 编码（用于 #fragment）
              const nameEnc = encodeURIComponent(name || ip);

              return template
                .replaceAll('[ip]', ip)
                .replaceAll('[port]', port)
                .replaceAll('[path]', pathParam)
                .replaceAll('[name]', nameEnc);
            });
          } else {
            console.error('DIFF API拉取失败');
          }
        } catch (e) {
          console.error('DIFF API拉取异常:', e);
        }
      }

      // 检查来源：至少一个不为空
      const totalNodes = apiNodes.length + ipsNodes.length + newNodes.length;
      if (totalNodes === 0) {
        return new Response('配置错误：两个API和IPS至少需要其中一个不为空', { status: 500 });
      }

      // 检查FDIP：当IPS或DIFF API不为空且未使用强制FDIP时，必须FDIP不为空
      const hasFdipDependent = (ipsNodes.length > 0 || newNodes.length > 0);
      if (hasFdipDependent && !useForcedFdip && FDIP.length === 0) {
        return new Response('配置错误：当使用IPS或DIFF API时，FDIP必须不为空', { status: 500 });
      }

      // 合并所有节点
      const nodes = [...apiNodes, ...ipsNodes, ...newNodes].join('\n');

      // 调用订阅转换逻辑（将原始节点列表传给转换器）
      return handleSubscription(request, nodes, request.url, 'mytoken', env);
    } catch (e) {
      return new Response('运行错误: ' + (e && e.message ? e.message : String(e)), { status: 500 });
    }
  }
};

// ===== 订阅转换函数 =====
async function handleSubscription(request, req_data, 订阅转换URL, mytoken, env) {
  const userAgentHeader = request.headers.get('User-Agent') || 'unknown';
  const userAgent = userAgentHeader.toLowerCase();
  const url = new URL(request.url);

  // 覆盖默认配置（支持环境变量）
  const converter = env?.SUBAPI || subConverter;
  const subProtocol = converter.includes('http://') ? 'http' : 'https';
  const subConverterHost = converter.includes('://') ? converter.split('//')[1] : converter;
  const configFile = env?.SUBCONFIG || subConfig;

  // 确定订阅格式
  let 订阅格式 = 'base64';
  let 追加UA = 'v2rayn';
  if (!(userAgent.includes('null') || userAgent.includes('subconverter') || userAgent.includes('nekobox') || userAgent.includes('cf-workers-sub'))) {
    if (userAgent.includes('sing-box') || userAgent.includes('singbox') || url.searchParams.has('sb') || url.searchParams.has('singbox')) {
      订阅格式 = 'singbox';
      追加UA = 'singbox';
    } else if (userAgent.includes('surge') || url.searchParams.has('surge')) {
      订阅格式 = 'surge';
      追加UA = 'surge';
    } else if (userAgent.includes('quantumult') || url.searchParams.has('quanx')) {
      订阅格式 = 'quanx';
      追加UA = 'Quantumult%20X';
    } else if (userAgent.includes('loon') || url.searchParams.has('loon')) {
      订阅格式 = 'loon';
      追加UA = 'Loon';
    } else if (userAgent.includes('clash') || userAgent.includes('meta') || userAgent.includes('mihomo') || url.searchParams.has('clash')) {
      订阅格式 = 'clash';
      追加UA = 'clash';
    }
  }
  if (url.searchParams.has('b64') || url.searchParams.has('base64')) 订阅格式 = 'base64';

  // 去重
  const lines = req_data.split('\n').filter(l => l.trim());
  const result = [...new Set(lines)].join('\n');

  // Base64 编码
  let base64Data;
  try {
    base64Data = btoa(result);
  } catch {
    base64Data = encodeBase64(result);
  }

  // 响应头
  const responseHeaders = {
    'content-type': 'text/plain; charset=utf-8',
    'Profile-Update-Interval': `${SUBUpdateTime}`,
    'Profile-web-page-url': url.href.split('?')[0],
  };
  if (!userAgent.includes('mozilla')) {
    responseHeaders['Content-Disposition'] = `attachment; filename*=utf-8''${encodeURIComponent(FileName)}`;
  }

  // 原始 base64 返回
  if (订阅格式 === 'base64') {
    return new Response(base64Data, { headers: responseHeaders });
  }

  // 构造订阅转换 URL
  const target = 订阅格式 === 'singbox' ? 'singbox' :
                订阅格式 === 'surge' ? 'surge&ver=4' :
                订阅格式 === 'quanx' ? 'quanx&udp=true' :
                订阅格式 === 'loon' ? 'loon' : 'clash';

  const subConverterUrl = `${subProtocol}://${subConverterHost}/sub?target=${target}&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(configFile)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;

  try {
    const response = await fetch(subConverterUrl);
    if (!response.ok) return new Response(base64Data, { headers: responseHeaders });
    let content = await response.text();
    if (订阅格式 === 'clash') content = clashFix(content);
    return new Response(content, { headers: responseHeaders });
  } catch {
    return new Response(base64Data, { headers: responseHeaders });
  }
}

// ===== Base64 编码辅助函数 =====
function encodeBase64(data) {
  const binary = new TextEncoder().encode(data);
  let base64 = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < binary.length; i += 3) {
    const byte1 = binary[i];
    const byte2 = binary[i + 1] || 0;
    const byte3 = binary[i + 2] || 0;
    base64 += chars[byte1 >> 2];
    base64 += chars[((byte1 & 3) << 4) | (byte2 >> 4)];
    base64 += chars[((byte2 & 15) << 2) | (byte3 >> 6)];
    base64 += chars[byte3 & 63];
  }
  const padding = 3 - (binary.length % 3 || 3);
  return base64.slice(0, base64.length - padding) + '=='.slice(0, padding);
}

// ===== Clash 配置修复辅助函数 =====
function clashFix(content) {
  if (content.includes('wireguard') && !content.includes('remote-dns-resolve')) {
    const lines = content.split(/\r?\n/);
    let result = '';
    for (const line of lines) {
      if (line.includes('type: wireguard')) {
        result += line.replace(/, mtu: 1280, udp: true/g, ', mtu: 1280, remote-dns-resolve: true, udp: true') + '\n';
      } else {
        result += line + '\n';
      }
    }
    return result.trim();
  }
  return content;
}