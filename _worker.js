// ===== 配置区 =====
const CONFIG = {
  SUB_API: '',	//转换后端
  SUB_CONFIG: '',	//转换配置
  FILE_NAME: 'CF-Workers-SUB',
  UPDATE_INTERVAL: 6,

  UUID: '',	//vless uuid
  MIMA: '',	//trojan密码
  HOST_V: '',	//vless host
  HOST_T: '',	//trojan host
  VLESS_PREFIX: '/snippets/ip=',	//vless path前缀(白嫖哥)
  TROJAN_PREFIX: '/proxyip=',	//trojan path前缀(CM)

  UNI_COUNT: 5,	//API_UNI各name取量, 0禁用, all全取
  DIFF_COUNT: 5,	//API_DIFF~同上

  API_UNI: '',	//反代同优选 API
  API_DIFF: '',	//反代取自fdip API

  IPS: [	//固定优选
    'cf.qmqm.cf:443#官方',
    'mfa.gov.ua:443#官方',
    'cm.cf.090227.xyz:443#官方',
    'download.yunzhongzhuan.com:443#官方',
    'www.shopify.com:443#官方',
  ],

  FDIP: [	//固定反代
    'us.proxyip.com:443#US',
  ],

  KV_FDIP_KEY: 'FDIP_LIST',	//KV源反代
};

// ===== 工具函数 =====
const log = (...a) => console.log('[LOG]', ...a);
const err = (...a) => console.error('[ERR]', ...a);

const parseLine = (line) => {
  if (!line?.includes(':')) return null;
  const [addr, name = ''] = line.split('#');
  const [ip, port] = addr.split(':');
  const portNum = parseInt(port, 10);
  if (!ip || isNaN(portNum) || portNum < 1 || portNum > 65535) return null;
  return { ip, port: String(portNum), name: name.trim() };
};

const fetchLines = async (url) => {
  if (!url?.trim()) return [];
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    return r.text().then(t => t.split('\n').map(parseLine).filter(Boolean));
  } catch (e) {
    err(`Fetch失败: ${url}`, e);
    return [];
  }
};

const fetchKvList = async (env, key) => {
  if (!env?.KV) return [];
  try {
    const v = await env.KV.get(key);
    return v ? v.split('\n').map(line => ({ line, ...parseLine(line) })).filter(x => x.ip) : [];
  } catch (e) {
    err(`KV读取失败: ${key}`, e);
    return [];
  }
};

const randomSampleByName = (list, count) => {
  if (count === 'all') return list;
  if (!count || count <= 0) return [];
  const grouped = list.reduce((acc, x) => {
    const key = x.name || 'unknown';
    acc[key] = acc[key] || [];
    acc[key].push(x);
    return acc;
  }, {});
  return Object.values(grouped).flatMap(group =>
    group.length <= count
      ? group
      : group.sort(() => 0.5 - Math.random()).slice(0, count)
  );
};

const selectFdip = (name, fdips) => {
  if (!fdips.length) return [null, null];
  const matches = fdips.filter(f => name.toLowerCase().includes(f.line.split('#')[1]?.trim().toLowerCase() || ''));
  const pick = (matches.length ? matches : fdips)[Math.floor(Math.random() * (matches.length || fdips.length))];
  return [pick.ip, pick.port];
};

const buildPath = (isTrojan, ip, port, vlessPrefix, trojanPrefix) =>
  encodeURIComponent(`${isTrojan ? trojanPrefix : vlessPrefix}${ip}:${port}`);

const generateNode = (tpl, ip, port, name, pathIp, pathPort, vp, tp) => {
  const isTrojan = tpl.includes('trojan://');
  const encodedName = encodeURIComponent(name || ip);
  const path = buildPath(isTrojan, pathIp, pathPort, vp, tp);
  return tpl
    .replaceAll('[ip]', ip)
    .replaceAll('[port]', port)
    .replaceAll('[path]', path)
    .replaceAll('[name]', encodedName);
};

