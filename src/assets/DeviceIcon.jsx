// Original oq-ko'k SVG rasmlar
const B = '#2563EB', D = '#0F2A5F', L = '#DBEAFE', W = '#FFFFFF';
const s = { stroke: D, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' };
const dots = (n, x, y, gap) => Array.from({ length: n }, (_, i) => <rect key={i} x={x + i * gap} y={y} width="4" height="4" rx="1" fill={W} />);

const art = {
  router: <><path d="M6 24v14c0 7 12 12 26 12s26-5 26-12V24" fill={B} {...s} /><ellipse cx="32" cy="24" rx="26" ry="12" fill={L} {...s} />
    <path d="M18 24h10m-4-4 4 4-4 4M46 24H36m4-4-4 4 4 4" fill="none" {...s} />{dots(4, 20, 40, 7)}</>,
  switch: <><rect x="4" y="20" width="56" height="26" rx="5" fill={B} {...s} />{dots(6, 11, 35, 7.5)}<path d="M14 27h26m-5-3 5 3-5 3" fill="none" stroke={W} strokeWidth="2.5" /></>,
  l3switch: <><rect x="4" y="14" width="56" height="38" rx="6" fill={B} {...s} />{dots(6, 11, 42, 7.5)}<circle cx="32" cy="27" r="9" fill={L} {...s} /><path d="M26 27h12M32 21v12" {...s} /></>,
  firewall: <><rect x="8" y="12" width="48" height="40" rx="4" fill={L} {...s} /><path d="M8 25h48M8 39h48M24 12v13M40 25v14M24 39v13" {...s} /></>,
  ap: <><rect x="12" y="38" width="40" height="14" rx="7" fill={B} {...s} />{dots(3, 23, 43, 7)}<path d="M23 28a13 13 0 0 1 18 0M16 20a23 23 0 0 1 32 0" fill="none" stroke={B} strokeWidth="3.5" strokeLinecap="round" /></>,
  cloud: <path d="M18 48a12 12 0 0 1-1-24 16 16 0 0 1 30-2 13 13 0 0 1 0 26Z" fill={L} {...s} />,
  pc: <><rect x="7" y="10" width="50" height="34" rx="4" fill={B} {...s} /><rect x="12" y="15" width="40" height="24" rx="2" fill={L} /><path d="M27 44l-3 9h16l-3-9M19 54h26" fill={W} {...s} /></>,
  laptop: <><rect x="13" y="14" width="38" height="28" rx="3" fill={B} {...s} /><rect x="18" y="19" width="28" height="18" rx="1" fill={L} /><path d="M13 42h38l8 9H5Z" fill={W} {...s} /></>,
  server: <>{[8, 25, 42].map((y) => <g key={y}><rect x="14" y={y} width="36" height="15" rx="3" fill={B} {...s} /><circle cx="22" cy={y + 7.5} r="2" fill={W} /><path d={`M30 ${y + 7.5}h13`} stroke={L} strokeWidth="3" /></g>)}</>,
  phone: <><rect x="10" y="14" width="44" height="38" rx="5" fill={B} {...s} /><rect x="15" y="19" width="10" height="28" rx="5" fill={W} {...s} /><rect x="30" y="20" width="18" height="10" rx="2" fill={L} />{[36, 43].flatMap((y) => dots(3, 31, y, 7).map((e, i) => <g key={`${y}${i}`}>{e}</g>))}</>,
  printer: <><path d="M19 24V9h26v15" fill={W} {...s} /><rect x="8" y="24" width="48" height="22" rx="4" fill={B} {...s} /><path d="M19 38h26v17H19Z" fill={L} {...s} /><circle cx="48" cy="31" r="2" fill={W} /></>,
};

export default function DeviceIcon({ type, size = 48 }) {
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">{art[type]}</svg>;
}
