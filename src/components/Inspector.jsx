import { useEffect, useState } from 'react';
import { DEVICE_TYPES, CABLES } from '../engine/devices.js';
import { updateDevice, renameDevice, removeItems, portLink, linkStatus } from '../engine/topology.js';
import Faceplate from './Faceplate.jsx';
import { IOS_TYPES, HOST_TYPES } from '../engine/config.js';

export default function Inspector({ topo, device, link, commit, onClose, onCli, onIp }) {
  const [tab, setTab] = useState('physical');
  const [port, setPort] = useState(null);
  const [name, setName] = useState(device?.name ?? '');
  useEffect(() => { setName(device?.name ?? ''); }, [device?.name]);
  useEffect(() => { setPort(null); }, [device?.id]);
  const find = (id) => topo.devices.find((d) => d.id === id);

  if (link) {
    const st = linkStatus(topo, link);
    return (
      <div className="inspector">
        <div className="row between"><h3>Kabel</h3><button className="btn icon" onClick={onClose} aria-label="Yopish">✕</button></div>
        <p>{CABLES[link.cable].label}</p>
        <p><b>{find(link.a.device).name}</b> {link.a.port} ↔ <b>{find(link.b.device).name}</b> {link.b.port}</p>
        <p className={st.up ? 'ok' : 'bad'}>● {st.reason}</p>
        <button className="btn danger" onClick={() => { commit((t) => removeItems(t, [], [link.id])); onClose(); }}>Kabelni uzish</button>
      </div>
    );
  }
  if (!device) return null;

  const other = (l) => (l.a.device === device.id ? l.b : l.a);
  const togglePort = (p) => commit((t) => {
    const d = t.devices.find((x) => x.id === device.id);
    return updateDevice(t, d.id, { disabled: d.disabled.includes(p) ? d.disabled.filter((x) => x !== p) : [...d.disabled, p] });
  });
  const info = (p) => {
    const l = portLink(topo, device.id, p);
    if (!l) return { text: device.disabled.includes(p) ? 'O‘chiq' : 'Bo‘sh', cls: '' };
    const st = linkStatus(topo, l), o = other(l);
    return { text: `${find(o.device).name} ${o.port} — ${st.reason}`, cls: st.up ? 'ok' : 'bad', link: l };
  };
  const row = (p) => {
    const i = info(p);
    return (
      <li key={p}>
        <div><b>{p}</b><span className={i.cls}>{i.text}</span></div>
        <div className="row">
          <button className="btn small" onClick={() => togglePort(p)}>{device.disabled.includes(p) ? 'Yoqish' : 'O‘chirish'}</button>
          {i.link && <button className="btn small" onClick={() => commit((t) => removeItems(t, [], [i.link.id]))}>Uzish</button>}
        </div>
      </li>
    );
  };
  return (
    <div className="inspector">
      <div className="row between"><h3>{device.name}</h3><button className="btn icon" onClick={onClose} aria-label="Yopish">✕</button></div>
      {(IOS_TYPES.includes(device.type) || HOST_TYPES.includes(device.type)) &&
        <button className="btn primary" onClick={onIp}>IP sozlash</button>}
      {(IOS_TYPES.includes(device.type) || HOST_TYPES.includes(device.type)) &&
        <button className="btn cli" onClick={onCli}>&gt;_ {IOS_TYPES.includes(device.type) ? 'CLI ochish' : 'Command Prompt'}</button>}
      <div className="tabs">
        {[['physical', 'Physical'], ['config', 'Config']].map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>)}
      </div>
      {tab === 'physical' ? (
        <>
          <Faceplate topo={topo} device={device} selectedPort={port} onPort={setPort} />
          {port ? <ul className="ports">{row(port)}</ul> : <p className="note">Portni bosing.</p>}
          <button className="btn" onClick={() => commit((t) => updateDevice(t, device.id, { power: !device.power }))}>
            {device.power ? '⏻ Qurilmani o‘chirish' : '⏻ Qurilmani yoqish'}
          </button>
        </>
      ) : (
        <>
          <p>{DEVICE_TYPES[device.type].label}</p>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (!commit((t) => (name.trim() === device.name ? t : renameDevice(t, device.id, name)))) setName(device.name); }}>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Qurilma nomi" />
            <button className="btn primary">Saqlash</button>
          </form>
          <ul className="ports">{DEVICE_TYPES[device.type].ports.map((p) => row(p.id))}</ul>
        </>
      )}
      <button className="btn danger" onClick={() => { commit((t) => removeItems(t, [device.id])); onClose(); }}>Qurilmani o‘chirish</button>
    </div>
  );
}
