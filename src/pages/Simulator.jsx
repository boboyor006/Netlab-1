import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, MiniMap, useReactFlow, applyNodeChanges } from '@xyflow/react';
import { useStore } from '../store/useStore.js';
import { DEVICE_TYPES, CABLES } from '../engine/devices.js';
import { IOS_TYPES, HOST_TYPES } from '../engine/config.js';
import { addDevice, connect, freePorts, linkStatus, removeItems, updateDevice } from '../engine/topology.js';
import DeviceIcon from '../assets/DeviceIcon.jsx';
import DeviceNode from '../components/DeviceNode.jsx';
import CableEdge from '../components/CableEdge.jsx';
import Inspector from '../components/Inspector.jsx';
import Terminal from '../components/Terminal.jsx';
import IpWindow from '../components/IpWindow.jsx';

const nodeTypes = { device: DeviceNode };
const edgeTypes = { cable: CableEdge };

function Editor({ project }) {
  const id = project.id, topo = project.topology;
  const { commit, undo, redo, history, renameProject, notify, saved } = useStore();
  const change = useCallback((fn) => commit(id, fn), [commit, id]);
  const flow = useReactFlow();
  const [sel, setSel] = useState(null);       // { kind, id }
  const [cable, setCable] = useState(null);
  const [from, setFrom] = useState(null);     // { device, port }
  const [picker, setPicker] = useState(null); // deviceId
  const [drawer, setDrawer] = useState(false);
  const [cli, setCli] = useState(null); // deviceId
  const [ipWin, setIpWin] = useState(null); // deviceId
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    setNodes((old) => topo.devices.map((d) => ({
      ...old.find((n) => n.id === d.id), id: d.id, type: 'device', position: d.position,
      selected: sel?.id === d.id, data: { ...d, pending: from?.device === d.id },
    })));
  }, [topo, sel, from]);

  const edges = useMemo(() => topo.links.map((l) => ({
    id: l.id, source: l.a.device, target: l.b.device, type: 'cable', selected: sel?.id === l.id,
    data: { cable: l.cable, a: l.a.port, b: l.b.port, status: linkStatus(topo, l) },
  })), [topo, sel]);

  const cancel = useCallback(() => { setCable(null); setFrom(null); setPicker(null); }, []);

  const place = (type, position) => {
    if (!position) {
      const r = document.querySelector('.canvas').getBoundingClientRect();
      const c = flow.screenToFlowPosition({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      // Ustma-ust tushmasligi uchun bo'sh katak qidiriladi
      let i = 0;
      do {
        position = { x: Math.round(c.x - 48 + ((i % 5) - 2) * (i ? 130 : 0)), y: Math.round(c.y - 48 + Math.floor(i / 5) * 130) };
        if (i === 0) position.x = Math.round(c.x - 48);
        i++;
      } while (i < 60 && topo.devices.some((d) => Math.abs(d.position.x - position.x) < 100 && Math.abs(d.position.y - position.y) < 100));
    }
    change((t) => addDevice(t, type, position));
    setDrawer(false);
  };

  useEffect(() => {
    const key = (e) => {
      if (cli || ipWin) { if (e.key === 'Escape') { setCli(null); setIpWin(null); } return; }
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') { cancel(); setSel(null); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(id); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(id); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        change((t) => removeItems(t, sel.kind === 'device' ? [sel.id] : [], sel.kind === 'link' ? [sel.id] : []));
        setSel(null);
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [sel, cli, ipWin, id, change, undo, redo, cancel]);

  const choosePort = (port) => {
    const end = { device: picker, port };
    setPicker(null);
    if (!from) return setFrom(end);
    if (change((t) => connect(t, cable, from, end))) { notify('Kabel ulandi'); cancel(); }
  };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ name: project.name, topology: topo }, null, 2)], { type: 'application/json' }));
    a.download = `${project.name.replace(/[^\p{L}\p{N}-]+/gu, '_')}.netsim.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const dev = (i) => topo.devices.find((d) => d.id === i);
  const selDevice = sel?.kind === 'device' ? dev(sel.id) : null;
  const selLink = sel?.kind === 'link' ? topo.links.find((l) => l.id === sel.id) : null;
  const ports = picker && cable ? freePorts(topo, dev(picker), CABLES[cable].media) : [];
  const upCount = edges.filter((e) => e.data.status.up).length;
  const hint = !cable ? null : !from ? 'Birinchi qurilmani bosing' : `${dev(from.device)?.name} ${from.port} → ikkinchi qurilmani bosing`;

  return (
    <div className="sim">
      <header className="toolbar">
        <a href="#/loyihalar" className="logo" aria-label="Loyihalarga qaytish"><span>◆</span><em>NetSim</em></a>
        <input className="pname" aria-label="Loyiha nomi" defaultValue={project.name}
          onBlur={(e) => { const v = e.target.value.trim(); if (v) renameProject(id, v); else e.target.value = project.name; }}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
        <span className={`saved ${saved ? 'ok' : 'bad'}`}>{saved ? '✓ Saqlandi' : 'Saqlanmadi'}</span>
        <div className="tools">
          <button className="btn icon" onClick={() => undo(id)} disabled={!history.past.length} title="Bekor qilish" aria-label="Bekor qilish">↶</button>
          <button className="btn icon" onClick={() => redo(id)} disabled={!history.future.length} title="Qaytarish" aria-label="Qaytarish">↷</button>
          <button className="btn icon" onClick={() => flow.zoomOut()} aria-label="Kichraytirish">−</button>
          <button className="btn icon" onClick={() => flow.zoomIn()} aria-label="Kattalashtirish">+</button>
          <button className="btn" onClick={() => flow.fitView({ padding: 0.25, duration: 250, maxZoom: 1.4 })}>⛶ Sig‘dirish</button>
          <button className="btn cli" onClick={() => {
            const able = topo.devices.filter((d) => [...IOS_TYPES, ...HOST_TYPES].includes(d.type));
            const pick = able.find((d) => d.id === sel?.id) ?? able.find((d) => IOS_TYPES.includes(d.type)) ?? able[0];
            if (pick) { cancel(); setCli(pick.id); } else notify('Avval switch, router yoki kompyuter qo‘shing', 'error');
          }}>&gt;_ Terminal</button>
          <button className="btn primary" onClick={exportJson}>Eksport</button>
        </div>
      </header>

      <div className="body">
        <aside className={`library ${drawer ? 'open' : ''}`}>
          <input placeholder="Qidirish…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Qurilma qidirish" />
          <h4>Kabellar</h4>
          {Object.entries(CABLES).map(([k, c]) => (
            <button key={k} className={`cable ${cable === k ? 'on' : ''}`} onClick={() => { setFrom(null); setCable(cable === k ? null : k); setSel(null); setDrawer(false); }}>
              <svg width="34" height="12"><line x1="1" y1="6" x2="33" y2="6" stroke="currentColor" strokeWidth="3" strokeDasharray={k === 'cross' ? '8 4' : k === 'serial' ? '3 3' : undefined} /></svg>{c.label}
            </button>
          ))}
          {['Tarmoq', 'Oxirgi qurilmalar'].map((g) => {
            const list = Object.entries(DEVICE_TYPES).filter(([, d]) => d.group === g && d.label.toLowerCase().includes(query.toLowerCase()));
            return list.length > 0 && (
              <div key={g}><h4>{g}</h4><div className="grid">
                {list.map(([k, d]) => (
                  <button key={k} draggable onDragStart={(e) => e.dataTransfer.setData('device', k)} onClick={() => place(k)}>
                    <DeviceIcon type={k} size={42} /><span>{d.label}</span>
                  </button>
                ))}
              </div></div>
            );
          })}
        </aside>

        <div className="canvas" onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const t = e.dataTransfer.getData('device'); if (t) { const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }); place(t, { x: p.x - 48, y: p.y - 48 }); } }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={(c) => setNodes((n) => applyNodeChanges(c.filter((x) => x.type !== 'remove' && x.type !== 'select'), n))}
            onNodeDragStop={(_, __, moved) => change((t) => moved.reduce((acc, n) => {
              const old = acc.devices.find((d) => d.id === n.id).position;
              return old.x === n.position.x && old.y === n.position.y ? acc : updateDevice(acc, n.id, { position: n.position });
            }, t))}
            onNodeClick={(_, n) => {
              if (!cable) return setSel({ kind: 'device', id: n.id });
              if (from?.device === n.id) return notify('Boshqa qurilmani tanlang', 'error');
              setPicker(n.id);
            }}
            onNodeDoubleClick={(_, n) => {
              if (cable) return;
              // Kompyuterda IP oynasi, router va switchda terminal ochiladi
              if (HOST_TYPES.includes(dev(n.id).type)) setIpWin(n.id);
              else if (IOS_TYPES.includes(dev(n.id).type)) setCli(n.id);
            }}
            zoomOnDoubleClick={false}
            onEdgeClick={(_, e) => !cable && setSel({ kind: 'link', id: e.id })}
            onPaneClick={() => { setSel(null); setDrawer(false); }}
            nodesConnectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
            fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }} minZoom={0.2} maxZoom={3}>
            <Background gap={22} size={1.6} color="#BFD6FB" />
            <MiniMap pannable zoomable style={{ width: 140, height: 100 }} nodeColor="#2563EB" maskColor="rgba(219,234,254,.55)" />
          </ReactFlow>
          {!topo.devices.length && <div className="empty overlay"><DeviceIcon type="router" size={80} /><p>Qurilmalar ro‘yxatidan birini qo‘shing.</p></div>}
          {hint && <div className="hint">{hint}<button className="btn small" onClick={cancel}>Bekor qilish</button></div>}
          <button className="btn primary fab" onClick={() => setDrawer(!drawer)}>{drawer ? '✕ Yopish' : '+ Qurilmalar'}</button>
        </div>

        <aside className={`side ${selDevice || selLink ? 'open' : ''}`}>
          {selDevice || selLink
            ? <Inspector key={sel.id} topo={topo} device={selDevice} link={selLink} commit={change} onClose={() => setSel(null)} onCli={() => setCli(sel.id)} onIp={() => setIpWin(sel.id)} />
            : <p className="note">Xususiyatlarni ko‘rish uchun qurilma yoki kabelni tanlang.</p>}
        </aside>
      </div>

      <footer className="status">
        <span>{topo.devices.length} qurilma</span><span>{edges.length} kabel</span>
        <span className="ok">● {upCount} ishlayapti</span>{edges.length - upCount > 0 && <span className="bad">● {edges.length - upCount} uzilgan</span>}
      </footer>

      {cli && dev(cli) && <Terminal key={cli} projectId={id} topo={topo} device={dev(cli)} commit={change} onClose={() => setCli(null)} onSwitch={setCli} />}

      {ipWin && dev(ipWin) && <IpWindow key={ipWin} device={dev(ipWin)} commit={change} onClose={() => setIpWin(null)} onCli={() => { setCli(ipWin); setIpWin(null); }} />}

      {picker && (
        <div className="modalBg" onClick={() => setPicker(null)}>
          <div className="modal" role="dialog" aria-label="Port tanlash" onClick={(e) => e.stopPropagation()}>
            <h3>{dev(picker).name}: port tanlang</h3>
            <div className="portGrid">{ports.map((p) => <button className="btn" key={p.id} onClick={() => choosePort(p.id)}>{p.id}</button>)}</div>
            {!ports.length && <p className="bad">Bu kabelga mos bo‘sh port yo‘q.</p>}
            <button className="btn" onClick={() => setPicker(null)}>Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Simulator({ id }) {
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const reset = useStore((s) => s.resetHistory);
  useEffect(() => { reset(); }, [id, reset]);
  if (!project) return <main className="page empty"><p>Loyiha topilmadi.</p><a className="btn primary" href="#/loyihalar">Loyihalarga qaytish</a></main>;
  return <ReactFlowProvider><Editor project={project} /></ReactFlowProvider>;
}
