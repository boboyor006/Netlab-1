// IOS uslubidagi CLI va kompyuter buyruq oynasi. run() sof funksiya.
import { DEVICE_TYPES } from './devices.js';
import { updateDevice, renameDevice, portLink } from './topology.js';
import { getConfig, getIface, sviShutdown, isSwitch, checkHostAddress, ipToInt, isMask, intToIp, network, prefixLen } from './config.js';
import { ping, portUp, l3Interfaces } from './network.js';

export const newSession = (type) => ({ mode: ['router', 'switch', 'l3switch'].includes(type) ? 'user' : 'host', ifs: [], vlan: null });

// Terminal ochilganda: banner va kerak bo‘lsa konsol paroli
export function openSession(d) {
  const session = newSession(d.type);
  if (session.mode === 'host') return { session, output: '' };
  const c = getConfig(d);
  if (c.con.login && c.con.password) session.ask = { kind: 'console', tries: 0 };
  return { session, output: [c.banner, session.ask ? 'User Access Verification' : ''].filter(Boolean).join('\n') };
}

const SUFFIX = { user: '>', priv: '#', config: '(config)#', if: '(config-if)#', vlan: '(config-vlan)#', line: '(config-line)#' };
export function prompt(d, s) {
  if (s.ask) return 'Password: ';
  if (s.mode === 'host') return 'C:\\>';
  const sfx = s.mode === 'if' && s.ifs[0]?.includes('.') ? '(config-subif)#' : s.mode === 'if' && s.ifs.length > 1 ? '(config-if-range)#' : SUFFIX[s.mode];
  return d.name + sfx;
}

class CliError extends Error {}
const fail = (m = '% Invalid input detected.') => { throw new CliError(m); };

/* ---------- buyruqlar jadvali ---------- */
// <x> = bitta argument, <...> = qolgan hamma so‘z
const C = [];
const cmd = (modes, pattern, help, fn, only) => C.push({ modes: modes.split(' '), words: pattern.split(' '), help, fn, only });
const SW = (d) => isSwitch(d.type), RT = (d) => d.type === 'router' || d.type === 'l3switch', L3 = (d) => d.type === 'l3switch';

