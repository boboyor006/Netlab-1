import { useEffect, useState } from 'react';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import Guide from './pages/Guide.jsx';
import Simulator from './pages/Simulator.jsx';
import { useStore } from './store/useStore.js';

export const go = (path) => { location.hash = path; };

export default function App() {
  const [hash, setHash] = useState(location.hash);
  const toast = useStore((s) => s.toast);
  const saved = useStore((s) => s.saved);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [, page, id] = hash.split('/');
  let view = <Home />;
  if (page === 'loyihalar') view = <Projects />;
  if (page === 'qollanma') view = <Guide />;
  if (page === 'sim') view = <Simulator key={id} id={id} />;
  return (
    <>
      {page !== 'sim' && (
        <header className="nav">
          <a href="#/" className="logo"><span>◆</span> NetSim</a>
          <nav>
            <a href="#/loyihalar" className={page === 'loyihalar' ? 'on' : ''}>Loyihalarim</a>
            <a href="#/qollanma" className={page === 'qollanma' ? 'on' : ''}>Qo‘llanma</a>
          </nav>
        </header>
      )}
      {!saved && <div className="warn">Brauzer xotirasiga saqlab bo‘lmadi. Loyihani eksport qiling.</div>}
      {view}
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </>
  );
}
