import { describe, it, expect } from 'vitest';
import { emptyTopology, addDevice, connect, parseProject } from '../src/engine/topology.js';
import { run, newSession, complete } from '../src/engine/cli.js';
import { ping } from '../src/engine/network.js';

function lab(devs, links) {
  let t = emptyTopology();
  for (const [id, type] of devs) t = addDevice(t, type, { x: 0, y: 0 }, id);
  links.forEach(([cable, a, ap, b, bp], i) => { t = connect(t, cable, { device: a, port: ap }, { device: b, port: bp }, 'l' + i); });
  const sessions = {};
  const h = {
    get t() { return t; },
    do(id, ...lines) {
      let out = '';
      for (const line of lines) {
        const type = t.devices.find((d) => d.id === id).type;
        const r = run(t, id, sessions[id] ?? newSession(type), line);
        t = r.topo; sessions[id] = r.session; out = r.output;
      }
      return out;
    },
  };
  return h;
}
const M = '255.255.255.0';

describe('CLI va ping', () => {
  it('bitta switchda ikki PC', () => {
    const l = lab([['a', 'pc'], ['b', 'pc'], ['s', 'switch']], [['straight', 'a', 'Eth0', 's', 'Fa0/1'], ['straight', 'b', 'Eth0', 's', 'Fa0/2']]);
    l.do('a', `ip 192.168.1.1 ${M}`); l.do('b', `ip 192.168.1.2 ${M}`);
    expect(l.do('a', 'ping 192.168.1.2')).toMatch(/Received = 4/);
    expect(l.do('a', 'ping 192.168.1.9')).toMatch(/Received = 0/);
    l.do('s', 'en', 'conf t', 'int f0/2', 'switchport mode access', 'switchport access vlan 10');
    expect(l.do('a', 'ping 192.168.1.2')).toMatch(/Received = 0/);
    l.do('s', 'int f0/1', 'sw acc vlan 10');
    expect(l.do('a', 'ping 192.168.1.2')).toMatch(/Received = 4/);
    expect(l.do('s', 'do show vlan brief')).toMatch(/10\s+VLAN0010\s+Fa0\/1, Fa0\/2/);
  });
  it('trunk va router-on-a-stick', () => {
    const l = lab([['a', 'pc'], ['b', 'pc'], ['s', 'switch'], ['r', 'router']],
      [['straight', 'a', 'Eth0', 's', 'Fa0/1'], ['straight', 'b', 'Eth0', 's', 'Fa0/2'], ['straight', 'r', 'Gi0/0', 's', 'Gi0/1']]);
    l.do('a', `ip 10.0.10.2 ${M} 10.0.10.1`); l.do('b', `ip 10.0.20.2 ${M} 10.0.20.1`);
    l.do('s', 'en', 'conf t', 'vlan 10', 'name Ofis', 'vlan 20', 'int f0/1', 'sw acc vlan 10', 'int f0/2', 'sw acc vlan 20', 'int g0/1', 'sw mode trunk');
    l.do('r', 'en', 'conf t', 'int g0/0', 'no shut', 'int g0/0.10', 'encapsulation dot1q 10', `ip add 10.0.10.1 ${M}`, 'int g0/0.20', 'enc dot1q 20', `ip add 10.0.20.1 ${M}`);
    expect(ping(l.t, 'a', '10.0.20.2')).toMatchObject({ ok: true, ttl: 127 });
    l.do('s', 'sw trunk allowed vlan 10');
    expect(ping(l.t, 'a', '10.0.20.2').ok).toBe(false);
  });
  it('ikki router va statik marshrut (ikkala yo‘nalish shart)', () => {
    const l = lab([['a', 'pc'], ['b', 'pc'], ['r1', 'router'], ['r2', 'router']],
      [['cross', 'a', 'Eth0', 'r1', 'Gi0/0'], ['cross', 'b', 'Eth0', 'r2', 'Gi0/0'], ['serial', 'r1', 'Se0/0', 'r2', 'Se0/0']]);
    l.do('a', `ip 192.168.1.2 ${M} 192.168.1.1`); l.do('b', `ip 192.168.2.2 ${M} 192.168.2.1`);
    for (const [r, n, s] of [['r1', 1, 1], ['r2', 2, 2]]) l.do(r, 'enable', 'configure terminal', 'interface gigabitEthernet 0/0', `ip address 192.168.${n}.1 ${M}`, 'no shutdown', 'int s0/0', `ip address 10.0.0.${s} 255.255.255.252`, 'no shutdown');
    l.do('r1', `ip route 192.168.2.0 ${M} 10.0.0.2`);
    expect(ping(l.t, 'a', '192.168.2.2').ok).toBe(false);
    l.do('r2', `ip route 192.168.1.0 ${M} 10.0.0.1`);
    expect(ping(l.t, 'a', '192.168.2.2')).toMatchObject({ ok: true, ttl: 126 });
    expect(l.do('r1', 'end', 'sh ip ro')).toMatch(/S\s+192\.168\.2\.0\/24/);
    expect(l.do('r1', 'show run')).toMatch(/ip route 192\.168\.2\.0/);
  });
  it('L3 switch VLANlararo marshrutlash va SVI', () => {
    const l = lab([['a', 'pc'], ['b', 'pc'], ['m', 'l3switch']], [['straight', 'a', 'Eth0', 'm', 'Fa0/1'], ['straight', 'b', 'Eth0', 'm', 'Fa0/2']]);
    l.do('a', `ip 10.1.0.2 ${M} 10.1.0.1`); l.do('b', `ip 10.2.0.2 ${M} 10.2.0.1`);
    l.do('m', 'en', 'conf t', 'int range f0/1', 'sw acc vlan 10', 'int f0/2', 'sw acc vlan 20', 'int vlan 10', `ip add 10.1.0.1 ${M}`, 'int vlan 20', `ip add 10.2.0.1 ${M}`);
    expect(ping(l.t, 'a', '10.2.0.2').ok).toBe(false);
    l.do('m', 'ip routing');
    expect(ping(l.t, 'a', '10.2.0.2').ok).toBe(true);
  });
  it('xatolar, hostname, ?, Tab, cls, import', () => {
    const l = lab([['r', 'router'], ['s', 'switch']], []);
    expect(l.do('r', 'conf t')).toMatch(/Invalid/);
    expect(l.do('r', 'en', 'c')).toMatch(/Ambiguous|Incomplete/);
    expect(l.do('r', 'conf t', 'int f0/1')).toMatch(/yo‘q/);
    expect(l.do('r', 'int g0/0', 'ip address 10.0.0.0 255.255.255.0')).toMatch(/broadcast/);
    expect(l.do('r', 'switchport mode trunk')).toMatch(/Invalid/);
    l.do('r', 'hostname Markaz');
    expect(l.t.devices[0].name).toBe('Markaz');
    expect(l.do('r', '?')).toMatch(/shutdown/);
    expect(l.do('s', 'en', 'conf t', 'int range fa0/1 - 3', 'sw mode trunk', 'do sh int trunk')).toMatch(/Fa0\/3/);
    expect(complete(l.t.devices[0], { mode: 'priv' }, 'conf')).toBe('configure ');
    expect(run(l.t, 'r', { mode: 'priv', ifs: [] }, 'cls').clear).toBe(true);
    expect(parseProject(JSON.stringify({ topology: l.t })).topology.devices[1].config.ifaces['Fa0/3'].mode).toBe('trunk');
  });
});