const processNodes = (lines, tpl, opt) => {
  if (!lines?.length) return [];
  return lines.map(({ ip, port, name }) => {
    let [pathIp, pathPort] = [ip, port];
    if (opt.useForced) [pathIp, pathPort] = [opt.fdipIp, opt.fdipPort];
    else if (opt.useAll || !opt.isUni) {
      const [fdipIp, fdipPort] = selectFdip(name, opt.validFDIP);
      if (fdipIp) [pathIp, pathPort] = [fdipIp, fdipPort];
    }
    return generateNode(tpl, ip, port, name, pathIp, pathPort, opt.vp, opt.tp);
  });
};

// ===== Worker 主体 =====
export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      const sp = url.searchParams;

      const useTrojan = sp.get('trojan') === '1';
      const dyn = {
        uuid: sp.get('uuid') || CONFIG.UUID,
        mima: sp.get('mima') || CONFIG.MIMA,
        hostV: sp.get('hostV') || CONFIG.HOST_V,
        hostT: sp.get('hostT') || CONFIG.HOST_T,
        vp: sp.get('vlessPrefix') || CONFIG.VLESS_PREFIX,
        tp: sp.get('trojanPrefix') || CONFIG.TROJAN_PREFIX,
      };

      const parseCount = (k, d) => {
        const v = sp.get(k);
        if (!v) return d;
        if (v === '0') return 0;
        if (v.toLowerCase() === 'all') return 'all';
        const n = parseInt(v, 10);
        return isNaN(n) ? d : n;
      };
      const uniCount = parseCount('uni_count', CONFIG.UNI_COUNT);
      const diffCount = parseCount('diff_count', CONFIG.DIFF_COUNT);

      const tpl = useTrojan
        ? `trojan://${dyn.mima}@[ip]:[port]?security=tls&sni=${dyn.hostT}&fp=chrome&type=ws&host=${dyn.hostT}&path=[path]#[name]`
        : `vless://${dyn.uuid}@[ip]:[port]?path=[path]&security=tls&alpn=h3&encryption=none&host=${dyn.hostV}&fp=random&type=ws&sni=${dyn.hostV}#[name]`;

      // FDIP 解析
      const fdipParam = sp.get('fdip');
      let opt = { vp: dyn.vp, tp: dyn.tp, validFDIP: [], isUni: false, useForced: false, useAll: false };
      if (fdipParam === 'all') opt.useAll = true;
      else if (fdipParam?.includes(':')) {
        const [ip, port] = fdipParam.split(':');
        const portNum = parseInt(port, 10);
        if (ip && !isNaN(portNum)) {
          opt.fdipIp = ip;
          opt.fdipPort = String(portNum);
          opt.useForced = true;
        }
      }

      const constFDIP = CONFIG.FDIP.map(l => ({ line: l, ...parseLine(l) })).filter(x => x.ip);
      const kvFDIP = await fetchKvList(env, CONFIG.KV_FDIP_KEY);
      opt.validFDIP = [...constFDIP, ...kvFDIP];

      // 数据源
      const uniLines = uniCount !== 0 ? await fetchLines(CONFIG.API_UNI) : [];
      const diffLines = diffCount !== 0 ? await fetchLines(CONFIG.API_DIFF) : [];
      const ipsLines = CONFIG.IPS.map(parseLine).filter(Boolean);

      const uniNodes = processNodes(randomSampleByName(uniLines, uniCount), tpl, { ...opt, isUni: true });
      const diffNodes = processNodes(randomSampleByName(diffLines, diffCount), tpl, opt);
      const ipsNodes = processNodes(ipsLines, tpl, opt);

      const allNodes = [...uniNodes, ...ipsNodes, ...diffNodes];
      if (!allNodes.length) return new Response('无可用节点', { status: 404 });

      if ((ipsNodes.length || diffNodes.length || (opt.useAll && uniNodes.length)) &&
          !opt.useForced && !opt.validFDIP.length) {
        return new Response('FDIP 无效或为空', { status: 500 });
      }

      return handleSubscription(req, allNodes.join('\n'), req.url, env);
    } catch (e) {
      err('运行错误', e);
      return new Response('运行错误: ' + (e?.message || String(e)), { status: 500 });
    }
  },
};

