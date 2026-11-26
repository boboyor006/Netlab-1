import { useState } from 'react';
import { go } from '../App.jsx';
import { useStore } from '../store/useStore.js';
import { parseProject } from '../engine/topology.js';
import DeviceIcon from '../assets/DeviceIcon.jsx';

export default function Projects() {
  const { projects, createProject, renameProject, deleteProject, notify } = useStore();
  const [edit, setEdit] = useState(null); // { id, name }
  const [del, setDel] = useState(null);
  const importFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const p = parseProject(await file.text());
      go(`/sim/${createProject(p.name, p.topology)}`);
    } catch (err) { notify(err.message, 'error'); }
  };
  const saveName = (e) => {
    e.preventDefault();
    if (edit.name.trim()) renameProject(edit.id, edit.name.trim());
    setEdit(null);
  };
  return (
    <main className="page">
      <div className="row between">
        <h2>Loyihalarim</h2>
        <div className="row">
          <label className="btn">Import (JSON)<input type="file" accept=".json,application/json" hidden onChange={importFile} /></label>
          <button className="btn primary" onClick={() => go(`/sim/${createProject('Yangi loyiha')}`)}>+ Yangi loyiha</button>
        </div>
      </div>
      {!projects.length && <div className="empty"><DeviceIcon type="cloud" size={90} /><p>Hozircha loyiha yo‘q. Birinchisini yarating.</p></div>}
      <div className="cards">
        {projects.map((p) => (
          <article className="card" key={p.id}>
            {edit?.id === p.id ? (
              <form onSubmit={saveName} className="row">
                <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Loyiha nomi" />
                <button className="btn primary">OK</button>
              </form>
            ) : <h3>{p.name}</h3>}
            <p>{p.topology.devices.length} qurilma · {p.topology.links.length} kabel<br /><small>{new Date(p.updated).toLocaleString('ru-RU')}</small></p>
            <div className="row">
              <button className="btn primary" onClick={() => go(`/sim/${p.id}`)}>Ochish</button>
              <button className="btn" onClick={() => setEdit({ id: p.id, name: p.name })}>Nomlash</button>
              {del === p.id
                ? <button className="btn danger" onClick={() => deleteProject(p.id)} onBlur={() => setDel(null)} autoFocus>Tasdiqlash</button>
                : <button className="btn" onClick={() => setDel(p.id)}>O‘chirish</button>}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
