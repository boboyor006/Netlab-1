import { describe, it, expect } from 'vitest';
import { sampleTopology } from '../src/engine/sample.js';
import { classMask, applyIp } from '../src/engine/ipsetup.js';
import { ping } from '../src/engine/network.js';

describe('IP oynasi', () => {
  it('maskni IP sinfiga qarab beradi', () => {
    expect(classMask('192.168.1.5')).toBe('255.255.255.0');
    expect(classMask('172.16.0.1')).toBe('255.255.0.0');
    expect(classMask('10.0.0.1')).toBe('255.0.0.0');
    expect(classMask('192.168.1')).toBe('');
    expect(classMask('224.0.0.1')).toBe('');
  });
  it('router va switchga IP beradi, xatoda o‘zgartirmaydi', () => {
    const base = sampleTopology(), M = '255.255.255.0';
    let r = applyIp(base, 'r1', { iface: 'Gi0/0', ip: '192.168.1.1', mask: M, on: true });
    expect(r.error).toBeNull();
    r = applyIp(r.topo, 's1', { iface: 'Vlan1', ip: '192.168.1.2', mask: M, gateway: '192.168.1.1', on: true });
    expect(r.error).toBeNull();
    expect(ping(r.topo, 'p1', '192.168.1.1').ok).toBe(true);
    expect(ping(r.topo, 'p1', '192.168.1.2').ok).toBe(true);
    const bad = applyIp(r.topo, 'r1', { iface: 'Gi0/1', ip: '192.168.1.9', mask: M, on: true });
    expect(bad.error).toMatch(/overlaps/);
    expect(bad.topo).toBe(r.topo);
    expect(applyIp(base, 'p1', { iface: 'Eth0', ip: '300.1.1.1', mask: M }).error).toMatch(/noto/);
    expect(applyIp(base, 'p1', { iface: 'Eth0', ip: '', mask: '' }).topo.devices.find((d) => d.id === 'p1').config.ifaces.Eth0.ip).toBeUndefined();
  });
});
