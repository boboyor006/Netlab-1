// L2 (VLAN, trunk) va L3 (marshrutlash) simulyatsiyasi
import { DEVICE_TYPES } from './devices.js';
import { linkStatus, portLink } from './topology.js';
import { getConfig, getIface, sviShutdown, isSwitch, HOST_TYPES, ipToInt, sameNet, network, prefixLen } from './config.js';

const byId = (t, id) => t.devices.find((d) => d.id === id);

export function portUp(topo, d, port) {
  const l = portLink(topo, d.id, port);
  return !!l && linkStatus(topo, l).up;
}

export const vlanExists = (d, v) => v === 1 || !!getConfig(d).vlans[v];

const allows = (i, v) => !i.allowed || i.allowed.includes(v);

// Qurilmaning IP interfeyslari
export function l3Interfaces(topo, d) {
  const c = getConfig(d);
  return Object.entries(c.ifaces).filter(([, i]) => i.ip).map(([name, i]) => {
    let up = d.power;
    if (name.startsWith('Vlan')) {
      const v = +name.slice(4);
      up = up && isSwitch(d.type) && !sviShutdown(d, name) && vlanExists(d, v) &&
        DEVICE_TYPES[d.type].ports.some((p) => {
          const pc = getIface(d, p.id);
          return portUp(topo, d, p.id) && (pc.mode === 'trunk' ? allows(pc, v) : (pc.accessVlan ?? 1) === v);
        });
    } else {
      const [parent, sub] = name.split('.');
      up = up && portUp(topo, d, parent) && (!sub || (!!i.encap && !i.shutdown));
    }
    return { name, ip: i.ip, mask: i.mask, up };
  });
}

// Interfeysdan chiqqan kadr yetib boradigan barcha IP interfeyslar
export function l2Neighbors(topo, src, ifName) {
  const found = [], seen = new Set(), queue = [];
  const send = (d, port, tag) => {
    if (!portUp(topo, d, port)) return;
    const l = portLink(topo, d.id, port);
    const other = l.a.device === d.id ? l.b : l.a;
    queue.push([byId(topo, other.device), other.port, tag]);
  };
  const addIf = (d, name) => {
    const i = l3Interfaces(topo, d).find((x) => x.name === name && x.up);
    if (i) found.push({ device: d, ...i });
  };
  const flood = (d, vlan, except) => {
    if (!vlanExists(d, vlan)) return;
    const key = `${d.id}|${vlan}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (d.id !== src.id) addIf(d, `Vlan${vlan}`);
    for (const p of DEVICE_TYPES[d.type].ports) {
      if (p.id === except || p.media !== 'copper') continue;
      const c = getIface(d, p.id);
      if (c.mode === 'trunk') { if (allows(c, vlan)) send(d, p.id, vlan === 1 ? null : vlan); }
      else if ((c.accessVlan ?? 1) === vlan) send(d, p.id, null);
    }
  };

  if (ifName.startsWith('Vlan')) flood(src, +ifName.slice(4), null);
  else {
    const [parent, sub] = ifName.split('.');
    const enc = sub ? getIface(src, ifName).encap : null;
    send(src, parent, enc && enc !== 1 ? enc : null);
  }

  while (queue.length) {
    const [d, port, tag] = queue.shift();
    if (isSwitch(d.type)) {
      const c = getIface(d, port);
      if (c.mode === 'trunk') { const v = tag ?? 1; if (allows(c, v)) flood(d, v, port); }
      else if (tag === null) flood(d, c.accessVlan ?? 1, port);
    } else if (d.type === 'ap' || d.type === 'cloud') {
      const key = `${d.id}|${port}|${tag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const p of DEVICE_TYPES[d.type].ports) if (p.id !== port) send(d, p.id, tag);
    } else if (d.id !== src.id) {
      // Router yoki oxirgi qurilma
      for (const [name, i] of Object.entries(getConfig(d).ifaces)) {
        const [parent, sub] = name.split('.');
        if (parent !== port) continue;
        const want = sub && i.encap !== 1 ? i.encap : null;
        if (want === tag) addIf(d, name);
      }
    }
  }
  return found;
}

const forwards = (d) => d.type === 'router' || (d.type === 'l3switch' && getConfig(d).ipRouting);

// Keyingi qadam uchun interfeys va manzil
export function lookup(topo, d, dst) {
  const ifs = l3Interfaces(topo, d).filter((i) => i.up);
  const direct = ifs.filter((i) => sameNet(i.ip, dst, i.mask)).sort((a, b) => prefixLen(b.mask) - prefixLen(a.mask))[0];
  if (direct) return { iface: direct, next: dst };
  let via = null;
  if (HOST_TYPES.includes(d.type) || (d.type === 'switch') || (d.type === 'l3switch' && !forwards(d))) via = getConfig(d).gateway;
  else {
    const usable = getConfig(d).routes.filter((r) => network(dst, r.mask) === network(r.net, r.mask) &&
      ifs.some((i) => sameNet(i.ip, r.via, i.mask)));
    via = usable.sort((a, b) => prefixLen(b.mask) - prefixLen(a.mask))[0]?.via;
  }
  const iface = via && ifs.find((i) => sameNet(i.ip, via, i.mask));
  return iface ? { iface, next: via } : null;
}

function walk(topo, start, dst) {
  let d = start;
  const hops = [];
  for (let ttl = 0; ttl < 32; ttl++) {
    if (l3Interfaces(topo, d).some((i) => i.up && i.ip === dst)) return { ok: true, device: d, hops };
    if (d !== start && !forwards(d)) return { ok: false, hops };
    const r = lookup(topo, d, dst);
    if (!r) return { ok: false, hops, noRoute: d === start };
    const n = l2Neighbors(topo, d, r.iface.name).find((x) => x.ip === r.next);
    if (!n) return { ok: false, hops };
    d = n.device;
    hops.push(n.ip);
  }
  return { ok: false, hops };
}

export function ping(topo, srcId, dst) {
  if (ipToInt(dst) === null) return { ok: false, error: 'IP manzil noto‘g‘ri', hops: [] };
  const src = byId(topo, srcId);
  if (l3Interfaces(topo, src).some((i) => i.up && i.ip === dst)) return { ok: true, hops: [dst], ttl: 255 };
  const first = lookup(topo, src, dst);
  const go = walk(topo, src, dst);
  if (!go.ok) return { ok: false, hops: go.hops, noRoute: go.noRoute };
  const back = walk(topo, go.device, first.iface.ip);
  if (!back.ok || back.device.id !== srcId) return { ok: false, hops: go.hops };
  const base = HOST_TYPES.includes(go.device.type) ? 128 : 255;
  const hops = [...go.hops.slice(0, -1), dst];
  return { ok: true, hops, ttl: base - (hops.length - 1) };
}
