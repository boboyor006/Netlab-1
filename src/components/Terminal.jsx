import { useEffect, useRef, useState } from 'react';
import { run, openSession, prompt, help, complete } from '../engine/cli.js';
import { IOS_TYPES, HOST_TYPES } from '../engine/config.js';
import { useStore } from '../store/useStore.js';

// Qora fon, oq yozuvli terminal oynasi
export default function Terminal({ projectId, topo, device, commit, onClose, onSwitch }) {
  const key = `${projectId}:${device.id}`;
  const saved = useStore((s) => s.terminals[key]);
  const setTerminal = useStore((s) => s.setTerminal);
  const ios = IOS_TYPES.includes(device.type);
  const light = useStore((s) => s.termLight);
  const toggle = useStore((s) => s.toggleTerm);
  const fresh = () => {
    const o = openSession(device);
    const intro = ios ? `${device.name} — buyruqlar oynasi. "enable" dan boshlang, yordam: ?` : 'Kompyuter buyruq oynasi. Yordam: help';
    return { session: o.session, history: [], lines: [intro, ...(o.output ? [o.output] : [])] };
  };
  const [initial] = useState(fresh);
  const term = saved ?? initial;
  // Telnet seansida buyruqlar uzoqdagi qurilmaga tegishli
  const active = topo.devices.find((d) => d.id === term.session.remote?.id) ?? device;
  const asking = !!term.session.ask;
  const list = topo.devices.filter((d) => IOS_TYPES.includes(d.type) || HOST_TYPES.includes(d.type));
  const [input, setInput] = useState('');
  const [at, setAt] = useState(null);
  const box = useRef(null), field = useRef(null);
  useEffect(() => { box.current.scrollTop = box.current.scrollHeight; }, [saved]);
  useEffect(() => { field.current.focus(); }, []);
  const ps = prompt(active, term.session);

  const exec = (line) => {
    let result;
    commit((t) => { result = run(t, device.id, term.session, line); return result.topo; });
    const lines = result.clear ? [] : [...term.lines, ps + (asking ? '' : line), ...(result.output ? [result.output] : [])].slice(-400);
    setTerminal(key, { session: result.session, lines, history: !asking && line.trim() ? [...term.history, line].slice(-50) : term.history });
  };
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter') { exec(input); setInput(''); setAt(null); }
    else if (asking) return;
    else if (e.key === 'Tab') { e.preventDefault(); setInput(complete(active, term.session, input)); }
    else if (e.key === '?' && term.session.mode !== 'host') {
      e.preventDefault();
      setTerminal(key, { ...term, lines: [...term.lines, `${ps}${input}?`, help(active, term.session, input)] });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const h = term.history;
      if (!h.length) return;
      const i = Math.max(0, Math.min(h.length, (at ?? h.length) + (e.key === 'ArrowUp' ? -1 : 1)));
      setAt(i); setInput(h[i] ?? '');
    }
  };
  // Telefon klaviaturasi uchun tugmalar
  const quick = (fn) => () => { fn(); field.current.focus(); };

  return (
    <div className="modalBg" onClick={onClose}>
      <div className={`terminal ${light ? 'light' : ''}`} role="dialog" aria-label={`${device.name} CLI`} onClick={(e) => e.stopPropagation()}>
        <div className="termHead">
          <select value={device.id} onChange={(e) => onSwitch(e.target.value)} aria-label="Qurilmani tanlash">
            {list.map((d) => <option key={d.id} value={d.id}>{d.name} — {IOS_TYPES.includes(d.type) ? 'CLI' : 'Command Prompt'}</option>)}
          </select>
          <button className="mode" onClick={toggle}>{light ? 'Qora oyna' : 'Oq oyna'}</button>
          <button onClick={onClose} aria-label="Terminalni yopish">✕</button>
        </div>
        <div className="termBody" ref={box} onClick={() => !getSelection().toString() && field.current.focus()}>
          {term.lines.map((l, i) => <pre key={i}>{l}</pre>)}
          <label className="termLine"><span>{ps}</span>
            <input ref={field} type={asking ? 'password' : 'text'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} aria-label="Buyruq"
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck="false" />
          </label>
        </div>
        <div className="termKeys">
          <button disabled={asking} onClick={quick(() => setInput(complete(active, term.session, input)))}>Tab</button>
          {term.session.mode !== 'host' && !asking && <button onClick={quick(() => setTerminal(key, { ...term, lines: [...term.lines, `${ps}${input}?`, help(active, term.session, input)] }))}>?</button>}
          <button onClick={quick(() => exec('cls'))}>cls</button>
          <button onClick={quick(() => { exec(input); setInput(''); })}>Enter</button>
        </div>
      </div>
    </div>
  );
}
