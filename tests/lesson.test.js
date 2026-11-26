import { describe, it, expect } from 'vitest';
import { sampleTopology } from '../src/engine/sample.js';
import { run, openSession, newSession } from '../src/engine/cli.js';
import { ping } from '../src/engine/network.js';
import { parseProject } from '../src/engine/topology.js';
import { LESSON } from '../src/engine/lesson.js';

describe('to‘liq mashq, parol va telnet', () => {
  let t = sampleTopology();
  const s = {};
  const send = (id, line) => {
    s[id] ??= openSession(t.devices.find((d) => d.id === id)).session;
    const r = run(t, id, s[id], line); t = r.topo; s[id] = r.session;
    expect(r.output, `${id}: ${line}`).not.toMatch(/Invalid|Incomplete|Ambiguous|topilmadi/);
    return r.output;
  };
  const block = (n) => LESSON.split(/^=== /m)[n].split('\n').slice(1).filter((l) => l && !l.startsWith('  (') && !l.startsWith('Parollar'));

  it('qo‘llanmadagi barcha qadamlar ishlaydi', () => {
    for (const [n, id] of [[1, 's1'], [2, 's1'], [3, 'r1']]) block(n).forEach((l) => send(id, l));
    expect(ping(t, 'p1', '192.168.1.2').ok).toBe(true);
    send('p1', 'telnet 192.168.1.2');
    expect(s.p1.ask.kind).toBe('vty');
    send('p1', 'tel123'); send('p1', 'enable'); send('p1', 'cisco123');
    expect(s.p1.mode).toBe('priv');
    expect(send('p1', 'show vlan brief')).toMatch(/Ofis/);
    send('p1', 'exit');
    expect(s.p1.mode).toBe('host');
    s.s1 = openSession(t.devices.find((d) => d.id === 's1')).session;
    expect(s.s1.ask.kind).toBe('console');
    send('s1', 'con123'); send('s1', 'enable'); send('s1', 'cisco123'); send('s1', 'disable');
    block(5).forEach((l) => { send('s1', l); if (l === 'enable') send('s1', 'cisco123'); });
    s.r1 = newSession('router'); block(6).forEach((l) => send('r1', l));
    for (const l of block(7)) { const [, pc, c] = /^(PC\d):\s+(.*)$/.exec(l); const out = send(pc === 'PC1' ? 'p1' : 'p2', c); if (c.startsWith('ping')) expect(out).toMatch(/Received = 4/); }
  });
  it('noto‘g‘ri parol va yashirish', () => {
    let x = openSession(t.devices.find((d) => d.id === 's1')).session, r;
    for (const p of ['a', 'b', 'c']) { r = run(t, 's1', x, p); x = r.session; }
    expect(r.output).toMatch(/Bad passwords/);
    const show = run(t, 's1', { mode: 'priv', ifs: [] }, 'show run').output;
    expect(show).toMatch(/enable secret 5/);
    expect(show).not.toMatch(/cisco123|con123|tel123/);
    expect(parseProject(JSON.stringify({ topology: t })).topology.devices.find((d) => d.id === 's1').config.vty.password).toBe('tel123');
  });
  it('vty paroli bo‘lmasa telnet rad etiladi', () => {
    const base = sampleTopology();
    const a = run(base, 's1', { mode: 'config', ifs: [] }, 'int vlan 1').session;
    let u = run(base, 's1', a, 'ip address 192.168.1.2 255.255.255.0');
    u = run(u.topo, 's1', u.session, 'no shut');
    expect(run(u.topo, 'p1', newSession('pc'), 'telnet 192.168.1.2').output).toMatch(/none set/);
  });
});