const setCfg = (ctx, fn) => {
  const d = ctx.dev();
  const c = structuredClone(getConfig(d));
  fn(c);
  ctx.topo = updateDevice(ctx.topo, d.id, { config: c });
};
const eachIf = (ctx, fn) => setCfg(ctx, (c) => ctx.s.ifs.forEach((n) => { c.ifaces[n] ??= {}; fn(c.ifaces[n], n, c); }));
const vlanNum = (x) => (/^\d+$/.test(x) && +x >= 1 && +x <= 4094 ? +x : fail('% VLAN raqami 1-4094 oralig‘ida bo‘lishi kerak'));
const vlanList = (x) => {
  const out = new Set();
  for (const part of x.split(',')) {
    const [a, b = a] = part.split('-').map(vlanNum);
    if (b < a) fail();
    for (let i = a; i <= b; i++) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
};
const switchports = (ctx) => ctx.s.ifs.forEach((n) => { if (!SW(ctx.dev()) || n.startsWith('Vlan')) fail('% Bu buyruq faqat switch portida ishlaydi'); });

const KINDS = { gigabitethernet: 'Gi', fastethernet: 'Fa', serial: 'Se', vlan: 'Vlan' };
export function parseIface(d, text) {
  const m = /^([a-z]+)\s*([\d/]+)(\.\d+)?$/i.exec(text.trim());
  if (!m) fail('% Interfeys nomi noto‘g‘ri');
  const keys = Object.keys(KINDS).filter((k) => k.startsWith(m[1].toLowerCase()));
  if (keys.length !== 1) fail('% Interfeys turi noto‘g‘ri');
  const base = KINDS[keys[0]] + m[2];
  if (base.startsWith('Vlan')) { if (!SW(d) || m[3]) fail(); return `Vlan${vlanNum(m[2])}`; }
  if (!DEVICE_TYPES[d.type].ports.some((p) => p.id === base)) fail(`% ${base} interfeysi bu qurilmada yo‘q`);
  if (m[3] && (d.type !== 'router' || base.startsWith('Se'))) fail('% Sub-interfeys faqat router Ethernet portida bo‘ladi');
  return base + (m[3] ?? '');
}

const longName = (n) => n.replace(/^Gi/, 'GigabitEthernet').replace(/^Fa/, 'FastEthernet').replace(/^Se/, 'Serial');
const ifNames = (d) => {
  const ports = DEVICE_TYPES[d.type].ports.map((p) => p.id);
  const extra = Object.keys(getConfig(d).ifaces).filter((n) => !ports.includes(n));
  if (isSwitch(d.type) && !extra.includes('Vlan1')) extra.push('Vlan1');
  return [...ports, ...extra.sort()];
};
const adminDown = (d, n) => n.startsWith('Vlan') ? sviShutdown(d, n) : d.disabled.includes(n.split('.')[0]) || !!getIface(d, n).shutdown;
const pad = (s, n) => String(s).padEnd(n);

function runningConfig(d) {
  const c = getConfig(d), out = ['!'];
  const hidden = c.encrypt ? '7 ********' : null;
  if (c.encrypt) out.push('service password-encryption', '!');
  out.push(`hostname ${d.name}`, '!');
  if (c.secret) out.push('enable secret 5 ********');
  if (c.enablePassword) out.push(`enable password ${hidden ?? c.enablePassword}`);
  if (c.ipRouting) out.push('ip routing', '!');
  for (const [id, name] of Object.entries(c.vlans)) out.push(`vlan ${id}`, ` name ${name}`, '!');
  for (const n of ifNames(d)) {
    const i = getIface(d, n);
    out.push(`interface ${longName(n)}`);
    if (i.description) out.push(` description ${i.description}`);
    if (i.encap) out.push(` encapsulation dot1Q ${i.encap}`);
    if (i.accessVlan) out.push(` switchport access vlan ${i.accessVlan}`);
    if (i.allowed) out.push(` switchport trunk allowed vlan ${i.allowed.join(',') || 'none'}`);
    if (i.mode) out.push(` switchport mode ${i.mode}`);
    if (i.ip) out.push(` ip address ${i.ip} ${i.mask}`);
    else if (d.type === 'router') out.push(' no ip address');
    if (adminDown(d, n)) out.push(' shutdown');
    out.push('!');
  }
  if (c.gateway) out.push(`ip default-gateway ${c.gateway}`);
  c.routes.forEach((r) => out.push(`ip route ${r.net} ${r.mask} ${r.via}`));
  if (c.banner) out.push(`banner motd #${c.banner}#`);
  out.push('!');
  for (const [key, title] of [['con', 'line con 0'], ['vty', 'line vty 0 4']]) {
    out.push(title);
    if (c[key].password) out.push(` password ${hidden ?? c[key].password}`);
    out.push(c[key].login ? ' login' : ' no login');
  }
  out.push('!', 'end');
  return out.join('\n');
}

function ipBrief(ctx) {
  const d = ctx.dev(), l3 = l3Interfaces(ctx.topo, d);
  const rows = ifNames(d).map((n) => {
    const i = getIface(d, n);
    const link = n.startsWith('Vlan') || n.includes('.') ? !!l3.find((x) => x.name === n)?.up : portUp(ctx.topo, d, n);
    const status = adminDown(d, n) ? 'administratively down' : link ? 'up' : 'down';
    return pad(longName(n), 24) + pad(i.ip ?? 'unassigned', 17) + pad(status, 23) + (status === 'up' ? 'up' : 'down');
  });
  return [pad('Interface', 24) + pad('IP-Address', 17) + pad('Status', 23) + 'Protocol', ...rows].join('\n');
}

function vlanBrief(d) {
  const all = { 1: 'default', ...getConfig(d).vlans };
  return [pad('VLAN', 6) + pad('Name', 20) + 'Ports', ...Object.entries(all).map(([id, name]) => {
    const ports = DEVICE_TYPES[d.type].ports.filter((p) => { const i = getIface(d, p.id); return i.mode !== 'trunk' && (i.accessVlan ?? 1) === +id; }).map((p) => p.id);
    const lines = [];
    for (let i = 0; i < ports.length; i += 6) lines.push(ports.slice(i, i + 6).join(', '));
    return pad(id, 6) + pad(name, 20) + lines.join('\n' + ' '.repeat(26));
  })].join('\n');
}

const trunks = (d) => [pad('Port', 10) + pad('Mode', 8) + pad('Native', 8) + 'Allowed VLANs',
  ...DEVICE_TYPES[d.type].ports.filter((p) => getIface(d, p.id).mode === 'trunk')
    .map((p) => pad(p.id, 10) + pad('on', 8) + pad(1, 8) + (getIface(d, p.id).allowed?.join(',') ?? '1-4094'))].join('\n');

const portStatus = (ctx) => {
  const d = ctx.dev();
  return [pad('Port', 10) + pad('Status', 14) + 'Vlan', ...DEVICE_TYPES[d.type].ports.map((p) => {
    const i = getIface(d, p.id);
    const st = d.disabled.includes(p.id) ? 'disabled' : portLink(ctx.topo, d.id, p.id) && portUp(ctx.topo, d, p.id) ? 'connected' : 'notconnect';
    return pad(p.id, 10) + pad(st, 14) + (i.mode === 'trunk' ? 'trunk' : i.accessVlan ?? 1);
  })].join('\n');
};

function routeTable(ctx) {
  const d = ctx.dev(), ifs = l3Interfaces(ctx.topo, d).filter((i) => i.up);
  const rows = ifs.map((i) => `C    ${intToIp(network(i.ip, i.mask))}/${prefixLen(i.mask)} is directly connected, ${longName(i.name)}`);
  getConfig(d).routes.filter((r) => ifs.some((i) => network(r.via, i.mask) === network(i.ip, i.mask)))
    .forEach((r) => rows.push(`${r.mask === '0.0.0.0' ? 'S*' : 'S '}   ${r.net}/${prefixLen(r.mask)} [1/0] via ${r.via}`));
  return ['Codes: C - connected, S - static', '', ...(rows.length ? rows : ['(marshrut yo‘q)'])].join('\n');
}

const iosPing = (ctx, ip) => {
  if (ipToInt(ip) === null) fail('% IP manzil noto‘g‘ri');
  const r = ping(ctx.topo, ctx.id, ip);
  ctx.print(`Sending 5, 100-byte ICMP Echos to ${ip}:\n${r.ok ? '!!!!!' : '.....'}\nSuccess rate is ${r.ok ? '100 percent (5/5)' : '0 percent (0/5)'}`);
};

const go = (mode) => (ctx) => { ctx.s = { ...ctx.s, mode, ifs: [], vlan: null, line: null }; };
const enable = (ctx) => {
  const c = getConfig(ctx.dev());
  if (c.secret || c.enablePassword) ctx.s = { ...ctx.s, ask: { kind: 'enable', tries: 0 } };
  else if (ctx.s.remote) fail('% No password set');
  else go('priv')(ctx);
};
const logout = (ctx) => {
  if (ctx.s.remote) { ctx.s = ctx.s.remote.back; return ctx.print('[Connection closed by foreign host]'); }
  const o = openSession(ctx.dev()); ctx.s = o.session; if (o.output) ctx.print(o.output);
};

function telnet(ctx, ip) {
  if (ipToInt(ip) === null) fail('% IP manzil noto‘g‘ri');
  if (ctx.s.remote) fail('% Ochiq telnet seansidan avval "exit" bilan chiqing');
  const target = ctx.topo.devices.find((x) => x.id !== ctx.id && l3Interfaces(ctx.topo, x).some((i) => i.up && i.ip === ip));
  if (!target || !['router', 'switch', 'l3switch'].includes(target.type) || !ping(ctx.topo, ctx.id, ip).ok) fail(`Trying ${ip} ...\n% Connection timed out; remote host not responding`);
  const c = getConfig(target);
  if (c.vty.login && !c.vty.password) fail(`Trying ${ip} ...Open\n\nPassword required, but none set\n[Connection closed by foreign host]`);
  ctx.print([`Trying ${ip} ...Open`, c.banner].filter(Boolean).join('\n'));
  ctx.s = { mode: 'user', ifs: [], vlan: null, remote: { id: target.id, from: ctx.id, ip, back: ctx.s }, ask: c.vty.login ? { kind: 'vty', tries: 0 } : null };
}

cmd('user', 'enable', 'Privileged rejimga o‘tish', enable);
cmd('user priv', 'telnet <ip>', 'Boshqa qurilmaga ulanish', (ctx, [ip]) => telnet(ctx, ip));
cmd('priv', 'disable', 'User rejimiga qaytish', go('user'));
cmd('priv', 'configure terminal', 'Sozlash rejimi', (ctx) => { go('config')(ctx); ctx.print('Enter configuration commands, one per line.  End with CNTL/Z.'); });
cmd('user priv', 'ping <ip>', 'Ulanishni tekshirish', (ctx, [ip]) => iosPing(ctx, ip));
cmd('user priv', 'show ip interface brief', 'Interfeyslar qisqacha', (ctx) => ctx.print(ipBrief(ctx)));
cmd('user priv', 'show ip route', 'Marshrut jadvali', (ctx) => ctx.print(routeTable(ctx)), RT);
cmd('user priv', 'show vlan brief', 'VLAN ro‘yxati', (ctx) => ctx.print(vlanBrief(ctx.dev())), SW);
cmd('user priv', 'show interfaces trunk', 'Trunk portlar', (ctx) => ctx.print(trunks(ctx.dev())), SW);
cmd('user priv', 'show interfaces status', 'Port holatlari', (ctx) => ctx.print(portStatus(ctx)), SW);
cmd('priv', 'show running-config', 'Joriy sozlamalar', (ctx) => ctx.print(runningConfig(ctx.dev())));
cmd('priv', 'write memory', 'Saqlash', (ctx) => ctx.print('Building configuration...\n[OK]'));
cmd('priv', 'copy running-config startup-config', 'Saqlash', (ctx) => ctx.print('Building configuration...\n[OK]'));

cmd('user priv', 'exit', 'Seansdan chiqish', logout);
cmd('config', 'exit', 'Orqaga', go('priv'));
cmd('if vlan line', 'exit', 'Orqaga', go('config'));
cmd('config if vlan line', 'end', 'Privileged rejimga qaytish', go('priv'));

cmd('config if vlan line', 'hostname <nom>', 'Qurilma nomi', (ctx, [n]) => {
  if (!/^[A-Za-z][\w-]{0,31}$/.test(n)) fail('% Nom harf bilan boshlanib, harf, raqam, - yoki _ dan iborat bo‘lsin');
  try { ctx.topo = renameDevice(ctx.topo, ctx.id, n); } catch (e) { fail('% ' + e.message); }
});
cmd('config if vlan line', 'interface <...>', 'Interfeysni sozlash', (ctx, a) => {
  const n = parseIface(ctx.dev(), a.join(''));
  ctx.s = { ...ctx.s, mode: 'if', ifs: [n], vlan: null };
  if (n.includes('.') || n.startsWith('Vlan')) setCfg(ctx, (c) => { c.ifaces[n] ??= {}; });
});
cmd('config if vlan line', 'interface range <...>', 'Bir nechta port', (ctx, a) => {
  const names = [];
  for (const part of a.join('').split(',')) {
    const [start, end] = part.split('-');
    const first = parseIface(ctx.dev(), start);
    if (end === undefined) { names.push(first); continue; }
    const m = /^(.*\/)(\d+)$/.exec(first), last = +end.split('/').at(-1);
    if (!m || !/^[\d/]+$/.test(end) || last < +m[2] || last - +m[2] > 48) fail();
    for (let i = +m[2]; i <= last; i++) names.push(parseIface(ctx.dev(), m[1] + i));
  }
  ctx.s = { ...ctx.s, mode: 'if', ifs: names, vlan: null };
});
cmd('config if vlan line', 'vlan <id>', 'VLAN yaratish', (ctx, [x]) => {
  const v = vlanNum(x);
  if (v !== 1) setCfg(ctx, (c) => { c.vlans[v] ??= `VLAN${String(v).padStart(4, '0')}`; });
  ctx.s = { ...ctx.s, mode: 'vlan', vlan: v, ifs: [] };
}, SW);
cmd('config', 'no vlan <id>', 'VLAN o‘chirish', (ctx, [x]) => { const v = vlanNum(x); if (v === 1) fail('% VLAN 1 ni o‘chirib bo‘lmaydi'); setCfg(ctx, (c) => { delete c.vlans[v]; }); }, SW);
cmd('vlan', 'name <nom>', 'VLAN nomi', (ctx, [n]) => { if (ctx.s.vlan === 1) fail('% VLAN 1 nomi o‘zgarmaydi'); setCfg(ctx, (c) => { c.vlans[ctx.s.vlan] = n; }); });

const route = (ctx, [net, mask, via]) => {
  if (ipToInt(net) === null || !isMask(mask) || ipToInt(via) === null) fail('% Manzil yoki mask noto‘g‘ri');
  if (network(net, mask) !== ipToInt(net)) fail('% Inconsistent address and mask');
  return { net, mask, via };
};
const sameRoute = (a, b) => a.net === b.net && a.mask === b.mask && a.via === b.via;
cmd('config', 'ip route <tarmoq> <mask> <keyingi-ip>', 'Statik marshrut', (ctx, a) => { const r = route(ctx, a); setCfg(ctx, (c) => { c.routes = [...c.routes.filter((x) => !sameRoute(x, r)), r]; }); }, RT);
cmd('config', 'no ip route <tarmoq> <mask> <keyingi-ip>', 'Marshrutni o‘chirish', (ctx, a) => { const r = route(ctx, a); setCfg(ctx, (c) => { c.routes = c.routes.filter((x) => !sameRoute(x, r)); }); }, RT);
cmd('config', 'ip routing', 'L3 switchda marshrutlash', (ctx) => setCfg(ctx, (c) => { c.ipRouting = true; }), L3);
cmd('config', 'no ip routing', 'Marshrutlashni o‘chirish', (ctx) => setCfg(ctx, (c) => { c.ipRouting = false; }), L3);
cmd('config', 'ip default-gateway <ip>', 'Switch uchun gateway', (ctx, [ip]) => { if (ipToInt(ip) === null) fail('% IP manzil noto‘g‘ri'); setCfg(ctx, (c) => { c.gateway = ip; }); }, SW);

cmd('if', 'ip address <ip> <mask>', 'IP manzil berish', (ctx, [ip, mask]) => {
  const d = ctx.dev();
  if (ctx.s.ifs.length > 1) fail('% Bir nechta portga bitta IP berib bo‘lmaydi');
  const n = ctx.s.ifs[0];
  if (SW(d) && !n.startsWith('Vlan')) fail('% Switch portiga IP berilmaydi. "interface vlan 1" dan foydalaning');
  if (n.includes('.') && !getIface(d, n).encap) fail('% Avval "encapsulation dot1q <vlan>" yozing');
  const err = checkHostAddress(ip, mask);
  if (err) fail('% ' + err);
  const clash = Object.entries(getConfig(d).ifaces).find(([k, i]) => k !== n && i.ip && (network(ip, mask) === network(i.ip, mask) || network(ip, i.mask) === network(i.ip, i.mask)));
  if (clash) fail(`% ${ip} overlaps with ${longName(clash[0])}`);
  eachIf(ctx, (i) => { i.ip = ip; i.mask = mask; });
});
cmd('if', 'no ip address', 'IP manzilni olib tashlash', (ctx) => eachIf(ctx, (i) => { delete i.ip; delete i.mask; }));
const power = (down) => (ctx) => {
  for (const n of ctx.s.ifs) {
    if (n.startsWith('Vlan') || n.includes('.')) { const keep = ctx.s.ifs; ctx.s.ifs = [n]; eachIf(ctx, (i) => { i.shutdown = down; }); ctx.s.ifs = keep; }
    else {
      const d = ctx.dev(), set = new Set(d.disabled);
      down ? set.add(n) : set.delete(n);
      ctx.topo = updateDevice(ctx.topo, d.id, { disabled: [...set] });
    }
    ctx.print(`%LINK-5-CHANGED: Interface ${longName(n)}, changed state to ${down ? 'administratively down' : 'up'}`);
  }
};
cmd('if', 'shutdown', 'Interfeysni o‘chirish', power(true));
cmd('if', 'no shutdown', 'Interfeysni yoqish', power(false));
cmd('if', 'description <...>', 'Izoh', (ctx, a) => eachIf(ctx, (i) => { i.description = a.join(' '); }));
cmd('if', 'encapsulation dot1q <vlan>', 'Sub-interfeys VLAN', (ctx, [x]) => {
  if (!ctx.s.ifs[0].includes('.')) fail('% Faqat sub-interfeysda (masalan g0/0.10)');
  const v = vlanNum(x); eachIf(ctx, (i) => { i.encap = v; });
}, (d) => d.type === 'router');
cmd('if', 'switchport mode access', 'Access port', (ctx) => { switchports(ctx); eachIf(ctx, (i) => { i.mode = 'access'; }); }, SW);
cmd('if', 'switchport mode trunk', 'Trunk port', (ctx) => { switchports(ctx); eachIf(ctx, (i) => { i.mode = 'trunk'; }); }, SW);
cmd('if', 'switchport access vlan <id>', 'Portni VLANga qo‘shish', (ctx, [x]) => {
  switchports(ctx); const v = vlanNum(x);
  if (v !== 1 && !getConfig(ctx.dev()).vlans[v]) ctx.print(`% Access VLAN does not exist. Creating vlan ${v}`);
  eachIf(ctx, (i, _, c) => { i.accessVlan = v; if (v !== 1) c.vlans[v] ??= `VLAN${String(v).padStart(4, '0')}`; });
}, SW);
cmd('if', 'no switchport access vlan', 'VLAN 1 ga qaytarish', (ctx) => { switchports(ctx); eachIf(ctx, (i) => { delete i.accessVlan; }); }, SW);
cmd('if', 'no switchport mode', 'Rejimni tiklash', (ctx) => { switchports(ctx); eachIf(ctx, (i) => { delete i.mode; }); }, SW);
cmd('if', 'switchport trunk allowed vlan <ro‘yxat>', 'Ruxsat etilgan VLANlar', (ctx, [x]) => { switchports(ctx); const l = x === 'none' ? [] : x === 'all' ? null : vlanList(x); eachIf(ctx, (i) => { if (l) i.allowed = l; else delete i.allowed; }); }, SW);
cmd('if', 'switchport trunk allowed vlan add <ro‘yxat>', 'VLAN qo‘shish', (ctx, [x]) => { switchports(ctx); const l = vlanList(x); eachIf(ctx, (i) => { if (i.allowed) i.allowed = [...new Set([...i.allowed, ...l])].sort((a, b) => a - b); }); }, SW);

const secretCmd = (word, key, help) => {
  cmd('config', `enable ${word} <parol>`, help, (ctx, [p]) => setCfg(ctx, (c) => { c[key] = p; }));
  cmd('config', `no enable ${word}`, 'Parolni o‘chirish', (ctx) => setCfg(ctx, (c) => { c[key] = ''; }));
};
secretCmd('secret', 'secret', 'Shifrlangan enable paroli');
secretCmd('password', 'enablePassword', 'Oddiy enable paroli');
cmd('config', 'service password-encryption', 'Parollarni yashirish', (ctx) => setCfg(ctx, (c) => { c.encrypt = true; }));
cmd('config', 'no service password-encryption', 'Yashirishni o‘chirish', (ctx) => setCfg(ctx, (c) => { c.encrypt = false; }));
cmd('config', 'banner motd <...>', 'Kirish xabari: #matn#', (ctx, a) => {
  const t = a.join(' ');
  if (t.length < 3 || t.at(-1) !== t[0]) fail('% Foydalanish: banner motd #matn#');
  setCfg(ctx, (c) => { c.banner = t.slice(1, -1); });
});
cmd('config', 'no banner motd', 'Xabarni o‘chirish', (ctx) => setCfg(ctx, (c) => { c.banner = ''; }));
const toLine = (ctx, line) => { ctx.s = { ...ctx.s, mode: 'line', line, ifs: [], vlan: null }; };
cmd('config line', 'line console <0>', 'Konsol liniyasi', (ctx, [n]) => { if (n !== '0') fail(); toLine(ctx, 'con'); });
cmd('config line', 'line vty <boshi> <oxiri>', 'Telnet liniyalari', (ctx, [a, b]) => { if (!/^\d+$/.test(a) || !/^\d+$/.test(b) || +a > +b || +b > 15) fail(); toLine(ctx, 'vty'); });
cmd('line', 'password <parol>', 'Liniya paroli', (ctx, [p]) => setCfg(ctx, (c) => { c[ctx.s.line] = { ...c[ctx.s.line], password: p }; }));
cmd('line', 'no password', 'Parolni o‘chirish', (ctx) => setCfg(ctx, (c) => { c[ctx.s.line] = { ...c[ctx.s.line], password: '' }; }));
const login = (on) => (ctx) => {
  setCfg(ctx, (c) => { c[ctx.s.line] = { ...c[ctx.s.line], login: on }; });
  if (on && !getConfig(ctx.dev())[ctx.s.line].password) ctx.print('% Login disabled until "password" is set');
};
cmd('line', 'login', 'Kirishda parol so‘rash', login(true));
cmd('line', 'no login', 'Parolsiz kirish', login(false));

/* ---------- tahlil ---------- */
const isArg = (w) => w.startsWith('<');
const available = (d, mode) => C.filter((c) => c.modes.includes(mode) && (!c.only || c.only(d)));

function match(d, mode, tokens) {
  let list = available(d, mode);
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k].toLowerCase();
    const kw = list.filter((c) => c.words[k] && !isArg(c.words[k]) && c.words[k].startsWith(t));
    if (kw.length) {
      const exact = kw.filter((c) => c.words[k] === t);
      const words = new Set(kw.map((c) => c.words[k]));
      if (!exact.length && words.size > 1) fail(`% Ambiguous command: "${tokens.join(' ')}"`);
      list = exact.length ? exact : kw;
    } else list = list.filter((c) => (c.words[k] && isArg(c.words[k])) || (c.words.at(-1) === '<...>' && k >= c.words.length - 1));
    if (!list.length) return [];
  }
  return list;
}

