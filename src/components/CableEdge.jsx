import { BaseEdge, getStraightPath } from '@xyflow/react';

export default function CableEdge({ sourceX, sourceY, targetX, targetY, data, selected }) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const dx = targetX - sourceX, dy = targetY - sourceY, len = Math.hypot(dx, dy) || 1;
  const k = Math.min(68 / len, 0.38);
  const color = data.status.up ? '#16A34A' : '#DC2626';
  const ends = [[sourceX + dx * k, sourceY + dy * k, data.a], [targetX - dx * k, targetY - dy * k, data.b]];
  return (
    <>
      <BaseEdge path={path} interactionWidth={24} style={{
        stroke: selected ? '#2563EB' : '#0F2A5F', strokeWidth: selected ? 4 : 2,
        strokeDasharray: data.cable === 'cross' ? '8 5' : data.cable === 'serial' ? '2 4' : undefined }} />
      {ends.map(([x, y, port], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill={color} stroke="#fff" strokeWidth="2" />
          <text x={(i ? -dx : dx) < -20 ? x - 10 : x + 10} y={y + 4} textAnchor={(i ? -dx : dx) < -20 ? 'end' : 'start'} className="portText">{port}</text>
        </g>
      ))}
    </>
  );
}
