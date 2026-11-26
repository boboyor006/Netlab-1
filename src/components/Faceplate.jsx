import { DEVICE_TYPES } from '../engine/devices.js';
import { portLink, linkStatus } from '../engine/topology.js';
import DeviceIcon from '../assets/DeviceIcon.jsx';

// Orqa panel: portlar bosiladi, rang holatni ko'rsatadi
export default function Faceplate({ topo, device, onPort, selectedPort }) {
  const ports = DEVICE_TYPES[device.type].ports;
  const cols = Math.min(ports.length, 6);
  const W = 320, cw = (W - 76) / 6, rows = Math.ceil(ports.length / cols);
  const H = 30 + rows * 52;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="plate" role="group" aria-label={`${device.name} portlari`}>
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="12" fill="#F5F9FF" stroke="#0F2A5F" strokeWidth="2" />
      <g transform={`translate(12 ${H / 2 - 24})`}><DeviceIcon type={device.type} size={48} /></g>
      {ports.map((p, i) => {
        const x = 70 + (i % cols) * cw, y = 22 + Math.floor(i / cols) * 52;
        const l = portLink(topo, device.id, p.id);
        const off = !device.power || device.disabled.includes(p.id);
        const led = l ? (linkStatus(topo, l).up ? '#16A34A' : '#DC2626') : off ? '#DC2626' : '#CBD5E1';
        return (
          <g key={p.id} className="port" tabIndex="0" role="button" aria-label={p.id}
             onClick={() => onPort(p.id)} onKeyDown={(e) => e.key === 'Enter' && onPort(p.id)}>
            <rect x={x} y={y} width={Math.min(cw - 5, 34)} height="22" rx="4" fill={l ? '#2563EB' : '#fff'}
              stroke={selectedPort === p.id ? '#2563EB' : '#0F2A5F'} strokeWidth={selectedPort === p.id ? 3.5 : 1.5} />
            <circle cx={x + 6} cy={y - 6} r="3.5" fill={led} />
            <text x={x + Math.min(cw - 5, 34) / 2} y={y + 36} textAnchor="middle">{p.id}</text>
          </g>
        );
      })}
    </svg>
  );
}