function execIos(ctx, line) {
  let tokens = line.split(/\s+/);
  let mode = ctx.s.mode, saved = null;
  if (tokens[0].toLowerCase() === 'do' && ['config', 'if', 'vlan', 'line'].includes(mode)) { tokens = tokens.slice(1); saved = ctx.s; mode = 'priv'; ctx.s = { ...ctx.s, mode }; if (!tokens.length) fail('% Incomplete command.'); }
  let list = match(ctx.dev(), mode, tokens);
  // IOS kabi: ichki rejimda global buyruq yozilsa, global rejimga qaytadi
  if (!list.length && (mode === 'if' || mode === 'vlan' || mode === 'line')) {
    list = match(ctx.dev(), 'config', tokens);
    if (list.length) ctx.s = { ...ctx.s, mode: 'config', ifs: [], vlan: null, line: null };
  }
  if (!list.length) fail();
  const full = list.filter((c) => c.words.length === tokens.length || (c.words.at(-1) === '<...>' && tokens.length >= c.words.length));
  if (!full.length) fail('% Incomplete command.');
  const c = full[0];
  const args = [];
  c.words.forEach((w, i) => { if (w === '<...>') args.push(...tokens.slice(i)); else if (isArg(w)) args.push(tokens[i]); });
  c.fn(ctx, args);
  // "do" dan keyin oldingi rejimga qaytiladi (telnet ochilgan bo‘lsa, yo‘q)
  if (saved && ctx.s.remote === saved.remote) ctx.s = saved;
}

