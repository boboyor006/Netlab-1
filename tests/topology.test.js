import { describe, it, expect } from 'vitest';
import { emptyTopology, addDevice, connect, linkStatus, removeItems, renameDevice, parseProject, updateDevice, freePorts } from '../src/engine/topology.js';

const base = () => {
  let t = emptyTopology();
  t = addDevice(t, 'pc', { x: 0, y: 0 }, 'p');
  t = addDevice(t, 'switch', { x: 1, y: 0 }, 's');
  t = addDevice(t, 'router', { x: 2, y: 0 }, 'r');
  return t;
};
const pc = { device: 'p', port: 'Eth0' }, sw = { device: 's', port: 'Fa0/1' };

describe('topologiya', () => {
  it('nomlarni ketma-ket beradi', () => {
    const t = addDevice(base(), 'pc', { x: 0, y: 0 });
    expect(t.devices.at(-1).name).toBe('PC2');
  });
  it('PC va switch to‘g‘ri kabel bilan ishlaydi', () => {
    const t = connect(base(), 'straight', pc, sw);
    expect(linkStatus(t, t.links[0]).up).toBe(true);
  });
  it('noto‘g‘ri kabelda aloqa yo‘q', () => {
    const t = connect(base(), 'cross', pc, sw);
    expect(linkStatus(t, t.links[0]).up).toBe(false);
  });
  it('router porti yoqilmaguncha o‘chiq', () => {
    let t = connect(base(), 'straight', { device: 'r', port: 'Gi0/0' }, sw);
    expect(linkStatus(t, t.links[0]).up).toBe(false);
    t = updateDevice(t, 'r', { disabled: [] });
    expect(linkStatus(t, t.links[0]).up).toBe(true);
  });
  it('band va mos kelmaydigan portni rad etadi', () => {
    const t = connect(base(), 'straight', pc, sw);
    expect(() => connect(t, 'straight', pc, { device: 's', port: 'Fa0/2' })).toThrow(/band/);
    expect(() => connect(t, 'serial', { device: 'r', port: 'Gi0/0' }, { device: 's', port: 'Fa0/2' })).toThrow(/mos emas/);
    expect(freePorts(t, t.devices[0])).toHaveLength(0);
  });
  it('qurilma o‘chsa kabeli ham o‘chadi', () => {
    const t = removeItems(connect(base(), 'straight', pc, sw), ['p']);
    expect(t.links).toHaveLength(0);
  });
  it('takroriy nomni rad etadi', () => expect(() => renameDevice(base(), 'p', 'SW1')).toThrow());
  it('eksport/import va buzilgan fayl', () => {
    const t = connect(base(), 'straight', pc, sw);
    expect(parseProject(JSON.stringify({ name: 'A', topology: t })).topology).toEqual(t);
    expect(() => parseProject('xx')).toThrow();
    expect(() => parseProject('{"topology":{"devices":[{"type":"x"}],"links":[]}}')).toThrow();
  });
});
