import { emptyTopology, addDevice, connect, updateDevice } from './topology.js';
import { defaultConfig } from './config.js';
export function sampleTopology() {
  let t = emptyTopology();
  t = addDevice(t, 'router', { x: 320, y: 20 }, 'r1');
  t = addDevice(t, 'switch', { x: 320, y: 180 }, 's1');
  t = addDevice(t, 'pc', { x: 120, y: 340 }, 'p1');
  t = addDevice(t, 'pc', { x: 320, y: 340 }, 'p2');
  t = addDevice(t, 'server', { x: 520, y: 340 }, 'v1');
  t = updateDevice(t, 'r1', { disabled: ['Gi0/1', 'Gi0/2', 'Se0/0', 'Se0/1'] });
  [['r1', 'Gi0/0', 'Gi0/1'], ['p1', 'Eth0', 'Fa0/1'], ['p2', 'Eth0', 'Fa0/2'], ['v1', 'Eth0', 'Fa0/3']]
    .forEach(([d, p, sp], i) => { t = connect(t, 'straight', { device: d, port: p }, { device: 's1', port: sp }, `l${i}`); });
  [['p1', 10], ['p2', 11], ['v1', 100]].forEach(([d, n]) => {
    t = updateDevice(t, d, { config: { ...defaultConfig(), ifaces: { Eth0: { ip: `192.168.1.${n}`, mask: '255.255.255.0' } }, gateway: '192.168.1.1' } });
  });
  return t;
}