function execHost(ctx, line) {
  const [name, ...a] = line.split(/\s+/);
  const d = ctx.dev(), i = getIface(d, 'Eth0'), c = getConfig(d);
  switch (name.toLowerCase()) {
    case 'help': case '?':
      return ctx.print('ipconfig                       IP sozlamalarini ko‘rish\nip <ip> <mask> [gateway]       IP manzil berish\nping <ip>                      Ulanishni tekshirish\ntelnet <ip>                    Switch/routerga ulanish\ntracert <ip>                   Yo‘lni ko‘rish\ncls                            Ekranni tozalash');
    case 'ipconfig': case 'ip': {
      if (!a.length) return ctx.print(`Eth0:\n   IPv4 Address....: ${i.ip ?? '0.0.0.0'}\n   Subnet Mask.....: ${i.mask ?? '0.0.0.0'}\n   Default Gateway.: ${c.gateway || '0.0.0.0'}`);
      const [ip, mask, gw = ''] = a;
      if (a.length < 2 || a.length > 3) fail('Foydalanish: ip <ip> <mask> [gateway]');
      const err = checkHostAddress(ip, mask) || (gw && ipToInt(gw) === null && 'Gateway noto‘g‘ri');
      if (err) fail(err);
      setCfg(ctx, (cf) => { cf.ifaces.Eth0 = { ...cf.ifaces.Eth0, ip, mask }; cf.gateway = gw; });
      return ctx.print('IP sozlandi.');
    }
    case 'telnet': {
      if (a.length !== 1) fail('Foydalanish: telnet <ip>');
      return telnet(ctx, a[0]);
    }
    case 'ping': {
      if (a.length !== 1 || ipToInt(a[0]) === null) fail('Foydalanish: ping <ip>');
      const r = ping(ctx.topo, ctx.id, a[0]);
      const row = r.ok ? `Reply from ${a[0]}: bytes=32 time<1ms TTL=${r.ttl}` : r.noRoute ? 'Destination host unreachable.' : 'Request timed out.';
      return ctx.print(`Pinging ${a[0]} with 32 bytes of data:\n${Array(4).fill(row).join('\n')}\n\nPackets: Sent = 4, Received = ${r.ok ? 4 : 0}, Lost = ${r.ok ? 0 : 4}`);
    }
    case 'tracert': {
      if (a.length !== 1 || ipToInt(a[0]) === null) fail('Foydalanish: tracert <ip>');
      const r = ping(ctx.topo, ctx.id, a[0]);
      return ctx.print([`Tracing route to ${a[0]}`, ...r.hops.map((h, n) => `  ${n + 1}   <1 ms   ${h}`), r.ok ? 'Trace complete.' : '  *   Request timed out.'].join('\n'));
    }
    default: fail(`'${name}' buyrug‘i topilmadi. "help" yozing.`);
  }
}

