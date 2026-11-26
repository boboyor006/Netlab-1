import { DEVICE_TYPES } from './devices.js';
import { updateDevice } from './topology.js';
import { getConfig, ipToInt, isSwitch, HOST_TYPES } from './config.js';
import { run } from './cli.js';


export function classMask(ip) {
  const n = ipToInt(ip);
  if (n === null) return '';
  const first = n >>> 24;
  if (first >= 1 && first <= 126) return '255.0.0.0';
  if (first >= 128 && first <= 191) return '255.255.0.0';
  if (first >= 192 && first <= 223) return '255.255.255.0';
  return '';
}

export function ipInterfaces(d) {
  if (HOST_TYPES.includes(d.type)) return ['Eth0'];
  const saved = Object.keys(getConfig(d).ifaces);
  if (isSwitch(d.type)) return [...new Set(['Vlan1', ...saved.filter((n) => n.startsWith('Vlan'))])];
  return [...DEVICE_TYPES[d.type].ports.map((p) => p.id), ...saved.filter((n) => n.includes('.'))];
}


export function applyIp(topo, id, { iface, ip, mask, gateway, on }) {
  const device = topo.devices.find((d) => d.id === id);
  const host = HOST_TYPES.includes(device.type);
  if (gateway && ipToInt(gateway) === null) return { topo, error: 'Gateway noto‘g‘ri' };
  if (!device.power) return { topo, error: 'Qurilma o‘chirilgan' };
  let next = topo;
  let session = { mode: host ? 'host' : 'config', ifs: [] };
  const send = (line) => {
    const r = run(next, id, session, line);
    next = r.topo; session = r.session;
    return r.output;
  };
  if (host) {
    if (ip) {
      const out = send(`ip ${ip} ${mask || '-'} ${gateway ?? ''}`);
      if (out !== 'IP sozlandi.') return { topo, error: out };
    } else {
      const c = structuredClone(getConfig(device));
      delete c.ifaces.Eth0?.ip; delete c.ifaces.Eth0?.mask;
      c.gateway = gateway ?? '';
      next = updateDevice(topo, id, { config: c });
    }
    return { topo: next, error: null };
  }
  const lines = [`interface ${iface}`, ip ? `ip address ${ip} ${mask || '-'}` : 'no ip address', on ? 'no shutdown' : 'shutdown'];
  if (isSwitch(device.type)) lines.push(gateway ? `ip default-gateway ${gateway}` : null);
  for (const line of lines.filter(Boolean)) {
    const out = send(line);
    if (out.startsWith('%') && !out.startsWith('%LINK')) return { topo, error: out.slice(2) };
  }
  if (isSwitch(device.type) && !gateway) {
    const d = next.devices.find((x) => x.id === id);
    next = updateDevice(next, id, { config: { ...getConfig(d), gateway: '' } });
  }
  return { topo: next, error: null };
}
