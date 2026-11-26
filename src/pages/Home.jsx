import { go } from '../App.jsx';
import DeviceIcon from '../assets/DeviceIcon.jsx';
import { useStore } from '../store/useStore.js';
import { sampleTopology } from '../engine/sample.js';

const features = [
  ['router', '11 xil qurilma', 'Router, switch, firewall, server va boshqalar o‘z rasmi va portlari bilan.'],
  ['switch', 'Port darajasida ulash', 'To‘g‘ri, krossover va serial kabellar. Aloqa holati yashil yoki qizil.'],
  ['laptop', 'Har qanday ekran', 'Kompyuter, planshet va telefonda sichqoncha yoki barmoq bilan ishlaydi.'],
  ['server', 'Saqlash va eksport', 'Avtomatik saqlash, JSON eksport va import.'],
];

export default function Home() {
  const create = useStore((s) => s.createProject);
  return (
    <main className="page">
      <section className="hero">
        <h1>Tarmoqni brauzerda quring</h1>
        <p>Qurilmalarni ulang, CLI orqali sozlang va ping bilan tekshiring.</p>
        <div className="row center">
          <button className="btn primary" onClick={() => go(`/sim/${create('Yangi loyiha')}`)}>Boshlash</button>
          <button className="btn" onClick={() => go(`/sim/${create('Namuna: ofis tarmog‘i', sampleTopology())}`)}>Namunani ochish</button>
        </div>
        <div className="heroArt">{['pc', 'switch', 'router', 'cloud', 'server'].map((t) => <DeviceIcon key={t} type={t} size={72} />)}</div>
      </section>
      <section className="cards">
        {features.map(([i, h, p]) => <article className="card" key={h}><DeviceIcon type={i} /><h3>{h}</h3><p>{p}</p></article>)}
      </section>
    </main>
  );
}