function password(ctx, text) {
  const { kind, tries } = ctx.s.ask, c = getConfig(ctx.dev());
  const ok = kind === 'enable' ? text === (c.secret || c.enablePassword) : text === c[kind === 'console' ? 'con' : 'vty'].password;
  if (ok) { ctx.s = { ...ctx.s, ask: null, ...(kind === 'enable' ? { mode: 'priv' } : {}) }; return; }
  if (tries < 2) { ctx.s = { ...ctx.s, ask: { kind, tries: tries + 1 } }; return; }
  if (kind === 'enable') { ctx.s = { ...ctx.s, ask: null }; return ctx.print('% Bad secrets'); }
  if (kind === 'vty') { ctx.s = ctx.s.remote.back; return ctx.print('% Bad passwords\n[Connection closed by foreign host]'); }
  ctx.s = { ...ctx.s, ask: { kind, tries: 0 } };
  ctx.print('% Bad passwords');
}

export function run(topo, deviceId, session, input) {
  const out = [];
  const ctx = { topo, id: session.remote?.id ?? deviceId, s: { ...session }, print: (t) => out.push(t), dev: () => ctx.topo.devices.find((d) => d.id === ctx.id) };
  const line = input.trim();
  let clear = false;
  const local = topo.devices.find((d) => d.id === deviceId);
  if (!local.power) return { topo, session, output: 'Qurilma o‘chirilgan.', clear };
  if (session.remote && (!ctx.dev() || !ping(topo, deviceId, session.remote.ip).ok))
    return { topo, session: session.remote.back, output: '[Connection lost]', clear };
  if (!session.ask && /^(cls|clear)$/i.test(line)) clear = true;
  else if (session.ask || (line && line !== '!')) {
    const before = ctx.topo, beforeSession = ctx.s;
    try {
      if (session.ask) password(ctx, input);
      else if (ctx.s.mode === 'host') execHost(ctx, line);
      else if (line.endsWith('?')) out.push(help(ctx.dev(), ctx.s, line.slice(0, -1)));
      else execIos(ctx, line);
    } catch (e) {
      if (!(e instanceof CliError)) throw e;
      ctx.topo = before; ctx.s = beforeSession; out.length = 0; out.push(e.message);
    }
  }
  return { topo: ctx.topo, session: ctx.s, output: out.join('\n'), clear };
}