// ===== 订阅转换 =====
async function handleSubscription(req, data, subUrl, env) {
  const ua = (req.headers.get('User-Agent') || '').toLowerCase();
  const url = new URL(req.url);
  const converter = env?.SUBAPI || CONFIG.SUB_API;
  const cfg = env?.SUBCONFIG || CONFIG.SUB_CONFIG;
  const proto = converter.startsWith('http://') ? 'http' : 'https';
  const host = converter.replace(/^https?:\/\//, '');

  const detectFmt = () => {
    if (url.searchParams.has('b64') || url.searchParams.has('base64')) return 'base64';
    if (/sing(-?box)?/.test(ua) || url.searchParams.has('singbox')) return 'singbox';
    if (/surge/.test(ua) || url.searchParams.has('surge')) return 'surge';
    if (/quantumult/.test(ua) || url.searchParams.has('quanx')) return 'quanx';
    if (/loon/.test(ua) || url.searchParams.has('loon')) return 'loon';
    if (/clash|meta|mihomo/.test(ua) || url.searchParams.has('clash')) return 'clash';
    return 'base64';
  };
  const fmt = detectFmt();

  const uniqLines = [...new Set(data.split('\n').filter(Boolean))].join('\n');
  const base64 = encodeBase64(uniqLines);

  const headers = {
    'content-type': 'text/plain; charset=utf-8',
    'Profile-Update-Interval': String(CONFIG.UPDATE_INTERVAL),
    'Profile-web-page-url': url.origin + url.pathname,
  };
  if (!ua.includes('mozilla')) headers['Content-Disposition'] = `attachment; filename*=utf-8''${encodeURIComponent(CONFIG.FILE_NAME)}`;

  if (fmt === 'base64') return new Response(base64, { headers });

  const targetMap = { singbox: 'singbox', surge: 'surge&ver=4', quanx: 'quanx&udp=true', loon: 'loon', clash: 'clash' };
  const target = targetMap[fmt] || 'clash';
  const subUrlFull = `${proto}://${host}/sub?target=${target}&url=${encodeURIComponent(subUrl)}&insert=false&config=${encodeURIComponent(cfg)}&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;

  try {
    const r = await fetch(subUrlFull);
    if (!r.ok) return new Response(base64, { headers });
    let c = await r.text();
    if (fmt === 'clash') c = clashFix(c);
    return new Response(c, { headers });
  } catch {
    return new Response(base64, { headers });
  }
}

// ===== Base64 与 Clash 修复 =====
function encodeBase64(str) {
  try {
    return btoa(str);
  } catch {
    const b = new TextEncoder().encode(str);
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    for (let i = 0; i < b.length; i += 3) {
      const [a, d = 0, e = 0] = [b[i], b[i + 1], b[i + 2]];
      out += c[a >> 2] + c[((a & 3) << 4) | (d >> 4)] + c[((d & 15) << 2) | (e >> 6)] + c[e & 63];
    }
    const pad = 3 - (b.length % 3 || 3);
    return out.slice(0, out.length - pad) + '=='.slice(0, pad);
  }
}

function clashFix(content) {
  if (!content.includes('wireguard')) return content;
  return content
    .split(/\r?\n/)
    .map(line => line.includes('type: wireguard')
      ? line.replace(/, mtu: 1280, udp: true/, ', mtu: 1280, remote-dns-resolve: true, udp: true')
      : line)
    .join('\n')
    .trim();
}