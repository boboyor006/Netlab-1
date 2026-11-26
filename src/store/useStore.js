import { create } from 'zustand';
import { emptyTopology, newId } from '../engine/topology.js';

const KEY = 'netsim.projects.v1';
const load = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
};

export const useStore = create((set, get) => {
  const persist = (projects) => {
    let saved = true;
    try { localStorage.setItem(KEY, JSON.stringify(projects)); } catch { saved = false; }
    set({ projects, saved });
  };
  const patch = (id, fn) => persist(get().projects.map((p) => (p.id === id ? { ...p, ...fn(p), updated: Date.now() } : p)));
  return {
    projects: load(),
    saved: true,
    history: { past: [], future: [] },
    toast: null,
    termLight: false,
    toggleTerm: () => set({ termLight: !get().termLight }),
    terminals: {}, // qurilma bo'yicha terminal tarixi (saqlanmaydi)
    setTerminal: (key, value) => set({ terminals: { ...get().terminals, [key]: value } }),
    notify(text, kind = 'info') {
      const t = { text, kind, key: newId() };
      set({ toast: t });
      setTimeout(() => get().toast?.key === t.key && set({ toast: null }), 3500);
    },
    createProject(name, topology = emptyTopology()) {
      const p = { id: newId(), name, topology, updated: Date.now() };
      persist([p, ...get().projects]);
      return p.id;
    },
    renameProject: (id, name) => patch(id, () => ({ name })),
    deleteProject: (id) => persist(get().projects.filter((p) => p.id !== id)),
    resetHistory: () => set({ history: { past: [], future: [] } }),
    // Har bir o‘zgarish tarixga yoziladi va avtomatik saqlanadi
    commit(id, fn) {
      const p = get().projects.find((x) => x.id === id);
      try {
        const next = fn(p.topology);
        if (next === p.topology) return true;
        set({ history: { past: [...get().history.past.slice(-99), p.topology], future: [] } });
        patch(id, () => ({ topology: next }));
        return true;
      } catch (e) { get().notify(e.message, 'error'); return false; }
    },
    undo(id) {
      const { past, future } = get().history;
      if (!past.length) return;
      const cur = get().projects.find((x) => x.id === id).topology;
      set({ history: { past: past.slice(0, -1), future: [cur, ...future] } });
      patch(id, () => ({ topology: past.at(-1) }));
    },
    redo(id) {
      const { past, future } = get().history;
      if (!future.length) return;
      const cur = get().projects.find((x) => x.id === id).topology;
      set({ history: { past: [...past, cur], future: future.slice(1) } });
      patch(id, () => ({ topology: future[0] }));
    },
  };
});