export function help(d, s, text) {
  const partial = text !== '' && !/\s$/.test(text);
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const last = partial ? tokens.pop() : '';
  let list;
  try { list = match(d, s.mode, tokens); } catch (e) { return e.message; }
  const rows = new Map();
  for (const c of list) {
    const w = c.words[tokens.length] ?? '<cr>';
    if (w.startsWith(last.toLowerCase()) || (!last && w)) rows.set(w, c.words.length <= tokens.length + 1 ? c.help : '');
  }
  return rows.size ? [...rows].map(([w, h]) => `  ${pad(w, 22)}${h}`).join('\n') : '% Unrecognized command';
}

export function complete(d, s, text) {
  if (!text || /\s$/.test(text)) return text;
  const tokens = text.split(/\s+/), last = tokens.pop().toLowerCase();
  const words = s.mode === 'host' ? (tokens.length ? [] : ['ipconfig', 'ping', 'telnet', 'tracert', 'cls', 'help'])
    : (() => { try { return match(d, s.mode, tokens.filter(Boolean)).map((c) => c.words[tokens.length]).filter((w) => w && !isArg(w)); } catch { return []; } })();
  const hits = [...new Set(words.filter((w) => w.startsWith(last)))];
  return hits.length === 1 ? [...tokens, hits[0]].join(' ') + ' ' : text;
}
