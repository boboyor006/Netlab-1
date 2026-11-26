
export const IOS_TYPES = ['router', 'switch', 'l3switch'];
export const HOST_TYPES = ['pc', 'laptop', 'server', 'phone', 'printer'];
export const isSwitch = (t) => t === 'switch' || t === 'l3switch';

export const ipToInt = (s) => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s));
  if (!m || m.slice(1).some((x) => +x > 255)) return null;
  return m.slice(1).reduce((a, x) => a * 256 + +x, 0);
};
export const isMask = (s) => {
  const n = ipToInt(s);
  if (n === null) return false;
  const inv = ~n >>> 0;
  return (inv & (inv + 1)) === 0;
};
export const network = (ip, mask) => (ipToInt(ip) & ipToInt(mask)) >>> 0;
export const intToIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
export const sameNet = (a, b, mask) => network(a, mask) === network(b, mask);
export const prefixLen = (mask) => ipToInt(mask).toString(2).split('1').length - 1;

export function checkHostAddress(ip, mask) {
  const n = ipToInt(ip);
  if (n === null) return 'IP manzil noto‘g‘ri';
  if (!isMask(mask) || mask === '0.0.0.0') return 'Subnet mask noto‘g‘ri';
  const first = n >>> 24;
  if (first === 0 || first === 127 || first >= 224) return 'Bu IP manzilni qurilmaga berib bo‘lmaydi';
  const len = prefixLen(mask), host = (n & ~ipToInt(mask)) >>> 0;
  if (len < 31 && (host === 0 || host === (~ipToInt(mask) >>> 0))) return 'Bu tarmoq yoki broadcast manzili';
  return null;
}

export const defaultConfig = () => ({ ifaces: {}, vlans: {}, routes: [], gateway: '', ipRouting: false,
  secret: '', enablePassword: '', encrypt: false, banner: '', con: { password: '', login: false }, vty: { password: '', login: true } });
export const getConfig = (d) => ({ ...defaultConfig(), ...d.config });
export const getIface = (d, name) => getConfig(d).ifaces[name] ?? {};
// Vlan1 interfeysi boshlang‘ich holatda o‘chiq
export const sviShutdown = (d, name) => getIface(d, name).shutdown ?? name === 'Vlan1';

// Import qilingan sozlamalarni tozalash
export function cleanConfig(raw) {
  const out = defaultConfig();
  if (!raw || typeof raw !== 'object') return out;
  const vlan = (v) => Number.isInteger(v) && v >= 1 && v <= 4094;
  for (const [name, i] of Object.entries(raw.ifaces ?? {})) {
    if (!/^(Gi|Fa|Se|Eth|Vlan)[\d/.]+$/.test(name) || !i) continue;
    const c = {};
    if (!checkHostAddress(i.ip, i.mask)) { c.ip = i.ip; c.mask = i.mask; }
    if (i.mode === 'access' || i.mode === 'trunk') c.mode = i.mode;
    if (vlan(i.accessVlan)) c.accessVlan = i.accessVlan;
    if (Array.isArray(i.allowed)) c.allowed = i.allowed.filter(vlan);
    if (vlan(i.encap)) c.encap = i.encap;
    if (typeof i.shutdown === 'boolean') c.shutdown = i.shutdown;
    if (typeof i.description === 'string') c.description = i.description;
    out.ifaces[name] = c;
  }
  for (const [id, n] of Object.entries(raw.vlans ?? {})) if (vlan(+id) && typeof n === 'string') out.vlans[id] = n;
  out.routes = (Array.isArray(raw.routes) ? raw.routes : []).filter((r) => r && ipToInt(r.net) !== null && isMask(r.mask) && ipToInt(r.via) !== null)
    .map(({ net, mask, via }) => ({ net, mask, via }));
  if (ipToInt(raw.gateway) !== null) out.gateway = raw.gateway;
  out.ipRouting = raw.ipRouting === true;
  for (const k of ['secret', 'enablePassword', 'banner']) if (typeof raw[k] === 'string') out[k] = raw[k];
  out.encrypt = raw.encrypt === true;
  for (const k of ['con', 'vty']) {
    if (typeof raw[k]?.password === 'string') out[k].password = raw[k].password;
    if (typeof raw[k]?.login === 'boolean') out[k].login = raw[k].login;
  }
  return out;
}
