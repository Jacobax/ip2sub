// ===== 配置变量 =====
const subConverter = 'SUBAPI.cmliussss.net'; // 订阅转换后端
const subConfig = 'https://raw.githubusercontent.com/Jacobax/workers-pages/refs/heads/main/uni.ini'; // 订阅配置文件
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

// ===== 辅助函数：解析 line (ip:port#name) =====
function parseLine(line) {
  if (!line || !line.includes(':')) return null;
  const [addr, rawName = ''] = line.split('#');
  const [ip, portStr] = addr.split(':');
  const port = parseInt(portStr, 10);
  if (!ip || isNaN(port) || port < 1 || port > 65535) return null;
  return { ip, port: port.toString(), name: rawName.trim() };
}

// ===== 辅助函数：生成path =====
function generatePath(useTrojan, pathIp, pathPort) {
  const prefix = useTrojan ? '/proxyip=' : '/snippets/ip=';	//分别为trojan、vless的path路径前缀，path=[前缀][ip:port]
  const rawPath = `${prefix}${pathIp}:${pathPort}`;
  return encodeURIComponent(rawPath);
}

// ===== 辅助函数：选择FDIP（匹配name或随机） =====
function selectFdip(name, validFDIP) {
  // 按 name 匹配 FDIP（优先匹配，多个取第一个；无匹配则随机）
  let selectedFdip = null;
  for (const fdip of validFDIP) {
    const [_, fdipName] = fdip.line.split('#');
    if (name.includes(fdipName.trim())) {
      selectedFdip = fdip;
      break;
    }
  }
  if (!selectedFdip) {
    selectedFdip = validFDIP[Math.floor(Math.random() * validFDIP.length)];
  }
  return [selectedFdip.ip, selectedFdip.port];
}

// ===== 辅助函数：拉取API lines =====
async function fetchApiLines(apiUrl) {
  if (!apiUrl || apiUrl.trim() === '') return [];
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.error(`${apiUrl} 拉取失败`);
      return [];
    }
    const text = await res.text();
    return text.split('\n')
      .map(parseLine)
      .filter(Boolean);
  } catch (e) {
    console.error(`${apiUrl} 拉取异常:`, e);
    return [];
  }
}

// ===== 辅助函数：生成单个节点 =====
function generateNode(template, ip, port, rawName, pathIp, pathPort) {
  const name = rawName ? rawName.trim() : ip;
  const nameEnc = encodeURIComponent(name);
  const useTrojan = template.includes('trojan://');
  const pathParam = generatePath(useTrojan, pathIp, pathPort);
  return template
    .replaceAll('[ip]', ip)
    .replaceAll('[port]', port)
    .replaceAll('[path]', pathParam)
    .replaceAll('[name]', nameEnc);
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
        const [ip, portStr] = forcedFdip.trim().split(':');
        const port = parseInt(portStr, 10);
        if (ip && !isNaN(port) && port >= 1 && port <= 65535) {
          forcedIpFdip = ip;
          forcedPortFdip = port.toString();
          useForcedFdip = true;
        }
      }

      // 解析并验证FDIP
      const validFDIP = FDIP.map(line => ({ line, ...parseLine(line) })).filter(item => item.ip);

      // 处理UNI API 节点
      const uniLines = await fetchApiLines(apiUni);
      const apiNodes = uniLines.map(({ ip, port, name: rawName }) => {
        let pathIp = ip;
        let pathPort = port;
        if (useForcedFdip) {
          pathIp = forcedIpFdip;
          pathPort = forcedPortFdip;
        }
        return generateNode(template, ip, port, rawName, pathIp, pathPort);
      });

      // 处理 IPS 节点（统一逻辑：匹配/随机FDIP）
      const ipsNodes = IPS
        .map(parseLine)
        .filter(Boolean)
        .map(({ ip, port, name: rawName }) => {
          let pathIp, pathPort;
          if (useForcedFdip) {
            pathIp = forcedIpFdip;
            pathPort = forcedPortFdip;
          } else {
            const [fdipIp, fdipPort] = selectFdip(rawName, validFDIP);
            pathIp = fdipIp;
            pathPort = fdipPort;
          }
          return generateNode(template, ip, port, rawName, pathIp, pathPort);
        });

      // 拉取并处理DIFF API 节点（统一逻辑：匹配/随机FDIP）
      const diffLines = await fetchApiLines(apiDiff);
      const newNodes = diffLines.map(({ ip, port, name: rawName }) => {
        let pathIp, pathPort;
        if (useForcedFdip) {
          pathIp = forcedIpFdip;
          pathPort = forcedPortFdip;
        } else {
          const [fdipIp, fdipPort] = selectFdip(rawName, validFDIP);
          pathIp = fdipIp;
          pathPort = fdipPort;
        }
        return generateNode(template, ip, port, rawName, pathIp, pathPort);
      });

      // 检查来源：至少一个不为空
      const totalNodes = apiNodes.length + ipsNodes.length + newNodes.length;
      if (totalNodes === 0) {
        return new Response('暂无可用节点，请检查API/IPS配置', { status: 404 });
      }

      // 检查FDIP：当IPS或DIFF API不为空且未使用强制FDIP时，必须FDIP不为空
      const hasFdipDependent = (ipsNodes.length > 0 || newNodes.length > 0);
      if (hasFdipDependent && !useForcedFdip && validFDIP.length === 0) {
        return new Response('配置错误：FDIP格式无效或为空', { status: 500 });
      }

      // 合并所有节点
      let nodes = [...apiNodes, ...ipsNodes, ...newNodes].join('\n');

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
  let subscriptionFormat = 'base64';
  if (!(userAgent.includes('null') || userAgent.includes('subconverter') || userAgent.includes('nekobox') || userAgent.includes('cf-workers-sub'))) {
    if (userAgent.includes('sing-box') || userAgent.includes('singbox') || url.searchParams.has('sb') || url.searchParams.has('singbox')) {
      subscriptionFormat = 'singbox';
    } else if (userAgent.includes('surge') || url.searchParams.has('surge')) {
      subscriptionFormat = 'surge';
    } else if (userAgent.includes('quantumult') || url.searchParams.has('quanx')) {
      subscriptionFormat = 'quanx';
    } else if (userAgent.includes('loon') || url.searchParams.has('loon')) {
      subscriptionFormat = 'loon';
    } else if (userAgent.includes('clash') || userAgent.includes('meta') || userAgent.includes('mihomo') || url.searchParams.has('clash')) {
      subscriptionFormat = 'clash';
    }
  }
  if (url.searchParams.has('b64') || url.searchParams.has('base64')) subscriptionFormat = 'base64';

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
  if (subscriptionFormat === 'base64') {
    return new Response(base64Data, { headers: responseHeaders });
  }

  // 构造订阅转换 URL
  const target = subscriptionFormat === 'singbox' ? 'singbox' :
                subscriptionFormat === 'surge' ? 'surge&ver=4' :
                subscriptionFormat === 'quanx' ? 'quanx&udp=true' :
                subscriptionFormat === 'loon' ? 'loon' : 'clash';

  const subConverterUrl = `${subProtocol}://${subConverterHost}/sub?target=${target}&url=${encodeURIComponent(订阅转换URL)}&insert=false&config=${encodeURIComponent(configFile)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;

  try {
    const response = await fetch(subConverterUrl);
    if (!response.ok) return new Response(base64Data, { headers: responseHeaders });
    let content = await response.text();
    if (subscriptionFormat === 'clash') content = clashFix(content);
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