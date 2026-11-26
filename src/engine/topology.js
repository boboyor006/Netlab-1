// Sof funksiyalar: loyiha = { devices: [], links: [] }
import { DEVICE_TYPES, CABLES } from './devices.js';
import { cleanConfig } from './config.js';

export const emptyTopology = () => ({ devices: [], links: [] });
export const newId = () => Math.random().toString(36).slice(2, 10);

function nextName(topo, type) {
  const { prefix } = DEVICE_TYPES[type];
  const used = new Set(topo.devices.map((d) => d.name));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function addDevice(topo, type, position, id = newId()) {
  if (!DEVICE_TYPES[type]) throw new Error('Noma’lum qurilma turi');
  // Router portlari boshlang‘ich holatda o‘chiq (shutdown) bo‘ladi
  const disabled = type === 'router' ? DEVICE_TYPES.router.ports.map((p) => p.id) : [];
  const device = { id, type, name: nextName(topo, type), position, power: true, disabled };
  return { ...topo, devices: [...topo.devices, device] };
}

export const updateDevice = (topo, id, patch) => ({
  ...topo,
  devices: topo.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
});

export function renameDevice(topo, id, name) {
  const clean = name.trim();
  if (!clean) throw new Error('Nom bo‘sh bo‘lmasin');
  if (topo.devices.some((d) => d.id !== id && d.name === clean)) throw new Error('Bu nom band');
  return updateDevice(topo, id, { name: clean });
}

export function removeItems(topo, deviceIds = [], linkIds = []) {
  const d = new Set(deviceIds), l = new Set(linkIds);
  return {
    devices: topo.devices.filter((x) => !d.has(x.id)),
    links: topo.links.filter((x) => !l.has(x.id) && !d.has(x.a.device) && !d.has(x.b.device)),
  };
}

export const portLink = (topo, deviceId, port) =>
  topo.links.find((l) => [l.a, l.b].some((e) => e.device === deviceId && e.port === port));

export const freePorts = (topo, device, media) =>
  DEVICE_TYPES[device.type].ports.filter((p) => (!media || p.media === media) && !portLink(topo, device.id, p.id));

// Mis kabelda: bir xil guruhdagi qurilmalar uchun krossover kerak
const SWITCH_SIDE = new Set(['switch', 'l3switch', 'ap', 'cloud']);
export const expectedCable = (typeA, typeB) =>
  SWITCH_SIDE.has(typeA) === SWITCH_SIDE.has(typeB) ? 'cross' : 'straight';

export function connect(topo, cable, a, b, id = newId()) {
  if (!CABLES[cable]) throw new Error('Kabel turini tanlang');
  if (a.device === b.device) throw new Error('Qurilmani o‘ziga ulab bo‘lmaydi');
  for (const end of [a, b]) {
    const dev = topo.devices.find((d) => d.id === end.device);
    if (!dev) throw new Error('Qurilma topilmadi');
    const port = DEVICE_TYPES[dev.type].ports.find((p) => p.id === end.port);
    if (!port) throw new Error('Port topilmadi');
    if (port.media !== CABLES[cable].media) throw new Error(`${dev.name} ${port.id} porti bu kabelga mos emas`);
    if (portLink(topo, end.device, end.port)) throw new Error(`${dev.name} ${port.id} porti band`);
  }
  return { ...topo, links: [...topo.links, { id, cable, a, b }] };
}

// Port holati: 'up' yoki { down, sabab }
export function linkStatus(topo, link) {
  const [a, b] = [link.a, link.b].map((e) => ({ ...e, dev: topo.devices.find((d) => d.id === e.device) }));
  for (const e of [a, b]) {
    if (!e.dev.power) return { up: false, reason: `${e.dev.name} o‘chirilgan` };
    if (e.dev.disabled.includes(e.port)) return { up: false, reason: `${e.dev.name} ${e.port} porti o‘chiq` };
  }
  if (CABLES[link.cable].media === 'copper' && expectedCable(a.dev.type, b.dev.type) !== link.cable) {
    return { up: false, reason: `Noto‘g‘ri kabel: ${CABLES[expectedCable(a.dev.type, b.dev.type)].label.toLowerCase()} kerak` };
  }
  return { up: true, reason: 'Aloqa bor' };
}

// Import qilingan JSON'ni tekshirish
export function parseProject(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Fayl JSON formatida emas'); }
  const t = data?.topology;
  if (!t || !Array.isArray(t.devices) || !Array.isArray(t.links)) throw new Error('Bu NetSim loyihasi emas');
  let out = emptyTopology();
  for (const d of t.devices) {
    if (!DEVICE_TYPES[d?.type] || typeof d.id !== 'string' || typeof d.name !== 'string' ||
        !Number.isFinite(d.position?.x) || !Number.isFinite(d.position?.y) ||
        out.devices.some((x) => x.id === d.id)) throw new Error('Qurilma ma’lumoti buzilgan');
    out.devices.push({ id: d.id, type: d.type, name: d.name, position: { x: d.position.x, y: d.position.y },
      power: d.power !== false, disabled: Array.isArray(d.disabled) ? d.disabled : [], ...(d.config ? { config: cleanConfig(d.config) } : {}) });
  }
  for (const l of t.links) {
    if (!l?.a || !l?.b || typeof l.id !== 'string') throw new Error('Ulanish ma’lumoti buzilgan');
    out = connect(out, l.cable, l.a, l.b, l.id);
  }
  return { name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Import qilingan loyiha', topology: out };
}
