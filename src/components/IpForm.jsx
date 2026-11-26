import { useState } from 'react';
import { getConfig, getIface, sviShutdown, isSwitch, HOST_TYPES } from '../engine/config.js';
import { classMask, ipInterfaces, applyIp } from '../engine/ipsetup.js';

function Fields({ device, iface, commit }) {
  const host = HOST_TYPES.includes(device.type);
  const withGateway = host || isSwitch(device.type);
  const saved = getIface(device, iface);
  const [v, setV] = useState({
    ip: saved.ip ?? '', mask: saved.mask ?? '', gateway: getConfig(device).gateway,
    on: iface.startsWith('Vlan') ? !sviShutdown(device, iface) || !saved.ip : !device.disabled.includes(iface) || !saved.ip,
  });
  const [manual, setManual] = useState(!!saved.mask && saved.mask !== classMask(saved.ip));
  const [msg, setMsg] = useState(null);
  const set = (patch) => { setV({ ...v, ...patch }); setMsg(null); };
  // IP to‘liq yozilganda mask o‘zi chiqadi
  const setIp = (ip) => set({ ip, ...(manual ? {} : { mask: classMask(ip.trim()) }) });
  const save = (e) => {
    e.preventDefault();
    let result;
    commit((t) => {
      result = applyIp(t, device.id, { iface, ip: v.ip.trim(), mask: v.mask.trim(), gateway: withGateway ? v.gateway.trim() : '', on: v.on });
      return result.topo;
    });
    setMsg(result.error ? { text: result.error, ok: false } : { text: '✓ Saqlandi', ok: true });
  };
  const input = (label, value, onChange, placeholder) => (
    <label>{label}<input value={value} placeholder={placeholder} inputMode="decimal" onChange={(e) => onChange(e.target.value)} /></label>
  );
  return (
    <form className="ipForm" onSubmit={save}>
      {input('IP manzil', v.ip, setIp, '192.168.1.10')}
      {input('Subnet mask', v.mask, (mask) => { setManual(mask !== ''); set({ mask }); }, 'IP yozilsa o‘zi chiqadi')}
      {withGateway && input('Default gateway (ixtiyoriy)', v.gateway, (gateway) => set({ gateway }), '192.168.1.1')}
      {!host && <label className="check"><input type="checkbox" checked={v.on} onChange={(e) => set({ on: e.target.checked })} />Port yoqilgan</label>}
      <button className="btn primary">IP saqlash</button>
      {msg && <p className={msg.ok ? 'ok' : 'bad'} role="status">{msg.text}</p>}
    </form>
  );
}

export default function IpForm({ device, commit }) {
  const list = ipInterfaces(device);
  const [iface, setIface] = useState(list[0]);
  return (
    <div className="ipForm">
      {list.length > 1 && (
        <label>Interfeys<select value={iface} onChange={(e) => setIface(e.target.value)}>
          {list.map((n) => <option key={n} value={n}>{n}{getIface(device, n).ip ? ` — ${getIface(device, n).ip}` : ''}</option>)}
        </select></label>
      )}
      <Fields key={`${device.id}:${iface}`} device={device} iface={iface} commit={commit} />
    </div>
  );
}
